import { useEffect, useMemo } from 'react';
import { hashSeed } from '../../core/rng';
import { useStore } from '../../desktop/store';
import { installHumanActionTracker } from '../../desktop/humanActions';
import { Desktop } from '../../desktop/Desktop';
import { StartScreen } from '../../desktop/StartScreen';
import { Results } from '../../desktop/Results';
import { Stage } from '../Stage';

function readParams() {
  const p = new URLSearchParams(window.location.search);
  const seedParam = p.get('seed');
  const seed = seedParam ? hashSeed(/^\d+$/.test(seedParam) ? Number(seedParam) : seedParam) : Math.floor(Math.random() * 1e9);
  const tasks = Math.max(1, Math.min(30, Number(p.get('tasks') ?? 8) || 8));
  return { seed, tasks };
}

export function Play() {
  const params = useMemo(readParams, []);
  const phase = useStore((s) => s.phase);
  const mode = useStore((s) => s.mode);
  const init = useStore((s) => s.init);

  useEffect(() => {
    init(params.seed, 'human', params.tasks);
  }, [init, params]);

  useEffect(() => {
    if (mode !== 'human') return;
    return installHumanActionTracker();
  }, [mode]);

  return (
    <>
      <section className="wrap hero hero-tight">
        <h1>Take the test</h1>
        <p className="lede">
          Eight tasks, as fast as you can. Every click, key and typing burst is an action. Same seed, same tasks, same
          layout as the agents.
        </p>
      </section>
      <section className="wrap">
        <Stage>
          {mode === 'human' && phase === 'start' && <StartScreen seed={params.seed} tasks={params.tasks} />}
          {mode === 'human' && phase === 'running' && <Desktop />}
          {mode === 'human' && phase === 'done' && <Results />}
        </Stage>
        <p className="aside">
          Windows may overlap. The task bar always brings an app to the front. Pop-ups block the desktop until you dismiss
          them.
        </p>
      </section>
    </>
  );
}
