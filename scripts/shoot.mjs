// Screenshots the site pages for visual review. Usage: node scripts/shoot.mjs <outDir> [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs';

const out = process.argv[2] ?? 'runs';
const base = process.argv[3] ?? 'http://localhost:5173';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

const pages = [
  ['landing', '/', 6000],
  ['leaderboard', '/leaderboard', 800],
  ['replays', '/replay', 800],
  ['play', '/play', 800],
];
let firstReplay = null;
for (const [name, path, wait] of pages) {
  await page.goto(base + path);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/site-${name}.png`, fullPage: true });
  if (name === 'replays') firstReplay = await page.evaluate(() => document.querySelector('.run-list a')?.getAttribute('href'));
}
if (firstReplay) {
  await page.goto(base + firstReplay);
  await page.waitForTimeout(12000);
  await page.screenshot({ path: `${out}/site-replay.png`, fullPage: true });
  console.log('replay view state:', await page.evaluate(() => ({ actions: document.querySelectorAll('.action-log li.is-done').length, current: document.querySelector('.action-log li.is-current')?.textContent, oracle: window.__oracle.summary() })));
}
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base + '/');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/site-mobile.png`, fullPage: true });
console.log('errors:', errors);
await browser.close();
