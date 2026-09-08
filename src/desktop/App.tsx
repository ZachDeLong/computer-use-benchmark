import { useEffect, useMemo } from 'react';
import { hashSeed } from '../core/rng';
import { useStore } from './store';
import { Desktop } from './Desktop';
import { Results } from './Results';
import { Site } from '../site/Site';

function readAgentParams() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('mode') !== 'agent') return null;
  const seedParam = p.get('seed');
  const seed = seedParam ? hashSeed(/^\d+$/.test(seedParam) ? Number(seedParam) : seedParam) : Math.floor(Math.random() * 1e9);
  const tasks = Math.max(1, Math.min(30, Number(p.get('tasks') ?? 8) || 8));
  return { seed, tasks };
}

/** Bare desktop for the harness: starts immediately, no site chrome, 1:1 pixels. */
function AgentApp({ seed, tasks }: { seed: number; tasks: number }) {
  const phase = useStore((s) => s.phase);
  const init = useStore((s) => s.init);
  const startSession = useStore((s) => s.startSession);
  useEffect(() => {
    init(seed, 'agent', tasks);
    startSession();
  }, [init, startSession, seed, tasks]);
  if (phase === 'done') return <Results />;
  return <Desktop />;
}

export function App() {
  const agent = useMemo(readAgentParams, []);
  if (agent) return <AgentApp seed={agent.seed} tasks={agent.tasks} />;
  return <Site />;
}
