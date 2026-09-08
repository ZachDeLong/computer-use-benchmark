import type { Page } from 'playwright';

/** Actions that change desktop state and therefore count as harness-level actions. */
export const COUNTED_ACTIONS = new Set([
  'left_click',
  'right_click',
  'middle_click',
  'double_click',
  'triple_click',
  'left_click_drag',
  'left_mouse_down',
  'left_mouse_up',
  'scroll',
  'type',
  'key',
  'hold_key',
]);

const KEY_MAP: Record<string, string> = {
  return: 'Enter',
  enter: 'Enter',
  kp_enter: 'Enter',
  backspace: 'Backspace',
  tab: 'Tab',
  escape: 'Escape',
  esc: 'Escape',
  space: 'Space',
  delete: 'Delete',
  home: 'Home',
  end: 'End',
  page_up: 'PageUp',
  pageup: 'PageUp',
  page_down: 'PageDown',
  pagedown: 'PageDown',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  ctrl: 'Control',
  control: 'Control',
  alt: 'Alt',
  shift: 'Shift',
  super: 'Meta',
  cmd: 'Meta',
  meta: 'Meta',
  win: 'Meta',
};

export function toPlaywrightKey(xdo: string): string {
  return xdo
    .split('+')
    .map((k) => {
      const t = k.trim();
      const lower = t.toLowerCase();
      if (KEY_MAP[lower]) return KEY_MAP[lower];
      if (/^f\d{1,2}$/i.test(t)) return t.toUpperCase();
      return t.length === 1 ? t : t[0].toUpperCase() + t.slice(1);
    })
    .join('+');
}

export type ActionInput = Record<string, unknown>;

export class Executor {
  cursor = { x: 0, y: 0 };
  constructor(
    readonly page: Page,
    readonly viewport: { width: number; height: number },
  ) {}

  async screenshot(): Promise<Buffer> {
    return this.page.screenshot({ type: 'png' });
  }

  private coord(input: ActionInput, key = 'coordinate'): { x: number; y: number } | null {
    const c = input[key];
    if (!Array.isArray(c) || c.length !== 2) return null;
    const x = Math.max(0, Math.min(this.viewport.width - 1, Math.round(Number(c[0]))));
    const y = Math.max(0, Math.min(this.viewport.height - 1, Math.round(Number(c[1]))));
    return { x, y };
  }

  private modifiers(input: ActionInput): string[] {
    const t = typeof input.text === 'string' ? input.text : '';
    return t
      ? t
          .split('+')
          .map((m) => KEY_MAP[m.trim().toLowerCase()] ?? m.trim())
          .filter(Boolean)
      : [];
  }

  private async withModifiers<T>(mods: string[], fn: () => Promise<T>): Promise<T> {
    for (const m of mods) await this.page.keyboard.down(m);
    try {
      return await fn();
    } finally {
      for (const m of [...mods].reverse()) await this.page.keyboard.up(m);
    }
  }

  private async click(input: ActionInput, button: 'left' | 'right' | 'middle', clickCount: number) {
    const c = this.coord(input) ?? this.cursor;
    this.cursor = c;
    await this.withModifiers(this.modifiers(input), async () => {
      await this.page.mouse.click(c.x, c.y, { button, clickCount });
    });
  }

  /** Execute one computer-toolset member. Returns text or a screenshot buffer (for screenshot/zoom). */
  async execute(name: string, input: ActionInput): Promise<{ text?: string; image?: Buffer }> {
    switch (name) {
      case 'screenshot':
        return { image: await this.screenshot() };
      case 'zoom': {
        const r = input.region;
        if (!Array.isArray(r) || r.length !== 4) throw new Error('zoom requires region [x0,y0,x1,y1]');
        const [x0, y0, x1, y1] = r.map((v) => Number(v));
        const clip = { x: Math.max(0, x0), y: Math.max(0, y0), width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
        return { image: await this.page.screenshot({ type: 'png', clip }) };
      }
      case 'left_click':
        await this.click(input, 'left', 1);
        return { text: 'OK' };
      case 'right_click':
        await this.click(input, 'right', 1);
        return { text: 'OK' };
      case 'middle_click':
        await this.click(input, 'middle', 1);
        return { text: 'OK' };
      case 'double_click':
        await this.click(input, 'left', 2);
        return { text: 'OK' };
      case 'triple_click':
        await this.click(input, 'left', 3);
        return { text: 'OK' };
      case 'left_click_drag': {
        const from = this.coord(input, 'start_coordinate') ?? this.cursor;
        const to = this.coord(input);
        if (!to) throw new Error('left_click_drag requires coordinate');
        await this.withModifiers(this.modifiers(input), async () => {
          await this.page.mouse.move(from.x, from.y);
          await this.page.mouse.down();
          await this.page.mouse.move(to.x, to.y, { steps: 8 });
          await this.page.mouse.up();
        });
        this.cursor = to;
        return { text: 'OK' };
      }
      case 'mouse_move': {
        const c = this.coord(input);
        if (!c) throw new Error('mouse_move requires coordinate');
        await this.page.mouse.move(c.x, c.y);
        this.cursor = c;
        return { text: 'OK' };
      }
      case 'left_mouse_down':
        await this.page.mouse.down();
        return { text: 'OK' };
      case 'left_mouse_up':
        await this.page.mouse.up();
        return { text: 'OK' };
      case 'cursor_position':
        return { text: `X=${this.cursor.x}, Y=${this.cursor.y}` };
      case 'scroll': {
        const c = this.coord(input);
        if (c) {
          await this.page.mouse.move(c.x, c.y);
          this.cursor = c;
        }
        const amount = Math.max(1, Number(input.scroll_amount ?? 3)) * 100;
        const dir = String(input.scroll_direction ?? 'down');
        const dx = dir === 'left' ? -amount : dir === 'right' ? amount : 0;
        const dy = dir === 'up' ? -amount : dir === 'down' ? amount : 0;
        await this.withModifiers(this.modifiers(input), async () => {
          await this.page.mouse.wheel(dx, dy);
        });
        return { text: 'OK' };
      }
      case 'type': {
        const text = String(input.text ?? '');
        await this.page.keyboard.type(text, { delay: 5 });
        return { text: 'OK' };
      }
      case 'key':
      case 'hold_key': {
        const combo = toPlaywrightKey(String(input.text ?? ''));
        const repeat = Math.max(1, Math.min(100, Number(input.repeat ?? 1)));
        for (let i = 0; i < repeat; i++) await this.page.keyboard.press(combo);
        return { text: 'OK' };
      }
      case 'wait': {
        const secs = Math.max(0, Math.min(30, Number(input.duration ?? 1)));
        await this.page.waitForTimeout(secs * 1000);
        return { text: 'OK' };
      }
      default:
        throw new Error(`Unsupported computer action: ${name}`);
    }
  }
}
