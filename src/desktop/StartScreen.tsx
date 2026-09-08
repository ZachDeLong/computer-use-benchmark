import { useState } from 'react';
import { useStore } from './store';
import { hashSeed } from '../core/rng';

export function StartScreen({ seed, tasks }: { seed: number; tasks: number }) {
  const [seedText, setSeedText] = useState(String(seed));
  const [taskCount, setTaskCount] = useState(tasks);
  const init = useStore((s) => s.init);
  const startSession = useStore((s) => s.startSession);

  const start = () => {
    const s = /^\d+$/.test(seedText.trim()) ? Number(seedText.trim()) : hashSeed(seedText.trim() || String(Date.now()));
    init(s, 'human', taskCount);
    const url = new URL(window.location.href);
    url.searchParams.set('seed', String(s));
    url.searchParams.set('tasks', String(taskCount));
    window.history.replaceState(null, '', url.toString());
    startSession();
  };

  return (
    <div className="screen start-screen">
      <div className="card">
        <h1>Computer-Use Benchmark</h1>
        <p className="muted">
          A typing test for computer-use agents. Complete a run of randomized desktop tasks as fast as you can. Your score is
          Correct Actions per Minute: the minimum actions each task requires, credited on completion, divided by elapsed time.
        </p>
        <div className="form-row">
          <label>Seed</label>
          <input value={seedText} onChange={(e) => setSeedText(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Tasks</label>
          <div className="seg">
            {[5, 8, 12].map((n) => (
              <button key={n} className={`seg-btn ${taskCount === n ? 'is-active' : ''}`} onClick={() => setTaskCount(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary btn-lg" onClick={start} data-testid="start">
          Start
        </button>
        <p className="muted small">
          Agents run the same page with <code>?mode=agent&amp;seed=N</code> via the harness. Same seed, same tasks, same layout.
        </p>
      </div>
    </div>
  );
}
