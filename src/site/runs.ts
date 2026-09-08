import type { RunFile } from '../core/run-file';

const modules = import.meta.glob('../data/runs/*.json', { eager: true }) as Record<string, { default: RunFile }>;

export const runs: RunFile[] = Object.entries(modules)
  .map(([path, m]) => ({ ...m.default, id: m.default.id ?? path.split('/').pop()!.replace(/\.json$/, '') }))
  .sort((a, b) => (b.metrics.capmModel ?? b.metrics.capmWall) - (a.metrics.capmModel ?? a.metrics.capmWall));

const MODEL_NAMES: Record<string, string> = {
  'claude-fable-5-1': 'Claude Fable 5.1',
  'claude-fable-5': 'Claude Fable 5',
  'claude-opus-5': 'Claude Opus 5',
  'claude-opus-4-8': 'Claude Opus 4.8',
  'claude-opus-4-7': 'Claude Opus 4.7',
  'claude-sonnet-5': 'Claude Sonnet 5',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
};

export function agentName(run: RunFile): string {
  if (run.model) return MODEL_NAMES[run.model] ?? run.model;
  if (run.agent === 'oracle') return 'Scripted oracle';
  if (run.agent === 'random') return 'Random clicks';
  return run.agent;
}

export function agentNote(run: RunFile): string {
  if (run.agent === 'oracle') return 'ceiling: minimum actions, no thinking time';
  if (run.agent === 'random') return 'floor';
  return run.effort ? `effort ${run.effort}` : '';
}

export function isModelRun(run: RunFile): boolean {
  return run.agent.startsWith('claude');
}

export function findRun(id: string): RunFile | undefined {
  return runs.find((r) => r.id === id);
}

/** The run shown on the landing page. */
export function featuredRun(): RunFile | undefined {
  return runs.find((r) => r.model === 'claude-opus-5') ?? runs.find(isModelRun) ?? runs[0];
}

export const fmt = {
  capm: (n: number | null) => (n === null ? 'n/a' : n.toFixed(1)),
  pct: (n: number | null) => (n === null ? 'n/a' : `${Math.round(n * 100)}%`),
  secs: (ms: number) => `${(ms / 1000).toFixed(0)}s`,
  clock: (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  },
  usd: (n: number | null) => (n === null ? 'n/a' : `$${n.toFixed(2)}`),
  date: (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
};

export interface LocalRun {
  seed: number;
  tasks: number;
  capm: number;
  wallMs: number;
  tasksCompleted: number;
  date: string;
}

const LOCAL_KEY = 'att:runs';

export function loadLocalRuns(): LocalRun[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as LocalRun[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalRun(run: LocalRun) {
  try {
    const all = [run, ...loadLocalRuns()].slice(0, 50);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}
