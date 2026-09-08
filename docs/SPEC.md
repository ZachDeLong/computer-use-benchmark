# Scoring

A typing test for computer-use agents. The agent (or a person) operates a deterministic fake desktop and completes a run of randomized micro-tasks. The headline score is **Correct Actions per Minute (CAPM)**.

## The desktop

- 1280x800, rendered in a browser. Four apps on a bottom task bar: Contacts, Settings, Notes, Files. Windows open at seeded random positions and may overlap; the task bar always raises a window.
- The current instruction, task counter, progress bar and timer live in the top bar. Nothing scrolls; every control is reachable without scrolling.
- Everything is derived from one integer seed: window positions, task bar order, button labels, form field order, settings categories, contact/note/file data, the task sequence, and the pop-up schedule. Same seed, same session, in any browser.

## Tasks

Five kinds, cycled in shuffled order for the requested count (default 8):

| kind | example | minimum actions |
|---|---|---|
| form | Add a contact with name, email, phone | open + New + 3x(click field, type) + Save = 9 |
| settings | Turn a toggle on/off, or pick a dropdown value; the setting lives in a seeded category | open + category + 1 (toggle) or 2 (dropdown) |
| transfer | Copy a contact's phone number into a named note | open Contacts + pick contact + open Notes + pick note + click body + type = 6 |
| sort | Sort the file table by a column, asc or desc | open + 1 or 2 header clicks |
| move | Move every file with a given extension into a folder | open + select each + Move + folder |

Minimum actions are computed at task start from the actual desktop state, so an already-open, unobstructed window costs 0 and a window hidden under another costs 1 (task bar click). The scripted oracle agent completes every task in exactly this many actions, which is how the definitions are validated (`npm run harness -- --agent oracle`).

Each task is a list of milestones with weights, grouped in ordered stages. A milestone is met if its own check passes or any later-stage milestone passes (so once the contact is saved, the "form open" milestone is implied). Progress is the met weight fraction, and a task completes when every milestone is met.

## Actions

An action is a harness-level primitive: click (any button/count), drag, scroll, a whole typed string, a key press or combo. Screenshots, zoom, mouse moves, waits and cursor queries are free. Typing character by character is legal but wasteful: humans get one action per unbroken typing burst in the same field, and agents get one per `type` call.

After each action the oracle classifies it against the milestone progress:

- **progress** - progress increased
- **neutral** - no change
- **regress** - progress decreased
- **wasted** - performed while a pop-up was blocking the desktop and did not dismiss it
- **recovery** - dismissed a pop-up

## Pop-ups

Roughly one per four tasks, scheduled deterministically as "after action N of task K". A blocking modal covers the desktop until any of its buttons is clicked. Two runs of the same seed meet the same pop-ups at the same points.

## Score

```
credit = sum over tasks of minActions x finalProgress   (finalProgress = 1 when complete)
       + number of pop-ups dismissed
CAPM   = credit / minutes
```

This mirrors words-per-minute: you are credited for the normalized work, not for keystrokes. Extra actions earn nothing and cost time. Partial credit is proportional to milestone progress on unfinished tasks.

Agents report two denominators:

- **CAPM (model time)** - minutes spent waiting on the model. This is the number to compare across models and providers.
- **CAPM (wall time)** - includes screenshot capture, action execution and settle time. Humans only have this one.

Supplementary metrics: task success rate, efficiency (`minActions / (actions - recoveries)` over completed tasks), error rate (`(regress + wasted) / actions`), per-task completion times, pop-ups recovered and mean actions to recover, model steps, tokens, and dollar cost.

## Tracks

- **Screenshot-only** (implemented) - the agent sees PNG screenshots and acts by coordinate. A fresh screenshot is attached to every action batch automatically; explicit screenshot calls are free.
- **DOM-assisted** (planned) - the agent also receives an accessibility tree. Measures tool-use reasoning more than perception; keep it on a separate leaderboard.

## Limits and caveats

- The fake desktop is clean and consistent. Scores do not transfer to OSWorld-style real-desktop benchmarks; they isolate the perception-action loop.
- Results depend on the harness as much as the model: screenshot resolution (1280x800, native), auto-screenshot policy, settle time (120 ms), and image pruning (last 3 screenshots kept). Report these with any number.
- A few seeds place windows so one covers another; the oracle accounts for it in minActions, but agents that click directly into a partially visible window can score slightly above 100% efficiency. That is expected.
