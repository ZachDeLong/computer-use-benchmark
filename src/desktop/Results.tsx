import { useEffect } from 'react';
import { computeMetrics } from '../core/score';
import { saveLocalRun } from '../site/runs';
import { useStore } from './store';

export function Results() {
  const session = useStore((s) => s.session);
  const mode = useStore((s) => s.mode);
  const exp = session?.export() ?? null;
  const m = exp ? computeMetrics(exp, { wallMs: (exp.endedAt ?? Date.now()) - (exp.startedAt ?? Date.now()) }) : null;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  useEffect(() => {
    if (mode !== 'human' || !m) return;
    saveLocalRun({ seed: m.seed, tasks: m.taskCount, capm: m.capmWall, wallMs: m.wallMs, tasksCompleted: m.tasksCompleted, date: new Date().toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
  if (!session || !exp || !m) return null;
  const again = (sameSeed: boolean) => {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', String(sameSeed ? m.seed : Math.floor(Math.random() * 1e9)));
    window.location.href = url.toString();
  };

  if (mode === 'agent') {
    return (
      <div className="screen">
        <div className="card">
          <h1 data-testid="session-complete">Session complete</h1>
          <p className="muted">The harness reads the results through the oracle.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="card card-wide">
        <div className="results-hero">
          <div className="results-capm">{m.capmWall.toFixed(1)}</div>
          <div className="results-capm-label">correct actions per minute</div>
        </div>
        <div className="stats">
          <Stat label="Time" value={`${(m.wallMs / 1000).toFixed(1)}s`} />
          <Stat label="Tasks" value={`${m.tasksCompleted}/${m.taskCount}`} />
          <Stat label="Actions" value={String(m.actionsTotal)} />
          <Stat label="Efficiency" value={m.efficiency === null ? 'n/a' : pct(m.efficiency)} />
          <Stat label="Error rate" value={pct(m.errorRate)} />
          <Stat label="Distractions" value={`${m.distractionsRecovered}/${m.distractionsShown}`} />
        </div>
        <table className="results-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Task</th>
              <th>Min</th>
              <th>Actions</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {exp.tasks.map((t) => (
              <tr key={t.id}>
                <td>{t.index + 1}</td>
                <td className="results-instr">{t.instruction}</td>
                <td>{t.minActions}</td>
                <td>{t.actions}</td>
                <td>{t.endedAt ? `${((t.endedAt - t.startedAt) / 1000).toFixed(1)}s` : 'incomplete'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row gap">
          <button className="btn btn-primary" onClick={() => again(false)}>
            New seed
          </button>
          <button className="btn" onClick={() => again(true)}>
            Replay seed {m.seed}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
