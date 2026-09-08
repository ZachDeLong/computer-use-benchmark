import { Rng } from './rng';
import type {
  AppId,
  Contact,
  ContactField,
  DesktopState,
  FileEntry,
  Note,
  SettingDef,
  SettingValue,
  WindowState,
} from './types';
import { APP_IDS } from './types';

const FIRST = ['Dana', 'Priya', 'Marcus', 'Elena', 'Tomas', 'Aisha', 'Noah', 'Ingrid', 'Kenji', 'Rosa', 'Felix', 'Mira', 'Owen', 'Leila', 'Victor', 'Hana'];
const LAST = ['Whitfield', 'Raman', 'Okafor', 'Novak', 'Lindqvist', 'Moreau', 'Tanaka', 'Delgado', 'Brennan', 'Haddad', 'Kowalski', 'Ferreira', 'Nakamura', 'Ostrowski', 'Quintero', 'Bergstrom'];
const DOMAINS = ['example.com', 'mail.test', 'workmail.io', 'corp.example', 'inbox.dev'];

const NOTE_TITLES = ['Vendors', 'Meeting notes', 'Follow-ups', 'Ideas', 'Groceries', 'Travel', 'Onboarding', 'Q3 planning', 'Reading list', 'Errands'];
const NOTE_LINES = [
  'Call back before Friday.',
  'Check invoice status.',
  'Draft agenda for Monday.',
  'Buy printer paper.',
  'Ask about the extended warranty.',
  'Review the budget spreadsheet.',
  'Send the signed contract.',
  'Book a room for the offsite.',
];

const FILE_STEMS = ['report', 'invoice', 'summary', 'photo', 'notes', 'budget', 'contract', 'draft', 'agenda', 'receipt', 'proposal', 'minutes', 'roadmap', 'brief', 'scan'];
const FILE_EXTS = ['pdf', 'docx', 'xlsx', 'png', 'txt', 'jpg'];
const FOLDERS = ['Documents', 'Archive', 'Downloads', 'Photos', 'Projects'];

const SETTING_POOL: Omit<SettingDef, 'category'>[] = [
  { key: 'notifications', label: 'Desktop notifications', kind: 'toggle' },
  { key: 'sounds', label: 'Notification sounds', kind: 'toggle' },
  { key: 'autoUpdate', label: 'Automatic updates', kind: 'toggle' },
  { key: 'darkMode', label: 'Dark mode', kind: 'toggle' },
  { key: 'analytics', label: 'Share usage analytics', kind: 'toggle' },
  { key: 'locationAccess', label: 'Location access', kind: 'toggle' },
  { key: 'autoSave', label: 'Auto-save documents', kind: 'toggle' },
  { key: 'spellCheck', label: 'Spell check', kind: 'toggle' },
  { key: 'language', label: 'Language', kind: 'select', options: ['English', 'Spanish', 'French', 'German', 'Japanese'] },
  { key: 'timezone', label: 'Time zone', kind: 'select', options: ['UTC', 'Pacific', 'Mountain', 'Central', 'Eastern'] },
  { key: 'fontSize', label: 'Font size', kind: 'select', options: ['Small', 'Medium', 'Large'] },
  { key: 'startupPage', label: 'Startup page', kind: 'select', options: ['Home', 'Last session', 'Blank'] },
  { key: 'syncInterval', label: 'Sync interval', kind: 'select', options: ['5 minutes', '15 minutes', '1 hour', 'Manual'] },
];
const CATEGORIES = ['General', 'Appearance', 'Notifications', 'Privacy', 'Advanced'];

export const SCREEN = { w: 1280, h: 800, topBar: 56, taskbar: 48 };
const WIN_SIZES: Record<AppId, { w: number; h: number }> = {
  contacts: { w: 460, h: 400 },
  settings: { w: 520, h: 380 },
  notes: { w: 460, h: 360 },
  files: { w: 600, h: 470 },
};

