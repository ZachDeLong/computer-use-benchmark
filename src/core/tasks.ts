import { Rng } from './rng';
import { generateInitialState, makeEmail, makeName, makePhone } from './generate';
import type { DesktopState, Distraction, FileSortKey, Milestone, ModalState, Task, TaskKind } from './types';
import { TASK_KINDS } from './types';
import { openCost, withRaised } from './layout';

const norm = (s: string) => s.trim().toLowerCase();
const open = (s: DesktopState, app: keyof DesktopState['windows']) => s.windows[app].open;

const SORT_LABELS: Record<FileSortKey, { label: string; asc: string; desc: string }> = {
  name: { label: 'Name', asc: 'A to Z', desc: 'Z to A' },
  folder: { label: 'Folder', asc: 'A to Z', desc: 'Z to A' },
  sizeKb: { label: 'Size', asc: 'smallest first', desc: 'largest first' },
  modified: { label: 'Modified', asc: 'oldest first', desc: 'newest first' },
};

const DISTRACTION_POOL: ModalState[] = [
  { id: 'update', title: 'Software update available', body: 'Version 4.2.1 is ready to install. Installing will take about 3 minutes.', buttons: ['Remind me later', 'Install now'] },
  { id: 'session', title: 'Session expiring', body: 'You will be signed out in 2 minutes due to inactivity.', buttons: ['Stay signed in'] },
  { id: 'notify', title: 'Enable notifications?', body: 'This app would like to send you notifications about activity and updates.', buttons: ["Don't allow", 'Allow'] },
  { id: 'sync', title: 'Cloud sync paused', body: 'Your storage is almost full. Sync has been paused until space is freed.', buttons: ['OK'] },
];

interface GenCtx {
  rng: Rng;
  initial: DesktopState;
  usedContactNames: Set<string>;
  usedSettingKeys: Set<string>;
  usedNoteIds: Set<string>;
}

function genForm(ctx: GenCtx, idx: number): Task {
  const { rng, initial } = ctx;
  let name = makeName(rng);
  while (ctx.usedContactNames.has(name) || initial.contacts.list.some((c) => c.name === name)) name = makeName(rng);
  ctx.usedContactNames.add(name);
  const email = makeEmail(rng, name);
  const phone = makePhone(rng);
  const saved = (s: DesktopState) =>
    s.contacts.list.some((c) => norm(c.name) === norm(name) && norm(c.email) === norm(email) && norm(c.phone) === norm(phone));
  const milestones: Milestone[] = [
    { id: 'open', stage: 1, weight: 0.1, check: (s) => open(s, 'contacts') },
    { id: 'draft', stage: 2, weight: 0.1, check: (s) => s.contacts.draft !== null },
    { id: 'name', stage: 3, weight: 0.15, check: (s) => norm(s.contacts.draft?.name ?? '') === norm(name) },
    { id: 'email', stage: 3, weight: 0.15, check: (s) => norm(s.contacts.draft?.email ?? '') === norm(email) },
    { id: 'phone', stage: 3, weight: 0.15, check: (s) => norm(s.contacts.draft?.phone ?? '') === norm(phone) },
    { id: 'saved', stage: 4, weight: 0.35, check: saved },
  ];
  return {
    id: `t${idx}-form`,
    kind: 'form',
    instruction: `In Contacts, add a new contact. Name: ${name}. Email: ${email}. Phone: ${phone}.`,
    milestones,
    minActions: (s) => openCost(s.windows, 'contacts') + (s.contacts.draft ? 0 : 1) + 6 + 1,
    meta: { name, email, phone },
  };
}

