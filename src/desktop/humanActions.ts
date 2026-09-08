import { useStore } from './store';

/**
 * Infers harness-level actions from DOM events in human mode:
 *  - mousedown            => one 'click' action
 *  - Enter/Tab/Escape     => one 'key' action
 *  - a run of keystrokes in the same text field => one 'type' action (committed on click, special key, blur or idle)
 *
 * Actions end after React has applied the event (deferred with setTimeout). Each begun action gets a sequence id so a
 * deferred end only closes the action it was scheduled for; a newer action flushes an older one synchronously.
 */
export function installHumanActionTracker(): () => void {
  let seq = 0;
  let burstEl: Element | null = null;
  let burstId = 0;
  let idleTimer: number | null = null;

  const running = () => useStore.getState().phase === 'running';
  const isTextField = (el: EventTarget | null) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

  const describe = (el: Element | null) => {
    if (!el) return undefined;
    const t = el.closest('[data-testid]');
    return t?.getAttribute('data-testid') ?? el.tagName.toLowerCase();
  };

  /** End whatever is pending, then begin a new action. Returns its id. */
  const begin = (kind: string, detail?: string): number => {
    const store = useStore.getState();
    if (store.session?.hasPendingAction()) store.endAction();
    store.beginAction(kind, detail);
    return ++seq;
  };

  const endIf = (id: number) => {
    if (seq !== id) return;
    useStore.getState().endAction();
  };

  const clearBurst = () => {
    burstEl = null;
    if (idleTimer !== null) {
      window.clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const commitBurst = () => {
    if (!burstEl) return;
    const id = burstId;
    clearBurst();
    endIf(id);
  };

  const onMouseDown = (e: MouseEvent) => {
    if (!running()) return;
    commitBurst();
    const id = begin('click', describe(e.target as Element));
    window.setTimeout(() => endIf(id), 0);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!running()) return;
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape') {
      commitBurst();
      const id = begin('key', e.key);
      window.setTimeout(() => endIf(id), 0);
      return;
    }
    if (!isTextField(e.target)) return;
    const el = e.target as Element;
    if (burstEl !== el) {
      commitBurst();
      burstEl = el;
      burstId = begin('type', describe(el));
    }
    if (idleTimer !== null) window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(commitBurst, 1500);
    // completion is checked after React applies the keystroke; a completed task closes the burst immediately
    window.setTimeout(() => {
      if (useStore.getState().checkComplete()) clearBurst();
    }, 0);
  };

  const onFocusOut = (e: FocusEvent) => {
    if (burstEl && e.target === burstEl) commitBurst();
  };

  document.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('focusout', onFocusOut, true);
  return () => {
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('focusout', onFocusOut, true);
  };
}
