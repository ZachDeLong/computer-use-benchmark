import type { Env } from '../env';

export interface AgentStats {
  /** ms spent waiting on the model. */
  modelMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number | null;
  /** Model round-trips. */
  steps: number;
  model?: string;
}

export interface Agent {
  name: string;
  run(env: Env): Promise<AgentStats>;
}

export const emptyStats = (): AgentStats => ({
  modelMs: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  costUsd: null,
  steps: 0,
});
