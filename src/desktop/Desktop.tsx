import { useEffect, useState, type ReactElement } from 'react';
import { useStore } from './store';
import { APP_IDS, type AppId } from '../core/types';
import { SCREEN } from '../core/generate';
import { Window } from './Window';
import { Modal } from './Modal';
import { ContactsApp } from './apps/Contacts';
import { SettingsApp } from './apps/Settings';
import { NotesApp } from './apps/Notes';
import { FilesApp } from './apps/Files';

export const APP_META: Record<AppId, { title: string; color: string; component: () => ReactElement }> = {
  contacts: { title: 'Contacts', color: '#2f6fed', component: ContactsApp },
  settings: { title: 'Settings', color: '#6b7280', component: SettingsApp },
  notes: { title: 'Notes', color: '#d97706', component: NotesApp },
  files: { title: 'Files', color: '#059669', component: FilesApp },
};

function useClock(interval = 200) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setT((x) => x + 1), interval);
    return () => window.clearInterval(id);
  }, [interval]);
}

function TopBar() {
  useClock();
  const session = useStore((s) => s.session);
  const desktop = useStore((s) => s.desktop);
  const flashUntil = useStore((s) => s.flashUntil);
  if (!session) return null;
  const sum = session.summary(desktop, Date.now());
  const secs = Math.floor(sum.elapsedMs / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const flashing = Date.now() < flashUntil;
  return (
    <div className="topbar" data-testid="topbar">
      <div className="topbar-left">
        <div className="topbar-task">
          Task {Math.min(sum.taskIndex + 1, sum.taskCount)} of {sum.taskCount}
        </div>
        <div className="topbar-instruction" data-testid="instruction">
          {sum.task?.instruction ?? 'Done'}
        </div>
      </div>
      <div className="topbar-right">
        {flashing && <span className="topbar-flash">Task complete</span>}
        <div className="topbar-progress" title="progress">
          <div className="topbar-progress-fill" style={{ width: `${Math.round(sum.progress * 100)}%` }} />
        </div>
        <div className="topbar-time" data-testid="timer">
          {mm}:{ss}
        </div>
      </div>
    </div>
  );
}

function Taskbar() {
  const order = useStore((s) => s.desktop.taskbarOrder);
  const windows = useStore((s) => s.desktop.windows);
  const focused = useStore((s) => s.desktop.focused);
  const openApp = useStore((s) => s.openApp);
  return (
    <div className="taskbar" data-testid="taskbar">
      {order.map((app) => {
        const m = APP_META[app];
        const cls = ['taskbar-btn', windows[app].open ? 'is-open' : '', focused === app ? 'is-focused' : ''].join(' ');
        return (
          <button key={app} className={cls} data-testid={`taskbar-${app}`} onClick={() => openApp(app)}>
            <span className="taskbar-dot" style={{ background: m.color }} />
            {m.title}
          </button>
        );
      })}
    </div>
  );
}

export function Desktop() {
  const windows = useStore((s) => s.desktop.windows);
  const modal = useStore((s) => s.desktop.modal);
  return (
    <div className="desktop" style={{ width: SCREEN.w, height: SCREEN.h }} data-testid="desktop">
      <TopBar />
      <div className="desktop-area">
        {APP_IDS.filter((a) => windows[a].open).map((app) => (
          <Window key={app} app={app} />
        ))}
      </div>
      <Taskbar />
      {modal && <Modal modal={modal} />}
    </div>
  );
}
