import type { Page } from 'playwright';
import type { SessionExport } from '../core/session';
import type { DesktopState, SessionSummary } from '../core/types';
import { COUNTED_ACTIONS, Executor, type ActionInput } from './executor';

export interface PerformResult {
  text?: string;
  image?: Buffer;
  /** Oracle classification when the action counted. */
  classification: string | null;
  taskAdvanced: boolean;
  sessionComplete: boolean;
  modalShown: boolean;
  summary: SessionSummary;
}

export interface TraceAction {
  step: number;
  name: string;
  input: Record<string, unknown>;
  /** ms since the env started. */
  t: number;
  counted: boolean;
  classification: string | null;
  taskIndex: number;
}

export interface TraceStep {
  index: number;
  /** ms since the env started when the model was called. */
  t: number;
  modelMs: number;
  text: string;
}

export interface EnvOptions {
  /** ms to let React settle after an action before the oracle classifies it. */
  settleMs: number;
  deadlineMs: number;
  maxActions: number;
  log: (line: string) => void;
}

/** The environment an agent operates: executes actions, records them with the page oracle, tracks limits. */
export class Env {
  readonly executor: Executor;
  readonly startedAt = Date.now();
  actionsPerformed = 0;
  stopReason: string | null = null;
  /** Every action executed, with full inputs, for replays. */
  readonly trace: TraceAction[] = [];
  /** Model round-trips (agents that have one). */
  readonly steps: TraceStep[] = [];
  currentStep = 0;

  constructor(
    readonly page: Page,
    readonly opts: EnvOptions,
  ) {
    this.executor = new Executor(page, { width: 1280, height: 800 });
  }

  get elapsedMs(): number {
    return Date.now() - this.startedAt;
  }
  noteStep(modelMs: number, text: string) {
    this.currentStep++;
    this.steps.push({ index: this.currentStep, t: this.elapsedMs - modelMs, modelMs, text });
  }

  get timeLeftMs(): number {
    return this.opts.deadlineMs - (Date.now() - this.startedAt);
  }

  async summary(): Promise<SessionSummary> {
    return this.page.evaluate(() => window.__oracle.summary());
  }
  async state(): Promise<DesktopState> {
    return this.page.evaluate(() => window.__oracle.state());
  }
  async export(): Promise<SessionExport> {
    return this.page.evaluate(() => window.__oracle.export());
  }
  async screenshot(): Promise<Buffer> {
    return this.executor.screenshot();
  }

  /** Returns true if the agent should stop (session complete, out of time, or action cap). */
  async shouldStop(): Promise<boolean> {
    if (this.stopReason) return true;
    const s = await this.summary();
    if (s.sessionComplete) this.stopReason = 'complete';
    else if (this.timeLeftMs <= 0) this.stopReason = 'time_limit';
    else if (this.actionsPerformed >= this.opts.maxActions) this.stopReason = 'action_limit';
    return this.stopReason !== null;
  }

  async perform(name: string, input: ActionInput): Promise<PerformResult> {
    const counted = COUNTED_ACTIONS.has(name);
    const detail = describe(name, input);
    const t = this.elapsedMs;
    const before = await this.summary();
    if (counted) {
      await this.page.evaluate(([k, d]) => window.__oracle.beginAction(k, d), [name, detail] as const);
    }
    const out = await this.executor.execute(name, input);
    let classification: string | null = null;
    let taskAdvanced = false;
    let sessionComplete = false;
    let modalShown = false;
    if (counted) {
      await this.page.waitForTimeout(this.opts.settleMs);
      const r = await this.page.evaluate(() => window.__oracle.endAction());
      classification = r.classification;
      taskAdvanced = r.taskAdvanced;
      sessionComplete = r.sessionComplete;
      modalShown = r.modalShown;
      this.actionsPerformed++;
      this.opts.log(`  ${detail.padEnd(48)} -> ${classification ?? '?'}${taskAdvanced ? '  [task complete]' : ''}${modalShown ? '  [popup]' : ''}`);
    }
    const summary = await this.summary();
    this.trace.push({ step: this.currentStep, name, input, t, counted, classification, taskIndex: before.taskIndex });
    return { ...out, classification, taskAdvanced, sessionComplete, modalShown, summary };
  }
}

function describe(name: string, input: ActionInput): string {
  const c = Array.isArray(input.coordinate) ? `(${input.coordinate.join(',')})` : '';
  if (name === 'type') return `type "${String(input.text ?? '').slice(0, 30)}"`;
  if (name === 'key' || name === 'hold_key') return `key ${String(input.text ?? '')}`;
  if (name === 'scroll') return `scroll ${String(input.scroll_direction ?? '')} ${c}`;
  return `${name} ${c}`.trim();
}
