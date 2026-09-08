/**
 * Simulates a person playing human mode: clicks through the start screen, solves each task with
 * locator clicks and character-by-character typing, then reads the results screen.
 * Usage: npx tsx src/harness/humanSim.ts [seed] [tasks] [baseUrl]
 */
import { chromium } from 'playwright';
import { openCost } from '../core/layout';
import type { ContactField } from '../core/types';

const seed = Number(process.argv[2] ?? 42);
const tasks = Number(process.argv[3] ?? 5);
const base = process.argv[4] ?? 'http://localhost:5173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${base}/?seed=${seed}&tasks=${tasks}`);
await page.getByTestId('start').click();
await page.waitForSelector('[data-testid=topbar]');

const type = (text: string) => page.keyboard.type(text, { delay: 20 });
const click = (id: string) => page.getByTestId(id).first().click({ force: true });

for (let guard = 0; guard < 300; guard++) {
  const sum = await page.evaluate(() => window.__oracle.summary());
  if (sum.sessionComplete) break;
  const s = await page.evaluate(() => window.__oracle.state());
  if (s.modal) {
    await click('modal-btn-0');
    continue;
  }
  const meta = sum.task!.meta as Record<string, any>;
  switch (sum.task!.kind) {
    case 'form': {
      if (openCost(s.windows, 'contacts')) await click('taskbar-contacts');
      else if (!s.contacts.draft) await click('contacts-new');
      else {
        const f = (s.contacts.fieldOrder as ContactField[]).find((f) => s.contacts.draft![f] !== meta[f]);
        if (f) {
          await click(`contacts-field-${f}`);
          await type(meta[f]);
        } else await click('contacts-save');
      }
      break;
    }
    case 'settings': {
      if (openCost(s.windows, 'settings')) await click('taskbar-settings');
      else if (s.settings.activeCategory !== meta.category) await click(`settings-cat-${meta.category}`);
      else if (meta.kind === 'toggle') await click(`setting-toggle-${meta.key}`);
      else if (s.settings.openDropdown !== meta.key) await click(`setting-select-${meta.key}`);
      else await click(`setting-option-${meta.key}-${meta.target}`);
      break;
    }
    case 'transfer': {
      if (s.contacts.selectedId !== meta.contactId) {
        if (openCost(s.windows, 'contacts')) await click('taskbar-contacts');
        else await click(`contact-${meta.contactId}`);
      } else if (openCost(s.windows, 'notes')) await click('taskbar-notes');
      else if (s.notes.activeId !== meta.noteId) await click(`note-${meta.noteId}`);
      else {
        await click('note-body');
        await page.keyboard.press('Control+End');
        await type(` ${meta.phone}`);
      }
      break;
    }
    case 'sort': {
      if (openCost(s.windows, 'files')) await click('taskbar-files');
      else await click(`files-sort-${meta.key}`);
      break;
    }
    case 'move': {
      if (openCost(s.windows, 'files')) await click('taskbar-files');
      else {
        const pending = (meta.ids as string[]).filter((id) => s.files.list.find((f) => f.id === id)?.folder !== meta.folder);
        const unselected = pending.filter((id) => !s.files.selected.includes(id));
        if (unselected.length) await click(`file-${unselected[0]}`);
        else if (!s.files.movePickerOpen) await click('files-move');
        else await click(`files-move-${meta.folder}`);
      }
      break;
    }
  }
  await page.waitForTimeout(60);
}

await page.waitForTimeout(500);
const exp = await page.evaluate(() => window.__oracle.export());
const capm = await page.locator('.results-capm').textContent().catch(() => null);
console.log(`results screen CAPM: ${capm}`);
console.log(`tasks completed: ${exp.tasks.filter((t) => t.completed).length}/${exp.taskCount}`);
for (const t of exp.tasks) {
  const acts = exp.actions.filter((a) => a.taskIndex === t.index).map((a) => `${a.kind}:${a.detail ?? ''}=${a.classification[0]}`);
  console.log(`  ${t.index} ${t.kind.padEnd(8)} min ${t.minActions} actions ${t.actions}  ${acts.join(' ')}`);
}
const classes: Record<string, number> = {};
for (const a of exp.actions) classes[a.classification] = (classes[a.classification] ?? 0) + 1;
console.log('classes', classes);
console.log('page errors', errors);
await page.screenshot({ path: 'runs/human-results.png' });
await browser.close();
