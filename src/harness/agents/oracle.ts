import type { Page } from 'playwright';
import type { ContactField, DesktopState } from '../../core/types';
import { openCost } from '../../core/layout';
import type { Env } from '../env';
import { emptyStats, type Agent } from './types';

/**
 * Scripted solver that reads the page oracle and clicks by coordinate through the same executor as a model.
 * Establishes the ceiling: it should complete every task in exactly minActions.
 */
export function oracleAgent(): Agent {
  return {
    name: 'oracle',
    async run(env: Env) {
      const stats = emptyStats();
      let guard = 0;
      while (!(await env.shouldStop())) {
        if (++guard > 500) throw new Error('oracle agent runaway');
        const t0 = Date.now();
        const step = await nextStep(env.page, await env.state(), await env.summary());
        if (!step) throw new Error('oracle agent could not decide a step');
        await env.perform(step.name, step.input);
        stats.modelMs += Date.now() - t0;
        stats.steps++;
      }
      return stats;
    },
  };
}

interface Step {
  name: string;
  input: Record<string, unknown>;
}

interface Target {
  x: number;
  y: number;
  hit: boolean;
  inViewport: boolean;
  title: [number, number] | null;
}

async function locate(page: Page, testId: string, yFrac: number): Promise<Target | null> {
  return page.evaluate(
    ({ id, yFrac }) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const x = Math.round(r.x + r.width / 2);
      const y = Math.round(r.y + r.height * yFrac);
      const top = document.elementFromPoint(x, y);
      const hit = !!top && (el === top || el.contains(top));
      const inViewport = x >= 0 && x < 1280 && y >= 0 && y < 800;
      const tr = el.closest('[data-testid^="window-"]')?.querySelector('.window-title')?.getBoundingClientRect();
      const title: [number, number] | null = tr ? [Math.round(tr.x + 60), Math.round(tr.y + tr.height / 2)] : null;
      return { x, y, hit, inViewport, title };
    },
    { id: testId, yFrac },
  );
}

/** Click a control by test id. If another window occludes it, raise its window first (an extra action). */
async function clickStep(page: Page, testId: string, yFrac = 0.5): Promise<Step> {
  const t = await locate(page, testId, yFrac);
  if (!t) throw new Error(`oracle agent: no element ${testId}`);
  if (!t.inViewport) throw new Error(`oracle agent: ${testId} is outside the viewport at (${t.x},${t.y})`);
  if (!t.hit) throw new Error(`oracle agent: ${testId} is occluded at (${t.x},${t.y}); openCost should have raised its window`);
  return { name: 'left_click', input: { coordinate: [t.x, t.y] } };
}

async function nextStep(page: Page, s: DesktopState, sum: Awaited<ReturnType<Env['summary']>>): Promise<Step | null> {
  if (s.modal) return clickStep(page, 'modal-btn-0');
  const task = sum.task;
  if (!task) return null;
  const meta = task.meta as Record<string, any>;

  switch (task.kind) {
    case 'form': {
      if (openCost(s.windows, 'contacts')) return clickStep(page, 'taskbar-contacts');
      if (!s.contacts.draft) return clickStep(page, 'contacts-new');
      for (const f of s.contacts.fieldOrder as ContactField[]) {
        if (s.contacts.draft[f] !== meta[f]) {
          const focused = await page.evaluate((id) => document.activeElement?.getAttribute('data-testid') === id, `contacts-field-${f}`);
          if (!focused) return clickStep(page, `contacts-field-${f}`);
          return { name: 'type', input: { text: meta[f] } };
        }
      }
      return clickStep(page, 'contacts-save');
    }
    case 'settings': {
      if (openCost(s.windows, 'settings')) return clickStep(page, 'taskbar-settings');
      if (s.settings.activeCategory !== meta.category) return clickStep(page, `settings-cat-${meta.category}`);
      if (meta.kind === 'toggle') return clickStep(page, `setting-toggle-${meta.key}`);
      if (s.settings.openDropdown !== meta.key) return clickStep(page, `setting-select-${meta.key}`);
      return clickStep(page, `setting-option-${meta.key}-${meta.target}`);
    }
    case 'transfer': {
      if (s.contacts.selectedId !== meta.contactId) {
        if (openCost(s.windows, 'contacts')) return clickStep(page, 'taskbar-contacts');
        return clickStep(page, `contact-${meta.contactId}`);
      }
      if (openCost(s.windows, 'notes')) return clickStep(page, 'taskbar-notes');
      if (s.notes.activeId !== meta.noteId) return clickStep(page, `note-${meta.noteId}`);
      const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'note-body');
      if (!focused) return clickStep(page, 'note-body', 0.92); // click near the bottom so the caret lands at the end
      return { name: 'type', input: { text: ` ${meta.phone}` } };
    }
    case 'sort': {
      if (openCost(s.windows, 'files')) return clickStep(page, 'taskbar-files');
      return clickStep(page, `files-sort-${meta.key}`);
    }
    case 'move': {
      if (openCost(s.windows, 'files')) return clickStep(page, 'taskbar-files');
      const ids: string[] = meta.ids;
      const pending = ids.filter((id) => s.files.list.find((f) => f.id === id)?.folder !== meta.folder);
      const unselected = pending.filter((id) => !s.files.selected.includes(id));
      if (unselected.length) return clickStep(page, `file-${unselected[0]}`);
      if (!s.files.movePickerOpen) return clickStep(page, 'files-move');
      return clickStep(page, `files-move-${meta.folder}`);
    }
  }
  return null;
}
