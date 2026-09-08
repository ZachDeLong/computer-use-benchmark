export type AppId = 'contacts' | 'settings' | 'notes' | 'files';
export const APP_IDS: AppId[] = ['contacts', 'settings', 'notes', 'files'];

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
}
export type ContactField = 'name' | 'email' | 'phone';

export interface Note {
  id: string;
  title: string;
  body: string;
}

export interface FileEntry {
  id: string;
  name: string;
  folder: string;
  sizeKb: number;
  modified: string; // YYYY-MM-DD
}
export type FileSortKey = 'name' | 'folder' | 'sizeKb' | 'modified';

export interface SettingDef {
  key: string;
  label: string;
  category: string;
  kind: 'toggle' | 'select';
  options?: string[];
}
export type SettingValue = boolean | string;

export interface WindowState {
  open: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

export interface ModalState {
  id: string;
  title: string;
  body: string;
  buttons: string[];
}

export interface Labels {
  contactsNew: string;
  contactsSave: string;
  filesMove: string;
}

export interface DesktopState {
  seed: number;
  labels: Labels;
  taskbarOrder: AppId[];
  windows: Record<AppId, WindowState>;
  focused: AppId | null;
  contacts: {
    list: Contact[];
    selectedId: string | null;
    draft: Contact | null;
    fieldOrder: ContactField[];
  };
  settings: {
    defs: SettingDef[];
    categories: string[];
    values: Record<string, SettingValue>;
    activeCategory: string;
    openDropdown: string | null;
  };
  notes: {
    list: Note[];
    activeId: string | null;
  };
  files: {
    list: FileEntry[];
    folders: string[];
    selected: string[];
    sortBy: FileSortKey | null;
    sortDir: 'asc' | 'desc';
    movePickerOpen: boolean;
  };
  modal: ModalState | null;
}

export type TaskKind = 'form' | 'settings' | 'transfer' | 'sort' | 'move';
export const TASK_KINDS: TaskKind[] = ['form', 'settings', 'transfer', 'sort', 'move'];

export interface Milestone {
  id: string;
  stage: number;
  weight: number;
  check: (s: DesktopState) => boolean;
}

export interface Task {
  id: string;
  kind: TaskKind;
  instruction: string;
  /** Ordered path. A milestone counts as met if its check passes OR any later milestone passes. */
  milestones: Milestone[];
  /** Minimum harness-level actions from the given state. */
  minActions: (s: DesktopState) => number;
  /** Target data for replays and the scripted oracle agent. */
  meta: Record<string, unknown>;
}

export interface Distraction {
  taskIndex: number;
  afterAction: number;
  modal: ModalState;
}

export type ActionClass = 'progress' | 'neutral' | 'regress' | 'wasted' | 'recovery';

export interface ActionRecord {
  taskIndex: number;
  actionIndex: number; // within task
  kind: string;
  detail?: string;
  progressBefore: number;
  progressAfter: number;
  classification: ActionClass;
  modalBefore: boolean;
  modalAfter: boolean;
  t: number; // ms since session start
}

export interface TaskResult {
  index: number;
  id: string;
  kind: TaskKind;
  instruction: string;
  minActions: number;
  actions: number;
  completed: boolean;
  finalProgress: number;
  startedAt: number;
  endedAt: number | null;
  distractionsShown: number;
}

export interface SessionSummary {
  seed: number;
  mode: 'human' | 'agent';
  taskCount: number;
  taskIndex: number;
  task: { id: string; kind: TaskKind; instruction: string; minActions: number; meta: Record<string, unknown> } | null;
  progress: number;
  actionCount: number;
  modalOpen: boolean;
  started: boolean;
  sessionComplete: boolean;
  elapsedMs: number;
}
