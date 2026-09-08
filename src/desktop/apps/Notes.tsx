import { useStore } from '../store';

export function NotesApp() {
  const notes = useStore((s) => s.desktop.notes);
  const select = useStore((s) => s.notesSelect);
  const setBody = useStore((s) => s.notesSetBody);
  const active = notes.list.find((n) => n.id === notes.activeId) ?? null;
  return (
    <div className="app notes">
      <div className="app-split">
        <ul className="list sidebar" data-testid="notes-list">
          {notes.list.map((n) => (
            <li key={n.id} className={`list-item ${n.id === notes.activeId ? 'is-active' : ''}`} data-testid={`note-${n.id}`} onClick={() => select(n.id)}>
              {n.title}
            </li>
          ))}
        </ul>
        <div className="pane pane-fill">
          {active ? (
            <>
              <div className="pane-title">{active.title}</div>
              <textarea className="note-body" data-testid="note-body" value={active.body} onChange={(e) => setBody(active.id, e.target.value)} />
            </>
          ) : (
            <div className="muted pane-empty">Select a note</div>
          )}
        </div>
      </div>
    </div>
  );
}
