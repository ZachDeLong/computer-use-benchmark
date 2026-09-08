import { useStore } from './store';
import type { AppId } from '../core/types';
import { APP_META } from './Desktop';

export function Window({ app }: { app: AppId }) {
  const win = useStore((s) => s.desktop.windows[app]);
  const focused = useStore((s) => s.desktop.focused === app);
  const focusApp = useStore((s) => s.focusApp);
  const closeApp = useStore((s) => s.closeApp);
  const meta = APP_META[app];
  const Body = meta.component;
  return (
    <div
      className={`window ${focused ? 'is-focused' : ''}`}
      style={{ left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }}
      data-testid={`window-${app}`}
      onMouseDown={() => focusApp(app)}
    >
      <div className="window-title" style={{ background: focused ? meta.color : undefined }}>
        <span>{meta.title}</span>
        <button
          className="window-close"
          data-testid={`close-${app}`}
          aria-label={`Close ${meta.title}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => closeApp(app)}
        >
          ×
        </button>
      </div>
      <div className="window-body">
        <Body />
      </div>
    </div>
  );
}
