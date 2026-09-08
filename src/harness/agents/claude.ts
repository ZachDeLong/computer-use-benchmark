import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../env';
import { emptyStats, type Agent, type AgentStats } from './types';

export interface ClaudeAgentOptions {
  model: string;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /** Attach a fresh screenshot to the last tool_result of every action batch (saves a round-trip per step). */
  autoScreenshot: boolean;
  /** Keep at most this many screenshots in the transcript once pruning triggers. */
  keepImages: number;
  maxSteps: number;
  log: (line: string) => void;
}

/** USD per million tokens: [input, output, cacheWrite, cacheRead]. */
const PRICES: Record<string, [number, number, number, number]> = {
  'claude-fable-5-1': [10, 50, 12.5, 0.25],
  'claude-fable-5': [10, 50, 12.5, 1],
  'claude-opus-5': [5, 25, 6.25, 0.5],
  'claude-opus-4-8': [5, 25, 6.25, 0.5],
  'claude-opus-4-7': [5, 25, 6.25, 0.5],
  'claude-sonnet-5': [2, 10, 2.5, 0.2],
  'claude-sonnet-4-6': [3, 15, 3.75, 0.3],
  'claude-haiku-4-5': [1, 5, 1.25, 0.1],
};

/** Prune only every N extra screenshots so the cached prefix stays stable between prunes. */
const PRUNE_CHUNK = 6;

const SYSTEM = `You are taking a timed typing test for computer-use agents. You operate a small simulated desktop (1280x800) through the computer tool.

The desktop has a task bar at the bottom with four apps: Contacts, Settings, Notes, Files. Clicking an app opens or focuses its window. The current task instruction is always shown in the dark bar at the top of the screen, with a timer. When you finish a task the next one appears there automatically. Occasionally a pop-up dialog appears; dismiss it with any of its buttons and continue.

Your score is correct actions per minute, so:
- Act decisively. Every click, keystroke and typed string counts as an action; the fewer, the better.
- Type whole strings in one "type" action after clicking the field. Do not type character by character.
- After each batch of actions you receive a fresh screenshot automatically. Only call "screenshot" if you truly need another look.
- You may issue several actions in one turn when you are confident of their coordinates (for example: click a field, then type). If the screen may change in a way you need to see, stop and look.
- Keep working until the top bar says the session is done. Do not stop to ask questions.`;

