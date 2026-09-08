import { computeProgress, generateSessionPlan, type SessionPlan } from './tasks';
import type { ActionClass, ActionRecord, DesktopState, ModalState, SessionSummary, Task, TaskResult } from './types';

export interface ActionEffects {
  record: ActionRecord | null;
  showModal: ModalState | null;
  taskAdvanced: boolean;
  sessionComplete: boolean;
}

export interface SessionExport {
  seed: number;
  mode: 'human' | 'agent';
  taskCount: number;
  startedAt: number | null;
  endedAt: number | null;
  tasks: TaskResult[];
  actions: ActionRecord[];
  distractions: { taskIndex: number; afterAction: number; id: string; shown: boolean }[];
}

/**
 * Pure session state machine. Owns task sequencing, per-action classification and distraction scheduling.
 * The host (desktop store or harness) feeds it DesktopState snapshots and applies returned effects.
 */
export class Session {
  readonly plan: SessionPlan;
  readonly mode: 'human' | 'agent';
  readonly results: TaskResult[] = [];
  readonly actions: ActionRecord[] = [];
  private shownDistractions = new Set<number>();
  taskIndex = 0;
  startedAt: number | null = null;
  endedAt: number | null = null;
  private lastProgress = 0;
  private lastModalOpen = false;
  private actionsInTask = 0;
  private pending: { kind: string; detail?: string; progressBefore: number; modalBefore: boolean; t: number } | null = null;

  constructor(seed: number, mode: 'human' | 'agent', taskCount: number) {
    this.plan = generateSessionPlan(seed, taskCount);
    this.mode = mode;
  }

  get initialState(): DesktopState {
    return this.plan.initial;
  }
  get started(): boolean {
    return this.startedAt !== null;
  }
  get complete(): boolean {
    return this.endedAt !== null;
  }
  get currentTask(): Task | null {
    return this.complete ? null : this.plan.tasks[this.taskIndex] ?? null;
  }

  start(state: DesktopState, now: number) {
    if (this.started) return;
    this.startedAt = now;
    this.beginTask(state, now);
  }

  private beginTask(state: DesktopState, now: number) {
    const task = this.plan.tasks[this.taskIndex];
    this.results.push({
      index: this.taskIndex,
      id: task.id,
      kind: task.kind,
      instruction: task.instruction,
      minActions: task.minActions(state),
      actions: 0,
      completed: false,
      finalProgress: computeProgress(task, state).progress,
      startedAt: now,
      endedAt: null,
      distractionsShown: 0,
    });
    this.actionsInTask = 0;
    this.lastProgress = computeProgress(task, state).progress;
    this.lastModalOpen = state.modal !== null;
  }

  progress(state: DesktopState): number {
    const t = this.currentTask;
    return t ? computeProgress(t, state).progress : 1;
  }

  /** Mark the start of a harness-level action. */
  beginAction(kind: string, detail: string | undefined, now: number) {
    if (this.complete || !this.started) return;
    if (this.pending) return; // already inside an action (typing burst)
    this.pending = { kind, detail, progressBefore: this.lastProgress, modalBefore: this.lastModalOpen, t: now - (this.startedAt ?? now) };
  }

  hasPendingAction(): boolean {
    return this.pending !== null;
  }

  /** Finish the pending action against the settled state. Returns effects for the host to apply. */
  endAction(state: DesktopState, now: number): ActionEffects {
    const none: ActionEffects = { record: null, showModal: null, taskAdvanced: false, sessionComplete: this.complete };
    if (!this.pending || this.complete) return none;
    const task = this.currentTask!;
    const result = this.results[this.results.length - 1];
    const p = this.pending;
    this.pending = null;

    const { progress: after, complete } = computeProgress(task, state);
    const modalAfter = state.modal !== null;
    let cls: ActionClass;
    if (p.modalBefore && !modalAfter) cls = 'recovery';
    else if (p.modalBefore && modalAfter) cls = 'wasted';
    else if (after > p.progressBefore + 1e-9) cls = 'progress';
    else if (after < p.progressBefore - 1e-9) cls = 'regress';
    else cls = 'neutral';

    this.actionsInTask++;
    result.actions = this.actionsInTask;
    result.finalProgress = after;
    const record: ActionRecord = {
      taskIndex: this.taskIndex,
      actionIndex: this.actionsInTask,
      kind: p.kind,
      detail: p.detail,
      progressBefore: p.progressBefore,
      progressAfter: after,
      classification: cls,
      modalBefore: p.modalBefore,
      modalAfter,
      t: p.t,
    };
    this.actions.push(record);
    this.lastProgress = after;
    this.lastModalOpen = modalAfter;

    if (complete) {
      result.completed = true;
      result.finalProgress = 1;
      result.endedAt = now;
      this.taskIndex++;
      if (this.taskIndex >= this.plan.tasks.length) {
        this.endedAt = now;
        return { record, showModal: null, taskAdvanced: true, sessionComplete: true };
      }
      this.beginTask(state, now);
      return { record, showModal: null, taskAdvanced: true, sessionComplete: false };
    }

    // distraction scheduling
    let showModal: ModalState | null = null;
    if (!modalAfter) {
      this.plan.distractions.forEach((d, i) => {
        if (!this.shownDistractions.has(i) && d.taskIndex === this.taskIndex && d.afterAction === this.actionsInTask) {
          this.shownDistractions.add(i);
          showModal = d.modal;
          result.distractionsShown++;
          this.lastModalOpen = true;
        }
      });
    }
    return { record, showModal, taskAdvanced: false, sessionComplete: false };
  }

  /** Human mode: called on every state change during a typing burst so completion is detected immediately. */
  checkComplete(state: DesktopState, now: number): ActionEffects | null {
    if (!this.pending || this.complete) return null;
    const task = this.currentTask!;
    if (!computeProgress(task, state).complete) return null;
    return this.endAction(state, now);
  }

  summary(state: DesktopState, now: number): SessionSummary {
    const task = this.currentTask;
    const result = this.results[this.results.length - 1];
    return {
      seed: this.plan.seed,
      mode: this.mode,
      taskCount: this.plan.tasks.length,
      taskIndex: this.taskIndex,
      task: task ? { id: task.id, kind: task.kind, instruction: task.instruction, minActions: result?.minActions ?? task.minActions(state), meta: task.meta } : null,
      progress: this.progress(state),
      actionCount: this.actionsInTask,
      modalOpen: state.modal !== null,
      started: this.started,
      sessionComplete: this.complete,
      elapsedMs: this.startedAt === null ? 0 : (this.endedAt ?? now) - this.startedAt,
    };
  }

  export(): SessionExport {
    return {
      seed: this.plan.seed,
      mode: this.mode,
      taskCount: this.plan.tasks.length,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      tasks: this.results.map((r) => ({ ...r })),
      actions: this.actions.map((a) => ({ ...a })),
      distractions: this.plan.distractions.map((d, i) => ({ taskIndex: d.taskIndex, afterAction: d.afterAction, id: d.modal.id, shown: this.shownDistractions.has(i) })),
    };
  }
}
