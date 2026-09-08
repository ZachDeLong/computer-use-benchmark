import { Rng } from '../../core/rng';
import type { Env } from '../env';
import { emptyStats, type Agent } from './types';

/** Clicks and types at random. A floor for the leaderboard and a smoke test for the harness. */
export function randomAgent(seed = 1): Agent {
  const rng = new Rng(seed);
  return {
    name: 'random',
    async run(env: Env) {
      const stats = emptyStats();
      while (!(await env.shouldStop())) {
        const t0 = Date.now();
        const roll = rng.next();
        if (roll < 0.75) {
          await env.perform('left_click', { coordinate: [rng.int(0, 1279), rng.int(0, 799)] });
        } else if (roll < 0.9) {
          await env.perform('type', { text: rng.pick(['hello', '555-0100', 'test', 'a']) });
        } else {
          await env.perform('key', { text: rng.pick(['Return', 'Escape', 'Tab']) });
        }
        stats.modelMs += Date.now() - t0;
        stats.steps++;
      }
      return stats;
    },
  };
}
