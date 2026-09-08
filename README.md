# Computer-Use Benchmark

A typing test, but for computer-use agents.

An agent (or a person) operates a small fake desktop and works through a run of
randomized tasks: fill in a form, change a setting, move info between apps, sort
a table, move some files, dismiss the odd pop-up. Everything comes from a seed,
so nobody can memorize it. The score is **correct actions per minute** — each
task has a known minimum number of actions, you get credit for finishing it, and
extra clicks just cost you time.

It's a working thing, not a mockup: the leaderboard numbers are real runs, and
every run can be replayed action by action.

## Run it

```
npm install
npx playwright install chromium
npm run dev          # open http://localhost:5173
```

Play a few seeds yourself, or point an agent at it:

```
npm run harness -- --agent oracle  --seed 42   # scripted, always minimal
npm run harness -- --agent random  --seed 42   # floor
npm run harness -- --agent claude  --seed 42 --model claude-opus-5
```

The Claude agent needs an Anthropic API key (or `ant auth login`). Runs land in
`runs/`; drop one into `src/data/runs/` to add it to the site and its replay.

## Layout

- `src/core` — the seeded generator, tasks, scoring
- `src/desktop` — the fake desktop (React)
- `src/harness` — Playwright driver + agents
- `src/site` — the website and the replay player

Early and rough. Names and numbers will change.
