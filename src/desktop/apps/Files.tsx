import { useStore } from '../store';
import type { FileEntry, FileSortKey } from '../../core/types';

const COLUMNS: { key: FileSortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'folder', label: 'Folder' },
  { key: 'sizeKb', label: 'Size' },
  { key: 'modified', label: 'Modified' },
];

function fmtSize(kb: number) {
  return kb < 1000 ? `${kb} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

function sortFiles(list: FileEntry[], key: FileSortKey | null, dir: 'asc' | 'desc') {
  if (!key) return list;
  const s = [...list].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return dir === 'asc' ? c : -c;
  });
  return s;
}

export function FilesApp() {
  const files = useStore((s) => s.desktop.files);
  const labels = useStore((s) => s.desktop.labels);
  const toggle = useStore((s) => s.filesToggleSelect);
  const sort = useStore((s) => s.filesSort);
  const picker = useStore((s) => s.filesMovePicker);
  const moveTo = useStore((s) => s.filesMoveTo);
  const rows = sortFiles(files.list, files.sortBy, files.sortDir);

  return (
    <div className="app files">
      <div className="app-toolbar">
        <div className="dropdown">
          <button
            className="btn"
            data-testid="files-move"
            disabled={files.selected.length === 0}
            onClick={() => picker(!files.movePickerOpen)}
          >
            {labels.filesMove}
          </button>
          {files.movePickerOpen && (
            <ul className="dropdown-menu" data-testid="files-move-menu">
              {files.folders.map((f) => (
                <li key={f} className="dropdown-item" data-testid={`files-move-${f}`} onClick={() => moveTo(f)}>
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
        <span className="muted">{files.selected.length ? `${files.selected.length} selected` : `${files.list.length} items`}</span>
      </div>
      <div className="table-wrap">
        <table className="table" data-testid="files-table">
          <thead>
            <tr>
              <th className="th-check" />
              {COLUMNS.map((c) => (
                <th key={c.key} className="th-sort" data-testid={`files-sort-${c.key}`} onClick={() => sort(c.key)}>
                  {c.label}
                  {files.sortBy === c.key && <span className="sort-arrow">{files.sortDir === 'asc' ? ' ^' : ' v'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const sel = files.selected.includes(f.id);
              return (
                <tr key={f.id} className={sel ? 'is-selected' : ''} data-testid={`file-${f.id}`} onClick={() => toggle(f.id)}>
                  <td className="td-check">
                    <span className={`checkbox ${sel ? 'is-checked' : ''}`}>{sel ? 'x' : ''}</span>
                  </td>
                  <td>{f.name}</td>
                  <td>{f.folder}</td>
                  <td>{fmtSize(f.sizeKb)}</td>
                  <td>{f.modified}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
