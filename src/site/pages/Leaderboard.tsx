import { useEffect, useState } from 'react';
import { Link } from '../router';
import { agentName, agentNote, fmt, loadLocalRuns, runs, type LocalRun } from '../runs';

export function Leaderboard() {
  const [local, setLocal] = useState<LocalRun[]>([]);
  useEffect(() => setLocal(loadLocalRuns()), []);

  return (
    <>
      <section className="wrap hero hero-tight">
        <h1>Leaderboard</h1>
        <p className="lede">
          One row per recorded run. Model time counts only the seconds spent waiting on the model; wall time includes
          screenshots and action execution. Every row has a replay.
        </p>
      </section>

      <section className="wrap">
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Seed</th>
                <th className="num">Model time</th>
                <th className="num">Wall time</th>
                <th className="num">Tasks done</th>
                <th className="num">Efficiency</th>
                <th className="num">Errors</th>
                <th className="num">Pop-ups</th>
                <th className="num">Steps</th>
                <th className="num">Cost</th>
                <th>Date</th>
                <th />
              </tr>
              <tr className="units">
                <th />
                <th />
                <th className="num">correct actions / min</th>
                <th className="num">correct actions / min</th>
                <th />
                <th className="num">min / actual</th>
                <th className="num">of actions</th>
                <th className="num">recovered</th>
                <th />
                <th />
                <th />
                <th />
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>
                    {agentName(r)}
                    {agentNote(r) && <span className="muted"> {agentNote(r)}</span>}
                  </td>
                  <td className="num">{r.session.seed}</td>
                  <td className="num strong">{fmt.capm(r.metrics.capmModel)}</td>
                  <td className="num">{fmt.capm(r.metrics.capmWall)}</td>
                  <td className="num">
                    {r.metrics.tasksCompleted}/{r.metrics.taskCount}
                  </td>
                  <td className="num">{fmt.pct(r.metrics.efficiency)}</td>
                  <td className="num">{fmt.pct(r.metrics.errorRate)}</td>
                  <td className="num">
                    {r.metrics.distractionsRecovered}/{r.metrics.distractionsShown}
                  </td>
                  <td className="num">{r.metrics.steps ?? ''}</td>
                  <td className="num">{fmt.usd(r.metrics.costUsd)}</td>
                  <td>{fmt.date(r.createdAt)}</td>
                  <td className="num">
                    <Link to={`/replay/${r.id}`}>Replay</Link>
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={12} className="empty-cell">
                    No recorded runs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="aside">
          Harness settings for every row: 1280x800 screenshots at native resolution, a fresh screenshot after each action
          batch, 120 ms settle time, the last three screenshots kept in context.
        </p>
      </section>

      <section className="wrap section">
        <h2>Your runs on this browser</h2>
        {local.length === 0 ? (
          <p className="prose">
            None yet. <Link to="/play">Take the test</Link> and your results will appear here. They stay in this browser.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Seed</th>
                  <th className="num">Correct actions / min</th>
                  <th className="num">Tasks done</th>
                  <th className="num">Time</th>
                  <th>Date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {local.map((r, i) => (
                  <tr key={i}>
                    <td className="num">{r.seed}</td>
                    <td className="num strong">{r.capm.toFixed(1)}</td>
                    <td className="num">
                      {r.tasksCompleted}/{r.tasks}
                    </td>
                    <td className="num">{fmt.clock(r.wallMs)}</td>
                    <td>{fmt.date(r.date)}</td>
                    <td className="num">
                      <Link to={`/play?seed=${r.seed}&tasks=${r.tasks}`}>Play this seed</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
