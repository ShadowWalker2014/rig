import type { Sandbox } from 'e2b'
import { DISPLAY } from './config'
import { ensureDesktop } from './services'
import { q, sh } from './shell'

// Desktop-level computer use in a box: the same actions as Claude's computer-use
// tool — screenshot, click, type, key, scroll, move, drag, zoom — done with
// xdotool and ImageMagick on the box's X display.
export type Button = 'left' | 'right' | 'middle'
export type Direction = 'up' | 'down' | 'left' | 'right'

const BUTTONS: Record<Button, number> = { left: 1, middle: 2, right: 3 }
const WHEEL: Record<Direction, number> = { up: 4, down: 5, left: 6, right: 7 }

// Friendly key names (as Claude and people write them) to X keysyms.
const KEY_NAMES: Record<string, string> = {
  enter: 'Return', return: 'Return', esc: 'Escape', escape: 'Escape', tab: 'Tab', space: 'space',
  backspace: 'BackSpace', delete: 'Delete', del: 'Delete', insert: 'Insert', home: 'Home', end: 'End',
  pageup: 'Prior', page_up: 'Prior', pagedown: 'Next', page_down: 'Next',
  up: 'Up', down: 'Down', left: 'Left', right: 'Right',
  ctrl: 'ctrl', control: 'ctrl', alt: 'alt', option: 'alt', shift: 'shift',
  cmd: 'super', command: 'super', super: 'super', meta: 'super', win: 'super',
}

// "ctrl+l", "Enter", "cmd+shift+t" → "ctrl+l", "Return", "super+shift+t".
export function toKeysym(combo: string): string {
  return combo
    .split('+')
    .map((part) => {
      const p = part.trim()
      if (/^f\d{1,2}$/i.test(p)) return p.toUpperCase()
      return KEY_NAMES[p.toLowerCase()] ?? (p.length === 1 ? p : p)
    })
    .join('+')
}

const xdo = (sbx: Sandbox, args: string) => sh(sbx, `DISPLAY=${DISPLAY} xdotool ${args}`, { timeoutMs: 30_000 })
const int = (n: number, what: string) => {
  if (!Number.isFinite(n) || n < 0 || n > 20_000) throw new Error(`${what} must be a number of pixels, got "${n}".`)
  return Math.round(n)
}

// A screenshot of the whole desktop, as PNG bytes.
export async function screenshot(sbx: Sandbox): Promise<Uint8Array> {
  await ensureDesktop(sbx)
  await sh(sbx, `DISPLAY=${DISPLAY} import -window root /tmp/rig-screen.png`, { timeoutMs: 30_000 })
  return sbx.files.read('/tmp/rig-screen.png', { format: 'bytes' })
}

// A close-up of one region, enlarged 2x so small text is readable.
export async function zoom(sbx: Sandbox, x0: number, y0: number, x1: number, y1: number): Promise<Uint8Array> {
  const [left, top, right, bottom] = [int(Math.min(x0, x1), 'x'), int(Math.min(y0, y1), 'y'), int(Math.max(x0, x1), 'x'), int(Math.max(y0, y1), 'y')]
  if (right - left < 4 || bottom - top < 4) throw new Error('The zoom region is too small.')
  await ensureDesktop(sbx)
  const crop = `${right - left}x${bottom - top}+${left}+${top}`
  await sh(sbx, `DISPLAY=${DISPLAY} import -window root -crop ${crop} +repage -resize 200% /tmp/rig-zoom.png`, { timeoutMs: 30_000 })
  return sbx.files.read('/tmp/rig-zoom.png', { format: 'bytes' })
}

export async function screenSize(sbx: Sandbox): Promise<{ width: number; height: number }> {
  const out = await sh(sbx, `DISPLAY=${DISPLAY} xdotool getdisplaygeometry`)
  const [width, height] = out.split(/\s+/).map(Number)
  return { width: width!, height: height! }
}

export async function click(sbx: Sandbox, x: number, y: number, button: Button = 'left', count = 1): Promise<void> {
  await xdo(sbx, `mousemove --sync ${int(x, 'x')} ${int(y, 'y')} click --repeat ${Math.max(1, Math.min(3, count))} --delay 80 ${BUTTONS[button]}`)
}

export async function move(sbx: Sandbox, x: number, y: number): Promise<void> {
  await xdo(sbx, `mousemove --sync ${int(x, 'x')} ${int(y, 'y')}`)
}

export async function drag(sbx: Sandbox, x0: number, y0: number, x1: number, y1: number): Promise<void> {
  await xdo(sbx, `mousemove --sync ${int(x0, 'x')} ${int(y0, 'y')} mousedown 1 mousemove --sync ${int(x1, 'x')} ${int(y1, 'y')} mouseup 1`)
}

export async function scroll(sbx: Sandbox, x: number, y: number, direction: Direction, amount = 3): Promise<void> {
  if (!(direction in WHEEL)) throw new Error('Scroll direction must be up, down, left or right.')
  await xdo(sbx, `mousemove --sync ${int(x, 'x')} ${int(y, 'y')} click --repeat ${Math.max(1, Math.min(30, amount))} --delay 40 ${WHEEL[direction]}`)
}

// Types text into whatever has focus, in chunks so long text does not time out.
export async function type(sbx: Sandbox, text: string): Promise<void> {
  for (let i = 0; i < text.length; i += 200) await xdo(sbx, `type --delay 12 -- ${q(text.slice(i, i + 200))}`)
}

export async function key(sbx: Sandbox, combo: string): Promise<void> {
  if (!/^[\w+\- ]+$/.test(combo)) throw new Error(`"${combo}" is not a key. Examples: Enter, ctrl+l, cmd+shift+t.`)
  await xdo(sbx, `key --clearmodifiers ${combo.split(' ').filter(Boolean).map(toKeysym).map(q).join(' ')}`)
}

export async function cursor(sbx: Sandbox): Promise<{ x: number; y: number }> {
  const out = await xdo(sbx, 'getmouselocation --shell')
  return { x: Number(out.match(/X=(\d+)/)?.[1]), y: Number(out.match(/Y=(\d+)/)?.[1]) }
}