export function claudeAgent(opts: ClaudeAgentOptions): Agent {
  const client = new Anthropic();
  return {
    name: `claude:${opts.model}`,
    async run(env: Env): Promise<AgentStats> {
      const stats = emptyStats();
      stats.model = opts.model;
      const messages: Anthropic.MessageParam[] = [];
      const first = await env.summary();
      messages.push({
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: (await env.screenshot()).toString('base64') } },
          {
            type: 'text',
            text: `The session has ${first.taskCount} tasks. Task 1: ${first.task?.instruction ?? ''}\nBegin now.`,
          },
        ],
      });

      let nudges = 0;
      while (!(await env.shouldStop())) {
        if (stats.steps >= opts.maxSteps) {
          env.stopReason = 'step_limit';
          break;
        }
        pruneImages(messages, opts.keepImages, PRUNE_CHUNK);
        const t0 = Date.now();
        let response: Anthropic.Message;
        try {
          response = await client.messages.create({
            model: opts.model,
            max_tokens: 4096,
            system: SYSTEM,
            tools: [{ type: 'computer_toolset_20260801' }],
            ...(opts.effort ? { output_config: { effort: opts.effort } } : {}),
            cache_control: { type: 'ephemeral' },
            messages,
          });
        } catch (err) {
          if (err instanceof Anthropic.RateLimitError) {
            opts.log('rate limited; waiting 15s');
            await new Promise((r) => setTimeout(r, 15000));
            continue;
          }
          throw err;
        }
        const dt = Date.now() - t0;
        stats.modelMs += dt;
        stats.steps++;
        stats.inputTokens += response.usage.input_tokens;
        stats.outputTokens += response.usage.output_tokens;
        stats.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;
        stats.cacheWriteTokens += response.usage.cache_creation_input_tokens ?? 0;
        opts.log(
          `step ${stats.steps}: ${dt}ms, stop=${response.stop_reason}, in=${response.usage.input_tokens} cache_read=${response.usage.cache_read_input_tokens ?? 0} cache_write=${response.usage.cache_creation_input_tokens ?? 0} out=${response.usage.output_tokens}`,
        );

        messages.push({ role: 'assistant', content: response.content });
        const said = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text.trim())
          .filter(Boolean)
          .join('\n');
        env.noteStep(dt, said);
        if (said) opts.log(`  model: ${said.slice(0, 160)}`);

        if (response.stop_reason === 'refusal') {
          env.stopReason = 'refusal';
          break;
        }

        const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
        if (toolUses.length === 0) {
          // Model thinks it is done or is chatting. Nudge with the current state.
          const s = await env.summary();
          if (s.sessionComplete) break;
          if (++nudges > 3) {
            env.stopReason = 'model_stopped';
            break;
          }
          messages.push({
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: (await env.screenshot()).toString('base64') } },
              { type: 'text', text: `The session is not finished. Current task (${s.taskIndex + 1}/${s.taskCount}): ${s.task?.instruction ?? ''}. Continue using the computer tool.` },
            ],
          });
          continue;
        }

        const results: Anthropic.ToolResultBlockParam[] = [];
        let failed = false;
        let lastSummary = null as Awaited<ReturnType<Env['summary']>> | null;
        const notes: string[] = [];
        for (const tu of toolUses) {
          if (failed) {
            results.push({ type: 'tool_result', tool_use_id: tu.id, toolset_name: 'computer', is_error: true, content: 'Not executed: an earlier computer action in this turn failed.' });
            continue;
          }
          if (await env.shouldStop()) {
            results.push({ type: 'tool_result', tool_use_id: tu.id, toolset_name: 'computer', content: 'Session ended.' });
            continue;
          }
          try {
            const input = (tu.input ?? {}) as Record<string, unknown>;
            const r = await env.perform(tu.name, input);
            lastSummary = r.summary;
            if (r.taskAdvanced) {
              notes.push(r.sessionComplete ? 'Task complete. The session is finished.' : `Task complete. Next task (${r.summary.taskIndex + 1}/${r.summary.taskCount}): ${r.summary.task?.instruction ?? ''}`);
            }
            if (r.image) {
              results.push({ type: 'tool_result', tool_use_id: tu.id, toolset_name: 'computer', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: r.image.toString('base64') } }] });
            } else {
              results.push({ type: 'tool_result', tool_use_id: tu.id, toolset_name: 'computer', content: r.text ?? 'OK' });
            }
          } catch (err) {
            failed = true;
            results.push({ type: 'tool_result', tool_use_id: tu.id, toolset_name: 'computer', is_error: true, content: `Error: ${err instanceof Error ? err.message : String(err)}` });
          }
        }

        // Attach a fresh screenshot (plus any task-change notes) to the last result of the batch.
        const last = results[results.length - 1];
        const lastHadImage = Array.isArray(last.content) && last.content.some((c) => c.type === 'image');
        if (opts.autoScreenshot && !lastHadImage) {
          const content: Anthropic.ToolResultBlockParam['content'] = [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: (await env.screenshot()).toString('base64') } },
          ];
          if (notes.length) content.push({ type: 'text', text: notes.join('\n') });
          else if (typeof last.content === 'string' && last.content !== 'OK') content.unshift({ type: 'text', text: last.content });
          last.content = content;
        } else if (notes.length) {
          const content = Array.isArray(last.content) ? last.content : [{ type: 'text' as const, text: String(last.content ?? 'OK') }];
          content.push({ type: 'text', text: notes.join('\n') });
          last.content = content;
        }
        void lastSummary;
        messages.push({ role: 'user', content: results });
      }

      const p = PRICES[opts.model];
      if (p) {
        stats.costUsd =
          (stats.inputTokens * p[0] + stats.outputTokens * p[1] + stats.cacheWriteTokens * p[2] + stats.cacheReadTokens * p[3]) / 1e6;
      }
      return stats;
    },
  };
}

/**
 * Replace older screenshots with a short text marker to bound token growth. Rewriting earlier turns invalidates the
 * prompt cache, so pruning only happens once `chunk` screenshots have accumulated beyond `keep`, and then prunes down to `keep`.
 */
function pruneImages(messages: Anthropic.MessageParam[], keep: number, chunk: number) {
  const slots: { arr: any[]; idx: number }[] = [];
  for (const m of messages) {
    if (m.role !== 'user' || !Array.isArray(m.content)) continue;
    for (const block of m.content) {
      if (block.type === 'image') slots.push({ arr: m.content as any[], idx: (m.content as any[]).indexOf(block) });
      if (block.type === 'tool_result' && Array.isArray(block.content)) {
        block.content.forEach((c, i) => {
          if (c.type === 'image') slots.push({ arr: block.content as any[], idx: i });
        });
      }
    }
  }
  if (slots.length <= keep + chunk) return;
  const toPrune = slots.slice(0, Math.max(0, slots.length - keep));
  for (const s of toPrune) s.arr[s.idx] = { type: 'text', text: '[earlier screenshot omitted]' };
}
