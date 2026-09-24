import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Args } from './args'
import { openBox } from './box'
import { target } from './commands'
import * as computer from './computer'

// `rig screen`, `rig click`, `rig type`… — computer use from the command line.
// Each acts on this repo + branch's box, or -b <box>.
const box = async (a: Args) => openBox((await target(a, false)).sandboxId)
const num = (a: Args, i: number, what: string) => {
  const n = Number(a.sub[i])
  if (a.sub[i] === undefined || Number.isNaN(n)) throw new Error(`Missing ${what}. See \`rig help ${a.cmd}\`.`)
  return n
}
const savePng = (bytes: Uint8Array, out: string | undefined, prefix: string) => {
  const path = resolve(out ?? join(tmpdir(), `${prefix}-${Date.now()}.png`))
  writeFileSync(path, bytes)
  return path
}

export async function screen(a: Args): Promise<void> {
  const sbx = await box(a)
  const [png, size] = await Promise.all([computer.screenshot(sbx), computer.screenSize(sbx)])
  console.log(savePng(png, a.sub[0], 'rig-screen'))
  console.error(`Desktop is ${size.width}x${size.height}; click coordinates use the same pixels.`)
}

export async function zoom(a: Args): Promise<void> {
  const png = await computer.zoom(await box(a), num(a, 0, 'x0'), num(a, 1, 'y0'), num(a, 2, 'x1'), num(a, 3, 'y1'))
  console.log(savePng(png, a.sub[4], 'rig-zoom'))
}

export async function click(a: Args): Promise<void> {
  const button: computer.Button = a.flags.right ? 'right' : a.flags.middle ? 'middle' : 'left'
  const count = a.flags.triple ? 3 : a.flags.double ? 2 : 1
  await computer.click(await box(a), num(a, 0, 'x'), num(a, 1, 'y'), button, count)
}

export async function move(a: Args): Promise<void> {
  await computer.move(await box(a), num(a, 0, 'x'), num(a, 1, 'y'))
}

export async function drag(a: Args): Promise<void> {
  await computer.drag(await box(a), num(a, 0, 'x0'), num(a, 1, 'y0'), num(a, 2, 'x1'), num(a, 3, 'y1'))
}

export async function scroll(a: Args): Promise<void> {
  const direction = (a.sub[2] ?? 'down') as computer.Direction
  await computer.scroll(await box(a), num(a, 0, 'x'), num(a, 1, 'y'), direction, Number(a.sub[3] ?? 3))
}

export async function type(a: Args): Promise<void> {
  const text = a.rest.length ? a.rest.join(' ') : a.sub.join(' ')
  if (!text) throw new Error('Usage: rig type "text to type"')
  await computer.type(await box(a), text)
}

export async function key(a: Args): Promise<void> {
  if (!a.sub.length) throw new Error('Usage: rig key <keys>   e.g. rig key ctrl+l, rig key Enter')
  await computer.key(await box(a), a.sub.join(' '))
}

export async function cursor(a: Args): Promise<void> {
  const { x, y } = await computer.cursor(await box(a))
  console.log(`${x} ${y}`)
}

