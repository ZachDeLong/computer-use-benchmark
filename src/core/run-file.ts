import type { Metrics } from './score';
import type { SessionExport } from './session';

/** One executed action with its full input, as recorded by the harness. */
export interface TraceAction {
  step: number;
  name: string;
  input: Record<string, unknown>;
  /** ms since the harness environment started. */
  t: number;
  counted: boolean;
  classification: string | null;
  taskIndex: number;
}

/** One model round-trip. */
export interface TraceStep {
  index: number;
  t: number;
  modelMs: number;
  text: string;
}

export interface RunStats {
  modelMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number | null;
  steps: number;
  model?: string;
}

/** The JSON written to runs/ by the harness and bundled into the site under src/data/runs/. */
export interface RunFile {
  id: string;
  agent: string;
  model: string | null;
  effort: string | null;
  createdAt: string;
  args: Record<string, unknown>;
  stopReason: string | null;
  stats: RunStats | undefined;
  metrics: Metrics;
  session: SessionExport;
  trace: { steps: TraceStep[]; actions: TraceAction[] };
}