function genSettings(ctx: GenCtx, idx: number): Task {
  const { rng, initial } = ctx;
  const candidates = initial.settings.defs.filter((d) => !ctx.usedSettingKeys.has(d.key));
  const def = rng.pick(candidates);
  ctx.usedSettingKeys.add(def.key);
  const current = initial.settings.values[def.key];
  let target: boolean | string;
  let instruction: string;
  if (def.kind === 'toggle') {
    target = !(current as boolean);
    instruction = `In Settings, turn ${target ? 'on' : 'off'} "${def.label}".`;
  } else {
    target = rng.pick(def.options!.filter((o) => o !== current));
    instruction = `In Settings, set "${def.label}" to "${target}".`;
  }
  const milestones: Milestone[] = [
    { id: 'open', stage: 1, weight: 0.15, check: (s) => open(s, 'settings') },
    { id: 'category', stage: 2, weight: 0.25, check: (s) => s.settings.activeCategory === def.category },
    { id: 'value', stage: 3, weight: 0.6, check: (s) => s.settings.values[def.key] === target },
  ];
  return {
    id: `t${idx}-settings`,
    kind: 'settings',
    instruction,
    milestones,
    minActions: (s) =>
      openCost(s.windows, 'settings') + (s.settings.activeCategory === def.category ? 0 : 1) + (def.kind === 'toggle' ? 1 : 2),
    meta: { key: def.key, kind: def.kind, category: def.category, target },
  };
}

function genTransfer(ctx: GenCtx, idx: number): Task {
  const { rng, initial } = ctx;
  const contact = rng.pick(initial.contacts.list);
  const noteCandidates = initial.notes.list.filter((n) => !ctx.usedNoteIds.has(n.id) && !n.body.includes(contact.phone));
  const note = rng.pick(noteCandidates.length ? noteCandidates : initial.notes.list);
  ctx.usedNoteIds.add(note.id);
  const bodyHas = (s: DesktopState) => (s.notes.list.find((n) => n.id === note.id)?.body ?? '').includes(contact.phone);
  const milestones: Milestone[] = [
    { id: 'contacts-open', stage: 1, weight: 0.1, check: (s) => open(s, 'contacts') },
    { id: 'contact-selected', stage: 2, weight: 0.2, check: (s) => s.contacts.selectedId === contact.id },
    { id: 'notes-open', stage: 3, weight: 0.1, check: (s) => open(s, 'notes') },
    { id: 'note-active', stage: 4, weight: 0.2, check: (s) => s.notes.activeId === note.id },
    { id: 'body', stage: 5, weight: 0.4, check: bodyHas },
  ];
  return {
    id: `t${idx}-transfer`,
    kind: 'transfer',
    instruction: `Copy ${contact.name}'s phone number from Contacts and add it to the note titled "${note.title}" in Notes.`,
    milestones,
    minActions: (s) => {
      // simulate the raise sequence: contacts first (to read), then notes (to type)
      let a = 0;
      let w = s.windows;
      if (openCost(w, 'contacts')) {
        a++;
        w = withRaised(w, 'contacts');
      }
      if (s.contacts.selectedId !== contact.id) a++;
      if (openCost(w, 'notes')) {
        a++;
        w = withRaised(w, 'notes');
      }
      if (s.notes.activeId !== note.id) a++;
      return a + 2;
    },
    meta: { contactId: contact.id, phone: contact.phone, noteId: note.id },
  };
}

function genSort(ctx: GenCtx, idx: number): Task {
  const { rng } = ctx;
  const key = rng.pick<FileSortKey>(['name', 'sizeKb', 'modified']);
  const dir = rng.pick<'asc' | 'desc'>(['asc', 'desc']);
  const L = SORT_LABELS[key];
  const milestones: Milestone[] = [
    { id: 'open', stage: 1, weight: 0.2, check: (s) => open(s, 'files') },
    { id: 'sorted', stage: 2, weight: 0.8, check: (s) => s.files.sortBy === key && s.files.sortDir === dir },
  ];
  return {
    id: `t${idx}-sort`,
    kind: 'sort',
    instruction: `In Files, sort the list by ${L.label}, ${dir === 'asc' ? L.asc : L.desc}.`,
    milestones,
    minActions: (s) => {
      const o = openCost(s.windows, 'files');
      if (s.files.sortBy === key) return o + (s.files.sortDir === dir ? 0 : 1);
      return o + (dir === 'asc' ? 1 : 2);
    },
    meta: { key, dir },
  };
}

