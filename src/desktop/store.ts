import { create } from 'zustand';
import { Session, type ActionEffects } from '../core/session';
import type { AppId, ContactField, DesktopState, FileSortKey, ModalState, SettingValue } from '../core/types';

export type Phase = 'start' | 'running' | 'done';
export type Mode = 'human' | 'agent' | 'replay';

export interface DesktopStore {
  desktop: DesktopState;
  phase: Phase;
  mode: Mode;
  session: Session | null;
  flashUntil: number;

  init(seed: number, mode: Mode, taskCount: number): void;
  startSession(): void;

  openApp(app: AppId): void;
  focusApp(app: AppId): void;
  closeApp(app: AppId): void;

  contactsSelect(id: string): void;
  contactsNew(): void;
  contactsSetField(field: ContactField, value: string): void;
  contactsSave(): void;
  contactsCancel(): void;

  settingsCategory(cat: string): void;
  settingsToggle(key: string): void;
  settingsOpenDropdown(key: string | null): void;
  settingsSelect(key: string, value: SettingValue): void;

  notesSelect(id: string): void;
  notesSetBody(id: string, body: string): void;

  filesToggleSelect(id: string): void;
  filesSort(key: FileSortKey): void;
  filesMovePicker(open: boolean): void;
  filesMoveTo(folder: string): void;

  showModal(m: ModalState): void;
  dismissModal(): void;

  beginAction(kind: string, detail?: string): void;
  endAction(): ActionEffects | null;
  checkComplete(): ActionEffects | null;
}

const now = () => Date.now();

export const useStore = create<DesktopStore>((set, get) => {
  const update = (fn: (d: DesktopState) => Partial<DesktopState>) =>
    set((s) => ({ desktop: { ...s.desktop, ...fn(s.desktop) } }));

  const applyEffects = (fx: ActionEffects | null) => {
    if (!fx) return fx;
    if (fx.showModal) update(() => ({ modal: fx.showModal }));
    if (fx.taskAdvanced) set({ flashUntil: now() + 1200 });
    if (fx.sessionComplete) set({ phase: 'done' });
    return fx;
  };

  const raiseWindow = (d: DesktopState, app: AppId) => {
    const maxZ = Math.max(...Object.values(d.windows).map((w) => w.z));
    return { ...d.windows, [app]: { ...d.windows[app], open: true, z: maxZ + 1 } };
  };

  return {
    desktop: new Session(1, 'human', 1).initialState,
    phase: 'start',
    mode: 'human',
    session: null,
    flashUntil: 0,

    init(seed, mode, taskCount) {
      const session = new Session(seed, mode === 'replay' ? 'agent' : mode, taskCount);
      set({ session, desktop: session.initialState, mode, phase: 'start', flashUntil: 0 });
    },
    startSession() {
      const { session, desktop } = get();
      if (!session) return;
      session.start(desktop, now());
      set({ phase: 'running' });
    },

    openApp: (app) => update((d) => ({ windows: raiseWindow(d, app), focused: app })),
    focusApp: (app) => update((d) => (d.focused === app ? {} : { windows: raiseWindow(d, app), focused: app })),
    closeApp: (app) =>
      update((d) => ({
        windows: { ...d.windows, [app]: { ...d.windows[app], open: false } },
        focused: d.focused === app ? null : d.focused,
        contacts: app === 'contacts' ? { ...d.contacts, draft: null } : d.contacts,
        settings: app === 'settings' ? { ...d.settings, openDropdown: null } : d.settings,
        files: app === 'files' ? { ...d.files, movePickerOpen: false } : d.files,
      })),

    contactsSelect: (id) => update((d) => ({ contacts: { ...d.contacts, selectedId: id, draft: null } })),
    contactsNew: () =>
      update((d) => ({ contacts: { ...d.contacts, draft: { id: `c${d.contacts.list.length}-${Date.now()}`, name: '', email: '', phone: '' } } })),
    contactsSetField: (field, value) =>
      update((d) => (d.contacts.draft ? { contacts: { ...d.contacts, draft: { ...d.contacts.draft, [field]: value } } } : {})),
    contactsSave: () =>
      update((d) => {
        const draft = d.contacts.draft;
        if (!draft || !draft.name.trim()) return {};
        const saved = { ...draft, name: draft.name.trim(), email: draft.email.trim(), phone: draft.phone.trim() };
        return { contacts: { ...d.contacts, list: [...d.contacts.list, saved], draft: null, selectedId: saved.id } };
      }),
    contactsCancel: () => update((d) => ({ contacts: { ...d.contacts, draft: null } })),

    settingsCategory: (cat) => update((d) => ({ settings: { ...d.settings, activeCategory: cat, openDropdown: null } })),
    settingsToggle: (key) =>
      update((d) => ({ settings: { ...d.settings, values: { ...d.settings.values, [key]: !d.settings.values[key] } } })),
    settingsOpenDropdown: (key) => update((d) => ({ settings: { ...d.settings, openDropdown: key } })),
    settingsSelect: (key, value) =>
      update((d) => ({ settings: { ...d.settings, values: { ...d.settings.values, [key]: value }, openDropdown: null } })),

    notesSelect: (id) => update((d) => ({ notes: { ...d.notes, activeId: id } })),
    notesSetBody: (id, body) =>
      update((d) => ({ notes: { ...d.notes, list: d.notes.list.map((n) => (n.id === id ? { ...n, body } : n)) } })),

    filesToggleSelect: (id) =>
      update((d) => ({
        files: {
          ...d.files,
          selected: d.files.selected.includes(id) ? d.files.selected.filter((x) => x !== id) : [...d.files.selected, id],
          movePickerOpen: false,
        },
      })),
    filesSort: (key) =>
      update((d) => ({
        files: {
          ...d.files,
          sortBy: key,
          sortDir: d.files.sortBy === key && d.files.sortDir === 'asc' ? 'desc' : 'asc',
          movePickerOpen: false,
        },
      })),
    filesMovePicker: (open) => update((d) => ({ files: { ...d.files, movePickerOpen: open && d.files.selected.length > 0 } })),
    filesMoveTo: (folder) =>
      update((d) => ({
        files: {
          ...d.files,
          list: d.files.list.map((f) => (d.files.selected.includes(f.id) ? { ...f, folder } : f)),
          selected: [],
          movePickerOpen: false,
        },
      })),

    showModal: (m) => update(() => ({ modal: m })),
    dismissModal: () => update(() => ({ modal: null })),

    beginAction(kind, detail) {
      const { session, phase } = get();
      if (!session || phase !== 'running') return;
      session.beginAction(kind, detail, now());
    },
    endAction() {
      const { session, desktop, phase } = get();
      if (!session || phase !== 'running') return null;
      return applyEffects(session.endAction(desktop, now()));
    },
    checkComplete() {
      const { session, desktop, phase } = get();
      if (!session || phase !== 'running') return null;
      return applyEffects(session.checkComplete(desktop, now()));
    },
  };
});
