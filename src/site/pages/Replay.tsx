import { useCallback, useEffect, useRef, useState } from 'react';
import { ReplayStage, type ReplayHandle } from '../ReplayStage';
import { Link } from '../router';
import { describe } from '../replay';
import { agentName, agentNote, findRun, fmt, runs } from '../runs';

export function ReplayIndex() {
  return (
    <>
      <section className="wrap hero hero-tight">
        <h1>Replays</h1>
        <p className="lede">Every recorded run, played back action by action on the same seeded desktop.</p>
      </section>
      <section className="wrap">
        <ul className="run-list">
          {runs.map((r) => (
            <li key={r.id}>
              <Link to={`/replay/${r.id}`}>
                <span className="run-list-name">
                  {agentName(r)} <span className="muted">{agentNote(r)}</span>
                </span>
                <span className="mono">seed {r.session.seed}</span>
                <span className="mono">
                  {r.metrics.tasksCompleted}/{r.metrics.taskCount} tasks
                </span>
                <span className="mono strong">{fmt.capm(r.metrics.capmModel)} / min</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function Replay({ id }: { id: string }) {
  const run = findRun(id);
  const [handle, setHandle] = useState<ReplayHandle | null>(null);
  const onHandle = useCallback((h: ReplayHandle) => setHandle(h), []);
  const logRef = useRef<HTMLOListElement>(null);
  const index = handle?.view.index ?? 0;

  useEffect(() => {
    const el = logRef.current?.querySelector<HTMLElement>('.is-current');
    el?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!run) {
    return (
      <section className="wrap hero">
        <h1>Replay not found</h1>
        <p className="lede">
          There is no recorded run with that id. <Link to="/replay">See all replays</Link>.
        </p>
      </section>
    );
  }

  const m = run.metrics;
  const view = handle?.view;
  const speeds = [1, 2, 4];

  return (
    <>
      <section className="wrap hero hero-tight">
        <h1>
          {agentName(run)} <span className="muted">seed {run.session.seed}</span>
        </h1>
        <p className="lede">
          {run.metrics.tasksCompleted} of {run.metrics.taskCount} tasks in {fmt.clock(m.wallMs)}
          {m.modelMs !== null ? `, of which ${fmt.clock(m.modelMs)} waiting on the model` : ''}. {fmt.capm(m.capmModel)} correct
          actions per minute of model time, {fmt.capm(m.capmWall)} on the wall clock. {fmt.pct(m.efficiency)} efficient,{' '}
          {fmt.pct(m.errorRate)} of actions were errors
          {m.distractionsShown ? `, ${m.distractionsRecovered} of ${m.distractionsShown} pop-ups dismissed` : ''}.
          {m.costUsd !== null ? ` Cost ${fmt.usd(m.costUsd)}.` : ''}
        </p>
      </section>

      <section className="wrap">
        <ReplayStage run={run} autoplay speed={1} onHandle={onHandle} />
        <div className="strip">
          <button className="btn-text" onClick={() => (view?.playing ? handle?.pause() : handle?.play())}>
            {view?.finished ? 'Play again' : view?.playing ? 'Pause' : 'Play'}
          </button>
          <span className="strip-item">
            {speeds.map((s) => (
              <button key={s} className={`btn-chip ${handle?.speed === s ? 'is-on' : ''}`} onClick={() => handle?.setSpeed(s)}>
                {s}x
              </button>
            ))}
          </span>
          <span className="strip-item mono">{fmt.clock(view?.elapsedMs ?? 0)}</span>
          <span className="strip-item">
            {view?.actionsDone ?? 0} of {run.session.actions.length} actions
          </span>
          <span className="strip-spacer" />
          {view?.thinking && <span className="strip-item muted">waiting on the model</span>}
        </div>
      </section>

      <section className="wrap replay-panels">
        <div>
          <h2>Actions</h2>
          <ol className="action-log" ref={logRef}>
            {run.trace.actions.map((a, i) => {
              const cls = a.counted ? (a.classification ?? 'neutral') : 'free';
              const state = i < index ? 'is-done' : i === index && view && !view.finished ? 'is-current' : '';
              const live = view?.liveClasses[i];
              const mismatch = a.counted && live != null && a.classification != null && live !== a.classification;
              return (
                <li key={i} className={`${state} cls-${cls} ${mismatch ? 'is-mismatch' : ''}`} title={mismatch ? `replay saw ${live}` : undefined}>
                  <span className="action-t mono">{fmt.clock(a.t)}</span>
                  <span className="action-name mono">{describe(a)}</span>
                  <span className="action-cls">{a.counted ? (a.classification ?? '') : ''}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <div>
          <h2>What the model said</h2>
          {run.trace.steps.length === 0 ? (
            <p className="prose muted">This agent does not talk.</p>
          ) : (
            <ol className="thought-log">
              {run.trace.steps
                .filter((s) => s.text)
                .map((s) => {
                  const current = view && !view.finished && run.trace.actions[index]?.step === s.index;
                  return (
                    <li key={s.index} className={current ? 'is-current' : ''}>
                      <span className="mono muted">
                        step {s.index}, {(s.modelMs / 1000).toFixed(1)}s
                      </span>
                      <p>{s.text}</p>
                    </li>
                  );
                })}
            </ol>
          )}
        </div>
      </section>

      <section className="wrap section">
        <h2>Tasks</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>#</th>
                <th>Instruction</th>
                <th className="num">Minimum</th>
                <th className="num">Actions</th>
                <th className="num">Time</th>
              </tr>
            </thead>
            <tbody>
              {run.session.tasks.map((t) => (
                <tr key={t.id}>
                  <td className="num">{t.index + 1}</td>
                  <td>{t.instruction}</td>
                  <td className="num">{t.minActions}</td>
                  <td className="num">{t.actions}</td>
                  <td className="num">{t.endedAt ? fmt.clock(t.endedAt - t.startedAt) : 'not finished'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
