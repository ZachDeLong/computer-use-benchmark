import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Scales the fixed 1280x800 desktop to the container width. `interactive: false` swallows real pointer and keyboard
 * events so viewers cannot disturb a replay, while synthetic replay events (isTrusted === false) still get through.
 */
export function Stage({ children, interactive = true, desktopRef }: { children: ReactNode; interactive?: boolean; desktopRef?: (el: HTMLDivElement | null) => void }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, el.clientWidth / 1280));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = outer.current;
    if (!el || interactive) return;
    const block = (e: Event) => {
      if (e.isTrusted) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    const events = ['mousedown', 'mouseup', 'click', 'dblclick', 'keydown', 'keyup', 'keypress', 'wheel', 'touchstart'];
    for (const ev of events) el.addEventListener(ev, block, { capture: true, passive: false });
    return () => {
      for (const ev of events) el.removeEventListener(ev, block, { capture: true });
    };
  }, [interactive]);

  return (
    <div className={`stage ${interactive ? '' : 'stage-locked'}`} ref={outer}>
      <div className="stage-frame" style={{ width: Math.round(1280 * scale), height: Math.round(800 * scale) }}>
        <div className="stage-scaled" ref={desktopRef} style={{ transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
