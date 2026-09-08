import type { AppId, WindowState } from './types';
import { APP_IDS } from './types';

type Windows = Record<AppId, WindowState>;

export function intersects(a: WindowState, b: WindowState): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** True when the app's window is open but another open window above it overlaps it. */
export function needsRaise(windows: Windows, app: AppId): boolean {
  const w = windows[app];
  if (!w.open) return false;
  return APP_IDS.some((o) => o !== app && windows[o].open && windows[o].z > w.z && intersects(windows[o], w));
}

/** Actions needed before the app's controls are reachable: 1 to open or raise it, else 0. */
export function openCost(windows: Windows, app: AppId): number {
  return !windows[app].open || needsRaise(windows, app) ? 1 : 0;
}

/** The window layout after the app has been opened/raised via the taskbar. */
export function withRaised(windows: Windows, app: AppId): Windows {
  const maxZ = Math.max(...APP_IDS.map((a) => windows[a].z));
  return { ...windows, [app]: { ...windows[app], open: true, z: maxZ + 1 } };
}
