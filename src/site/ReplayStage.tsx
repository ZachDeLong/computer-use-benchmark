import { useEffect, useMemo, useRef, useState } from 'react';
import type { RunFile } from '../core/run-file';
import { Desktop } from '../desktop/Desktop';
import { ReplayController, type ReplayView } from './replay';
import { Stage } from './Stage';

export interface ReplayHandle {
  view: ReplayView;
  play: () => void;
  pause: () => void;
  restart: () => void;
  setSpeed: (s: number) => void;
  speed: number;
}

/** The desktop with a replay cursor over it. Reports playback state through `onView`. */
export function ReplayStage({ run, autoplay = true, loop = false, speed = 1, onHandle }: { run: RunFile; autoplay?: boolean; loop?: boolean; speed?: number; onHandle?: (h: ReplayHandle) => void }) {
  const desktopEl = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<ReplayView | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState(speed);
  const controller = useMemo(() => new ReplayController(run, () => desktopEl.current, setView), [run]);

  useEffect(() => {
    controller.setSpeed(speed);
    setCurrentSpeed(speed);
    if (autoplay) controller.start();
    return () => controller.stop();
  }, [controller, autoplay, speed]);

  useEffect(() => {
    if (!loop || !view?.finished) return;
    const id = window.setTimeout(() => controller.start(), 3500);
    return () => window.clearTimeout(id);
  }, [loop, view?.finished, controller]);

  useEffect(() => {
    if (!onHandle || !view) return;
    onHandle({
      view,
      play: () => controller.play(),
      pause: () => controller.pause(),
      restart: () => controller.start(),
      setSpeed: (s) => {
        controller.setSpeed(s);
        setCurrentSpeed(s);
      },
      speed: currentSpeed,
    });
  }, [view, onHandle, controller, currentSpeed]);

  return (
    <Stage interactive={false} desktopRef={(el) => (desktopEl.current = el)}>
      <Desktop />
      {view?.cursor && (
        <div className="replay-cursor" style={{ transform: `translate(${view.cursor.x}px, ${view.cursor.y}px)` }}>
          <span key={view.clickSerial} className={`replay-ripple ${view.clickSerial ? 'is-on' : ''}`} />
          <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden="true">
            <path d="M2 2 L2 20 L7 15.5 L10.5 23 L14 21.5 L10.5 14 L17 14 Z" fill="#fff" stroke="#111827" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      {view?.thinking && <div className="replay-thinking">thinking</div>}
    </Stage>
  );
}