export function makeName(rng: Rng): string {
  return `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
}
export function makeEmail(rng: Rng, name: string): string {
  const [f, l] = name.toLowerCase().split(' ');
  const style = rng.int(0, 2);
  const local = style === 0 ? `${f}.${l}` : style === 1 ? `${f[0]}${l}` : `${f}${rng.int(10, 99)}`;
  return `${local}@${rng.pick(DOMAINS)}`;
}
export function makePhone(rng: Rng): string {
  return `555-0${rng.int(100, 199)}`;
}

function uniqueNames(rng: Rng, n: number): string[] {
  const out = new Set<string>();
  while (out.size < n) out.add(makeName(rng));
  return [...out];
}

function makeContacts(rng: Rng, n: number): Contact[] {
  return uniqueNames(rng, n).map((name, i) => ({
    id: `c${i}`,
    name,
    email: makeEmail(rng, name),
    phone: makePhone(rng),
  }));
}

function makeNotes(rng: Rng, n: number): Note[] {
  return rng.sample(NOTE_TITLES, n).map((title, i) => ({
    id: `n${i}`,
    title,
    body: rng.sample(NOTE_LINES, rng.int(1, 3)).join('\n'),
  }));
}

function makeFiles(rng: Rng, folders: string[], n: number): FileEntry[] {
  const seen = new Set<string>();
  const out: FileEntry[] = [];
  while (out.length < n) {
    const name = `${rng.pick(FILE_STEMS)}${rng.chance(0.5) ? `-${rng.int(1, 12)}` : ''}.${rng.pick(FILE_EXTS)}`;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({
      id: `f${out.length}`,
      name,
      folder: rng.pick(folders),
      sizeKb: rng.int(12, 9800),
      modified: `2026-0${rng.int(1, 8)}-${String(rng.int(1, 28)).padStart(2, '0')}`,
    });
  }
  return out;
}

function makeSettings(rng: Rng): { defs: SettingDef[]; categories: string[]; values: Record<string, SettingValue> } {
  const categories = rng.shuffle(CATEGORIES);
  const pool = rng.shuffle(SETTING_POOL);
  const defs: SettingDef[] = pool.map((d, i) => ({ ...d, category: categories[i % categories.length] }));
  const values: Record<string, SettingValue> = {};
  for (const d of defs) {
    values[d.key] = d.kind === 'toggle' ? rng.chance(0.5) : rng.pick(d.options!);
  }
  return { defs, categories, values };
}

function makeWindows(rng: Rng): Record<AppId, WindowState> {
  const area = { x0: 16, y0: SCREEN.topBar + 12, x1: SCREEN.w - 16, y1: SCREEN.h - SCREEN.taskbar - 12 };
  const out = {} as Record<AppId, WindowState>;
  let z = 1;
  for (const app of APP_IDS) {
    const { w, h } = WIN_SIZES[app];
    out[app] = {
      open: false,
      w,
      h,
      x: rng.int(area.x0, area.x1 - w),
      y: rng.int(area.y0, area.y1 - h),
      z: z++,
    };
  }
  return out;
}

export function generateInitialState(seed: number): DesktopState {
  const rng = new Rng(seed ^ 0x9e3779b9);
  const settings = makeSettings(rng);
  const folders = rng.sample(FOLDERS, 4);
  const fieldOrder = rng.shuffle<ContactField>(['name', 'email', 'phone']);
  return {
    seed,
    labels: {
      contactsNew: rng.pick(['New contact', 'Add contact', '+ New']),
      contactsSave: rng.pick(['Save', 'Add', 'Done']),
      filesMove: rng.pick(['Move to...', 'Move selected...', 'Move...']),
    },
    taskbarOrder: rng.shuffle(APP_IDS),
    windows: makeWindows(rng),
    focused: null,
    contacts: { list: makeContacts(rng, rng.int(5, 8)), selectedId: null, draft: null, fieldOrder },
    settings: { ...settings, activeCategory: settings.categories[0], openDropdown: null },
    notes: { list: makeNotes(rng, rng.int(4, 6)), activeId: null },
    files: {
      list: makeFiles(rng, folders, rng.int(9, 11)),
      folders,
      selected: [],
      sortBy: null,
      sortDir: 'asc',
      movePickerOpen: false,
    },
    modal: null,
  };
}
