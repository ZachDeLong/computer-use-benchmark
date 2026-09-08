import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { computeMetrics, formatMetrics } from '../core/score';
import { Env } from './env';
import { claudeAgent } from './agents/claude';
import { oracleAgent } from './agents/oracle';
import { randomAgent } from './agents/random';
import type { Agent } from './agents/types';

interface Args {
  agent: string;
  seed: number;
  tasks: number;
  model: string;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  maxSteps: number;
  maxActions: number;
  timeLimit: number; // seconds
  headed: boolean;
  keepImages: number;
  autoScreenshot: boolean;
  out: string;
  url?: string;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    agent: 'oracle',
    seed: 42,
    tasks: 8,
    model: 'claude-opus-5',
    maxSteps: 80,
    maxActions: 150,
    timeLimit: 600,
    headed: false,
    keepImages: 3,
    autoScreenshot: true,
    out: 'runs',
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    const take = () => {
      i++;
      return v;
    };
    switch (k) {
      case '--agent':
        a.agent = take();
        break;
      case '--seed':
        a.seed = Number(take());
        break;
      case '--tasks':
        a.tasks = Number(take());
        break;
      case '--model':
        a.model = take();
        break;
      case '--effort':
        a.effort = take() as Args['effort'];
        break;
      case '--max-steps':
        a.maxSteps = Number(take());
        break;
      case '--max-actions':
        a.maxActions = Number(take());
        break;
      case '--time-limit':
        a.timeLimit = Number(take());
        break;
      case '--keep-images':
        a.keepImages = Number(take());
        break;
      case '--no-auto-screenshot':
        a.autoScreenshot = false;
        break;
      case '--headed':
        a.headed = true;
        break;
      case '--out':
        a.out = take();
        break;
      case '--url':
        a.url = take();
        break;
      default:
        throw new Error(`Unknown arg ${k}`);
    }
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const log = (line: string) => console.log(line);

  let agent: Agent;
  if (args.agent === 'oracle') agent = oracleAgent();
  else if (args.agent === 'random') agent = randomAgent(args.seed);
  else if (args.agent === 'claude')
    agent = claudeAgent({ model: args.model, effort: args.effort, autoScreenshot: args.autoScreenshot, keepImages: args.keepImages, maxSteps: args.maxSteps, log });
  else throw new Error(`Unknown agent ${args.agent}`);

  let server: Awaited<ReturnType<typeof createServer>> | null = null;
  let base = args.url;
  if (!base) {
    server = await createServer({ configFile: 'vite.config.ts', server: { port: 0 }, logLevel: 'silent' });
    await server.listen();
    base = server.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? 'http://localhost:5173';
  }

  const browser = await chromium.launch({ headless: !args.headed });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const url = `${base}/?mode=agent&seed=${args.seed}&tasks=${args.tasks}`;
  await page.goto(url);
  await page.waitForFunction(() => window.__oracle && window.__oracle.summary().started);

  const env = new Env(page, { settleMs: 120, deadlineMs: args.timeLimit * 1000, maxActions: args.maxActions, log });
  const first = await env.summary();
  log(`agent=${agent.name} seed=${args.seed} tasks=${first.taskCount} url=${url}`);
  log(`task 1: ${first.task?.instruction}`);

  const wallStart = Date.now();
  let stats;
  try {
    stats = await agent.run(env);
  } finally {
    const wallMs = Date.now() - wallStart;
    const exp = await env.export();
    const metrics = computeMetrics(exp, {
      wallMs,
      modelMs: stats?.modelMs,
      inputTokens: stats ? stats.inputTokens + stats.cacheReadTokens + stats.cacheWriteTokens : undefined,
      outputTokens: stats?.outputTokens,
      costUsd: stats?.costUsd ?? undefined,
      steps: stats?.steps,
    });
    log('');
    log(`stop reason: ${env.stopReason ?? 'unknown'}`);
    log(formatMetrics(metrics));
    fs.mkdirSync(args.out, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(args.out, `${stamp}-${agent.name.replace(/[^a-z0-9.-]/gi, '_')}-seed${args.seed}.json`);
    const model = args.agent === 'claude' ? args.model : null;
    fs.writeFileSync(
      file,
      JSON.stringify(
        { id: path.basename(file, '.json'), agent: agent.name, model, effort: args.effort ?? null, createdAt: new Date().toISOString(), args, stopReason: env.stopReason, stats, metrics, session: exp, trace: { steps: env.steps, actions: env.trace } },
        null,
        2,
      ),
    );
    log(`saved ${file}`);
    await browser.close();
    if (server) await server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
