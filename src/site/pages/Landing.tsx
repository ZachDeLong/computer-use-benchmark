import { useCallback, useState } from 'react';
import { ReplayStage, type ReplayHandle } from '../ReplayStage';
import { Link } from '../router';
import { agentName, featuredRun, fmt, isModelRun, runs } from '../runs';
import { useStore } from '../../desktop/store';

const TASK_KINDS = [
  { name: 'Enter data into a form', detail: 'Add a contact with a given name, email and phone.', min: '9 actions' },
  { name: 'Find and change a setting', detail: 'Flip a toggle or pick a dropdown value hidden in one of five categories.', min: '3 to 4 actions' },
  { name: 'Move information between apps', detail: 'Read a phone number in Contacts, add it to a named note.', min: '6 actions' },
  { name: 'Sort a table', detail: 'Order the file list by a column, ascending or descending.', min: '2 to 3 actions' },
  { name: 'Move files', detail: 'Select every file of one type and move it to a folder.', min: '5 to 7 actions' },
];

export function Landing() {
  const run = featuredRun();
  const [handle, setHandle] = useState<ReplayHandle | null>(null);
  const onHandle = useCallback((h: ReplayHandle) => setHandle(h), []);
  const taskIndex = useStore((s) => (s.session ? Math.min(s.session.taskIndex + 1, s.session.plan.tasks.length) : 0));
  const taskCount = useStore((s) => s.session?.plan.tasks.length ?? 0);
  const top = runs.filter(isModelRun).slice(0, 5);

  return (
    <>
      <section className="wrap hero">
        <h1>A typing test for computer-use agents.</h1>
        <p className="lede">
          People and models take the same test: a small desktop, a fixed seed, eight randomized tasks. The score is correct
          actions per minute. Below, {run ? agentName(run) : 'an agent'} takes it in real time.
        </p>
      </section>

      {run ? (
        <section className="wrap">
          <ReplayStage run={run} autoplay loop speed={1} onHandle={onHandle} />
          <div className="strip">
            <span className="strip-item">
              <b>{agentName(run)}</b> seed {run.session.seed}
            </span>
            <span className="strip-item">
              task {taskIndex} of {taskCount}
            </span>
            <span className="strip-item">{handle?.view.actionsDone ?? 0} actions</span>
            <span className="strip-item mono">{fmt.clock(handle?.view.elapsedMs ?? 0)}</span>
            <span className="strip-item strip-final">
              finished at <b>{fmt.capm(run.metrics.capmModel)}</b> correct actions per minute
            </span>
            <span className="strip-spacer" />
            <button className="btn-text" onClick={() => (handle?.view.playing ? handle.pause() : handle?.play())}>
              {handle?.view.playing ? 'Pause' : 'Play'}
            </button>
            <Link to={`/replay/${run.id}`} className="btn-text">
              Open replay
            </Link>
          </div>
          {handle?.view.thought && <p className="thought">{handle.view.thought}</p>}
        </section>
      ) : (
        <section className="wrap">
          <div className="empty">No recorded runs yet. Run the harness and copy a result into src/data/runs.</div>
        </section>
      )}

      <section className="wrap cta-row">
        <Link to="/play" className="btn btn-primary btn-lg">
          Take the test yourself
        </Link>
        <Link to="/leaderboard" className="btn btn-lg">
          See the leaderboard
        </Link>
      </section>

      <section className="wrap section">
        <h2>How the score works</h2>
        <div className="cols-3">
          <div>
            <h3>Every task has a minimum</h3>
            <p>
              Open the app, click the field, type the string, save. The oracle knows the fewest actions each task needs from
              the desktop's current state, the way a typing test knows the word you were given.
            </p>
          </div>
          <div>
            <h3>You are credited for the minimum</h3>
            <p>
              Finishing a task earns exactly its minimum action count. Extra clicks, mistyped text and wrong windows earn
              nothing and cost time. Dismissing a pop-up earns one.
            </p>
          </div>
          <div>
            <h3>Divide by minutes</h3>
            <p>
              Credit divided by elapsed time is correct actions per minute. Models are also timed on model time alone, so
              a slow screenshot pipeline does not hide a fast model, or the reverse.
            </p>
          </div>
        </div>
      </section>

      {top.length > 0 && (
        <section className="wrap section">
          <h2>Leaderboard</h2>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Seed</th>
                  <th className="num">Correct actions / min</th>
                  <th className="num">Tasks done</th>
                  <th className="num">Efficiency</th>
                  <th className="num">Cost</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {top.map((r) => (
                  <tr key={r.id}>
                    <td>{agentName(r)}</td>
                    <td className="num">{r.session.seed}</td>
                    <td className="num strong">{fmt.capm(r.metrics.capmModel)}</td>
                    <td className="num">
                      {r.metrics.tasksCompleted}/{r.metrics.taskCount}
                    </td>
                    <td className="num">{fmt.pct(r.metrics.efficiency)}</td>
                    <td className="num">{fmt.usd(r.metrics.costUsd)}</td>
                    <td className="num">
                      <Link to={`/replay/${r.id}`}>Replay</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="aside">
            <Link to="/leaderboard">Full leaderboard</Link>, including the scripted ceiling and the random floor.
          </p>
        </section>
      )}

      <section className="wrap section">
        <h2>What is in a run</h2>
        <dl className="kinds">
          {TASK_KINDS.map((k) => (
            <div key={k.name} className="kind">
              <dt>{k.name}</dt>
              <dd>
                {k.detail} <span className="mono muted">{k.min}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="prose">
          Names, files, settings, window positions and button labels all come from the seed, so nothing can be memorized.
          About one task in four gets a pop-up at a fixed point. Nothing scrolls. The agent sees screenshots and acts by
          coordinate; a person sees the same screen and uses a mouse.
        </p>
      </section>
    </>
  );
}
