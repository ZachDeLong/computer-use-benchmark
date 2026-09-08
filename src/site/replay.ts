import type { RunFile, TraceAction } from '../core/run-file';
import { useStore } from '../desktop/store';

export interface ReplayView {
  /** Index of the next action to play. */
  index: number;
  total: number;
  playing: boolean;
  finished: boolean;
  /** Cursor position in desktop pixels, null before the first move. */
  cursor: { x: number; y: number } | null;
  /** Increments on every click so the ripple can re-trigger. */
  clickSerial: number;
  /** What the model said on the step in progress. */
  thought: string;
  thinking: boolean;
  /** Virtual elapsed ms of the original run. */
  elapsedMs: number;
  actionsDone: number;
  lastClass: string | null;
  /** Live classification per replayed action index, for comparison with the recording. */
  liveClasses: (string | null)[];
}

const CLICKS = new Set(['left_click', 'right_click', 'middle_click', 'double_click', 'triple_click']);
const COUNTED = new Set(['left_click', 'right_click', 'middle_click', 'double_click', 'triple_click', 'left_click_drag', 'left_mouse_down', 'left_mouse_up', 'scroll', 'type', 'key', 'hold_key']);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Replays a recorded run on the live desktop: re-dispatches every recorded action into the DOM at the recorded
 * coordinates, with the recorded timing, so the deterministic desktop reproduces the original session.
 */
export class ReplayController {
  view: ReplayView;
  speed = 1;
  private token = 0;
  private paused = false;
  private resume: (() => void) | null = null;
  private lastTarget: Element | null = null;
  private selectAll = false;
  private timer: number | null = null;
  private clock = { baseT: 0, baseWall: 0 };

  constructor(
    private run: RunFile,
    private getDesktop: () => HTMLElement | null,
    private onChange: (v: ReplayView) => void,
  ) {
    this.view = {
      index: 0,
      total: run.trace.actions.length,
      playing: false,
      finished: false,
      cursor: null,
      clickSerial: 0,
      thought: '',
      thinking: false,
      elapsedMs: 0,
      actionsDone: 0,
      lastClass: null,
      liveClasses: [],
    };
  }

  private emit(patch: Partial<ReplayView>) {
    this.view = { ...this.view, ...patch };
    this.onChange(this.view);
  }

  start() {
    this.stop();
    const token = ++this.token;
    const store = useStore.getState();
    store.init(this.run.session.seed, 'replay', this.run.session.taskCount);
    store.startSession();
    this.lastTarget = null;
    this.selectAll = false;
    this.paused = false;
    this.emit({ index: 0, finished: false, playing: true, cursor: null, thought: '', thinking: false, elapsedMs: 0, actionsDone: 0, lastClass: null, liveClasses: [] });
    this.setClock(0);
    this.timer = window.setInterval(() => {
      if (this.view.playing && !this.paused) this.emit({ elapsedMs: this.virtualNow() });
    }, 100);
    void this.loop(token);
  }

  stop() {
    this.token++;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.paused = false;
    this.resume?.();
    this.emit({ playing: false });
  }

  pause() {
    if (!this.view.playing || this.paused) return;
    this.paused = true;
    this.emit({ playing: false });
  }

  play() {
    if (this.view.finished) return this.start();
    if (!this.paused) return;
    this.paused = false;
    this.setClock(this.view.elapsedMs);
    this.emit({ playing: true });
    this.resume?.();
  }

  setSpeed(s: number) {
    this.setClock(this.virtualNow());
    this.speed = s;
  }

  private setClock(t: number) {
    this.clock = { baseT: t, baseWall: Date.now() };
  }
  private virtualNow(): number {
    if (this.paused) return this.clock.baseT;
    return this.clock.baseT + (Date.now() - this.clock.baseWall) * this.speed;
  }

  private async waitUntil(t: number, token: number) {
    while (this.token === token) {
      if (this.paused) {
        await new Promise<void>((r) => (this.resume = r));
        this.resume = null;
        continue;
      }
      const remaining = (t - this.virtualNow()) / this.speed;
      if (remaining <= 0) return;
      await sleep(Math.min(remaining, 100));
    }
  }

  private async loop(token: number) {
    const { actions, steps } = this.run.trace;
    let lastStep = 0;
    for (let i = 0; i < actions.length; i++) {
      if (this.token !== token) return;
      const a = actions[i];
      if (a.step !== lastStep) {
        const step = steps.find((s) => s.index === a.step);
        lastStep = a.step;
        this.emit({ thinking: true, thought: '' });
        if (step) {
          await this.waitUntil(step.t + step.modelMs, token);
          if (this.token !== token) return;
          this.emit({ thinking: false, thought: step.text });
        }
      }
      await this.waitUntil(a.t, token);
      if (this.token !== token) return;
      this.emit({ index: i, thinking: false });
      await this.execute(a, token);
      if (this.token !== token) return;
    }
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.emit({ index: actions.length, playing: false, finished: true, thinking: false });
  }

  private coord(a: TraceAction, key = 'coordinate'): { x: number; y: number } | null {
    const c = a.input[key];
    return Array.isArray(c) && c.length === 2 ? { x: Number(c[0]), y: Number(c[1]) } : null;
  }