function genMove(ctx: GenCtx, idx: number): Task {
  const { rng, initial } = ctx;
  const files = initial.files.list;
  const exts = [...new Set(files.map((f) => f.name.split('.').pop()!))];
  // choose ext + folder such that 2..4 files need moving
  const options: { ext: string; folder: string; ids: string[] }[] = [];
  for (const ext of exts) {
    for (const folder of initial.files.folders) {
      const ids = files.filter((f) => f.name.endsWith(`.${ext}`) && f.folder !== folder).map((f) => f.id);
      if (ids.length >= 2 && ids.length <= 4) options.push({ ext, folder, ids });
    }
  }
  const pick = options.length ? rng.pick(options) : { ext: exts[0], folder: initial.files.folders[0], ids: files.filter((f) => f.name.endsWith(`.${exts[0]}`)).map((f) => f.id) };
  const n = pick.ids.length;
  const inFolder = (s: DesktopState, id: string) => s.files.list.find((f) => f.id === id)?.folder === pick.folder;
  const milestones: Milestone[] = [
    { id: 'open', stage: 1, weight: 0.1, check: (s) => open(s, 'files') },
    ...pick.ids.map((id) => ({
      id: `sel-${id}`,
      stage: 2,
      weight: 0.2 / n,
      check: (s: DesktopState) => s.files.selected.includes(id) || inFolder(s, id),
    })),
    ...pick.ids.map((id) => ({ id: `moved-${id}`, stage: 3, weight: 0.7 / n, check: (s: DesktopState) => inFolder(s, id) })),
  ];
  return {
    id: `t${idx}-move`,
    kind: 'move',
    instruction: `In Files, move all .${pick.ext} files into the ${pick.folder} folder.`,
    milestones,
    minActions: (s) => {
      const remaining = pick.ids.filter((id) => !inFolder(s, id));
      if (remaining.length === 0) return 0;
      const unselected = remaining.filter((id) => !s.files.selected.includes(id)).length;
      return openCost(s.windows, 'files') + unselected + 1 + 1;
    },
    meta: { ext: pick.ext, folder: pick.folder, ids: pick.ids },
  };
}

const GENERATORS: Record<TaskKind, (ctx: GenCtx, idx: number) => Task> = {
  form: genForm,
  settings: genSettings,
  transfer: genTransfer,
  sort: genSort,
  move: genMove,
};

export interface SessionPlan {
  seed: number;
  initial: DesktopState;
  tasks: Task[];
  distractions: Distraction[];
}

export function generateSessionPlan(seed: number, taskCount: number): SessionPlan {
  const initial = generateInitialState(seed);
  const rng = new Rng(seed ^ 0x51ed270b);
  const ctx: GenCtx = { rng, initial, usedContactNames: new Set(), usedSettingKeys: new Set(), usedNoteIds: new Set() };
  const kinds: TaskKind[] = [];
  while (kinds.length < taskCount) kinds.push(...rng.shuffle(TASK_KINDS));
  const tasks = kinds.slice(0, taskCount).map((k, i) => GENERATORS[k](ctx, i));

  const distractionCount = Math.max(1, Math.round(taskCount / 4));
  const taskIdxs = rng.sample(
    tasks.map((_, i) => i).filter((i) => i > 0),
    distractionCount,
  );
  const distractions: Distraction[] = taskIdxs.map((taskIndex) => ({
    taskIndex,
    afterAction: rng.int(1, 3),
    modal: rng.pick(DISTRACTION_POOL),
  }));
  return { seed, initial, tasks, distractions };
}

/** Weighted progress with stage semantics: a milestone is met if its check passes or any later-stage milestone passes. */
export function computeProgress(task: Task, state: DesktopState): { progress: number; met: boolean[]; complete: boolean } {
  const ms = task.milestones;
  const raw = ms.map((m) => m.check(state));
  const met = ms.map((m, i) => raw[i] || ms.some((o, j) => o.stage > m.stage && raw[j]));
  const total = ms.reduce((a, m) => a + m.weight, 0);
  const got = ms.reduce((a, m, i) => a + (met[i] ? m.weight : 0), 0);
  const complete = met.every(Boolean);
  return { progress: complete ? 1 : Math.min(0.999, got / total), met, complete };
}
