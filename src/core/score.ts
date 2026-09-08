import type { SessionExport } from './session';
import type { ActionClass } from './types';

export interface Timing {
  /** Wall-clock ms for the whole session (session start to end or cutoff). */
  wallMs: number;
  /** Ms spent waiting on the model (agents only). */
  modelMs?: number;
  /** Total input tokens including cache reads and writes. */
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  steps?: number;
}

export interface Metrics {
  seed: number;
  mode: 'human' | 'agent';
  /** Correct Actions per Minute, denominated in model time (null for humans). */
  capmModel: number | null;
  /** Correct Actions per Minute, denominated in wall-clock time. */
  capmWall: number;
  /** Sum over tasks of minActions * finalProgress, plus one per dismissed distraction. The numerator of CAPM. */
  credit: number;
  taskCount: number;
  tasksCompleted: number;
  successRate: number;
  actionsTotal: number;
  /** minActions / (actions taken - forced recoveries), over completed tasks. */
  efficiency: number | null;
  /** (regress + wasted) / actions. */
  errorRate: number;
  classes: Record<ActionClass, number>;
  distractionsShown: number;
  distractionsRecovered: number;
  meanActionsToRecover: number | null;
  taskTimesMs: number[];
  medianTaskMs: number | null;
  wallMs: number;
  modelMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  steps: number | null;
}

export function computeMetrics(exp: SessionExport, timing: Timing): Metrics {
  const classes: Record<ActionClass, number> = { progress: 0, neutral: 0, regress: 0, wasted: 0, recovery: 0 };
  for (const a of exp.actions) classes[a.classification]++;
  const credit = exp.tasks.reduce((s, t) => s + t.minActions * (t.completed ? 1 : t.finalProgress), 0) + classes.recovery;
  const completed = exp.tasks.filter((t) => t.completed);
  const actionsTotal = exp.actions.length;
  const wallMin = Math.max(timing.wallMs, 1) / 60000;
  const modelMin = timing.modelMs !== undefined ? Math.max(timing.modelMs, 1) / 60000 : null;

  // recovery: count wasted actions immediately preceding each recovery within the same task, plus the recovery itself
  const toRecover: number[] = [];
  exp.actions.forEach((a, i) => {
    if (a.classification !== 'recovery') return;
    let n = 1;
    for (let j = i - 1; j >= 0 && exp.actions[j].taskIndex === a.taskIndex && exp.actions[j].classification === 'wasted'; j--) n++;
    toRecover.push(n);
  });
  const taskTimesMs = completed.map((t) => (t.endedAt ?? t.startedAt) - t.startedAt);
  const sorted = [...taskTimesMs].sort((a, b) => a - b);
  const medianTaskMs = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  const recoveriesIn = (idx: number) => exp.actions.filter((a) => a.taskIndex === idx && a.classification === 'recovery').length;
  const completedActions = completed.reduce((s, t) => s + t.actions - recoveriesIn(t.index), 0);
  const completedMin = completed.reduce((s, t) => s + t.minActions, 0);

  return {
    seed: exp.seed,
    mode: exp.mode,
    capmModel: modelMin !== null ? credit / modelMin : null,
    capmWall: credit / wallMin,
    credit,
    taskCount: exp.taskCount,
    tasksCompleted: completed.length,
    successRate: exp.taskCount ? completed.length / exp.taskCount : 0,
    actionsTotal,
    efficiency: completedActions > 0 ? completedMin / completedActions : null,
    errorRate: actionsTotal ? (classes.regress + classes.wasted) / actionsTotal : 0,
    classes,
    distractionsShown: exp.distractions.filter((d) => d.shown).length,
    distractionsRecovered: classes.recovery,
    meanActionsToRecover: toRecover.length ? toRecover.reduce((a, b) => a + b, 0) / toRecover.length : null,
    taskTimesMs,
    medianTaskMs,
    wallMs: timing.wallMs,
    modelMs: timing.modelMs ?? null,
    inputTokens: timing.inputTokens ?? null,
    outputTokens: timing.outputTokens ?? null,
    costUsd: timing.costUsd ?? null,
    steps: timing.steps ?? null,
  };
}

export function formatMetrics(m: Metrics): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const rows: [string, string][] = [
    ['CAPM (model time)', m.capmModel === null ? 'n/a' : m.capmModel.toFixed(1)],
    ['CAPM (wall time)', m.capmWall.toFixed(1)],
    ['Credit (sum minActions x progress)', m.credit.toFixed(1)],
    ['Tasks completed', `${m.tasksCompleted}/${m.taskCount} (${pct(m.successRate)})`],
    ['Actions', String(m.actionsTotal)],
    ['Efficiency (min/actual)', m.efficiency === null ? 'n/a' : pct(m.efficiency)],
    ['Error rate', pct(m.errorRate)],
    ['Action classes', `progress ${m.classes.progress}, neutral ${m.classes.neutral}, regress ${m.classes.regress}, wasted ${m.classes.wasted}, recovery ${m.classes.recovery}`],
    ['Distractions', `${m.distractionsRecovered}/${m.distractionsShown} recovered${m.meanActionsToRecover !== null ? `, ${m.meanActionsToRecover.toFixed(1)} actions each` : ''}`],
    ['Median task time', m.medianTaskMs === null ? 'n/a' : `${(m.medianTaskMs / 1000).toFixed(1)}s`],
    ['Wall time', `${(m.wallMs / 1000).toFixed(1)}s`],
    ['Model time', m.modelMs === null ? 'n/a' : `${(m.modelMs / 1000).toFixed(1)}s`],
    ['Tokens (in/out)', m.inputTokens === null ? 'n/a' : `${m.inputTokens}/${m.outputTokens}`],
    ['Cost', m.costUsd === null ? 'n/a' : `$${m.costUsd.toFixed(4)}`],
    ['Model steps', m.steps === null ? 'n/a' : String(m.steps)],
  ];
  const w = Math.max(...rows.map((r) => r[0].length));
  return rows.map(([k, v]) => `${k.padEnd(w)}  ${v}`).join('\n');
}