  /**
   * Hit-test a desktop pixel. elementFromPoint only sees the viewport, and the stage is often partly scrolled out of
   * it, so when the point is off-screen the frame is pinned to the viewport corner for the duration of one synchronous
   * call (no paint happens in between, so nothing flashes).
   */
  private elementAt(x: number, y: number): Element | null {
    const el = this.getDesktop();
    const frame = el?.parentElement;
    if (!el || !frame) return null;
    const r = frame.getBoundingClientRect();
    const scale = r.width / 1280;
    const vx = r.left + x * scale;
    const vy = r.top + y * scale;
    if (vx >= 0 && vy >= 0 && vx < window.innerWidth && vy < window.innerHeight) {
      return document.elementFromPoint(vx, vy);
    }
    const saved = frame.getAttribute('style') ?? '';
    frame.style.position = 'fixed';
    frame.style.left = '0px';
    frame.style.top = '0px';
    frame.style.margin = '0';
    frame.style.zIndex = '100000';
    try {
      const r2 = frame.getBoundingClientRect();
      return document.elementFromPoint(r2.left + x * scale, r2.top + y * scale);
    } finally {
      frame.setAttribute('style', saved);
    }
  }

  private async execute(a: TraceAction, token: number) {
    const store = useStore.getState();
    const counted = COUNTED.has(a.name);
    const c = this.coord(a);
    if (c && (CLICKS.has(a.name) || a.name === 'mouse_move' || a.name === 'scroll' || a.name === 'left_click_drag')) {
      this.emit({ cursor: c });
      await sleep(Math.max(40, 160 / this.speed));
      if (this.token !== token) return;
    }
    if (counted) store.beginAction(a.name, describe(a));

    if (CLICKS.has(a.name) && c) {
      const el = this.elementAt(c.x, c.y);
      this.emit({ clickSerial: this.view.clickSerial + 1 });
      if (el) {
        const init = { bubbles: true, cancelable: true, clientX: 0, clientY: 0 };
        el.dispatchEvent(new MouseEvent('mousedown', init));
        el.dispatchEvent(new MouseEvent('mouseup', init));
        const clicks = a.name === 'double_click' ? 2 : a.name === 'triple_click' ? 3 : 1;
        for (let i = 0; i < clicks; i++) el.dispatchEvent(new MouseEvent('click', init));
        const field = el.closest('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null;
        if (field) {
          field.focus();
          if (field instanceof HTMLTextAreaElement) {
            // a click inside the text lands mid-body; clicks below the text land at the end
            field.setSelectionRange(field.value.length, field.value.length);
          }
        } else if (document.activeElement instanceof HTMLElement && el.closest('.window') !== document.activeElement.closest('.window')) {
          document.activeElement.blur();
        }
        this.lastTarget = field ?? el;
        this.selectAll = false;
      }
    } else if (a.name === 'type') {
      const field = this.activeField();
      if (field) {
        const text = String(a.input.text ?? '');
        setFieldValue(field, this.selectAll ? text : insertAtCaret(field, text));
        this.selectAll = false;
      }
    } else if (a.name === 'key' || a.name === 'hold_key') {
      const field = this.activeField();
      const combo = String(a.input.text ?? '').toLowerCase();
      if (field) {
        if (combo === 'ctrl+a' || combo === 'cmd+a' || combo === 'super+a') this.selectAll = true;
        else if (combo.endsWith('end')) field.setSelectionRange(field.value.length, field.value.length);
        else if (combo.endsWith('home')) field.setSelectionRange(0, 0);
        else if (combo === 'backspace') setFieldValue(field, field.value.slice(0, -1));
        else if (combo === 'return' || combo === 'enter') {
          if (field instanceof HTMLTextAreaElement) setFieldValue(field, insertAtCaret(field, '\n'));
        }
      }
    }

    await sleep(30);
    if (this.token !== token) return;
    if (counted) {
      const fx = store.endAction();
      const cls = fx?.record?.classification ?? null;
      const liveClasses = this.view.liveClasses.slice();
      liveClasses[this.view.index] = cls;
      this.emit({ actionsDone: this.view.actionsDone + 1, lastClass: cls, liveClasses });
    }
  }

  private activeField(): HTMLInputElement | HTMLTextAreaElement | null {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return active;
    if (this.lastTarget instanceof HTMLInputElement || this.lastTarget instanceof HTMLTextAreaElement) return this.lastTarget;
    return null;
  }
}

function insertAtCaret(field: HTMLInputElement | HTMLTextAreaElement, text: string): string {
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? field.value.length;
  return field.value.slice(0, start) + text + field.value.slice(end);
}

/** Set a controlled React input's value so its onChange fires. */
function setFieldValue(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.setSelectionRange(value.length, value.length);
}

export function describe(a: TraceAction): string {
  const c = Array.isArray(a.input.coordinate) ? `(${a.input.coordinate.join(', ')})` : '';
  if (a.name === 'type') return `type "${String(a.input.text ?? '')}"`;
  if (a.name === 'key' || a.name === 'hold_key') return `key ${String(a.input.text ?? '')}`;
  if (a.name === 'scroll') return `scroll ${String(a.input.scroll_direction ?? '')} ${c}`;
  if (a.name === 'screenshot') return 'screenshot';
  if (a.name === 'zoom') return 'zoom';
  return `${a.name.replace(/_/g, ' ')} ${c}`.trim();
}
