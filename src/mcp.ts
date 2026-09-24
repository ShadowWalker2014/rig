import { CommandExitError, type Sandbox } from 'e2b'
import { str, type Args } from './args'
import { listBoxes, openBox, resolveBox } from './box'
import { target } from './commands'
import * as computer from './computer'
import { HOME } from './config'
import { clean } from './sanitize'

// `rig mcp`: a Model Context Protocol server on stdin/stdout, so Claude Code (or
// any MCP client) can use a cloud desktop with native tools and see screenshots
// as images. Plain newline-delimited JSON-RPC 2.0; no dependencies.
type Json = Record<string, any>
type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: 'image/png' }
type Result = { content: Content[]; isError?: boolean }

const text = (t: string): Content => ({ type: 'text', text: clean(t) })
const image = (png: Uint8Array): Content => ({ type: 'image', data: Buffer.from(png).toString('base64'), mimeType: 'image/png' })
const BOX = { box: { type: 'string', description: 'Box id or name. Defaults to the box rig mcp was started for.' } }
const POINT = { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }

export const TOOLS = [
  {
    name: 'computer',
    description:
      "Use the cloud desktop's whole screen, like a computer: take a screenshot, click, type, press keys, scroll, drag and zoom. Coordinates are screen pixels from the latest screenshot. Actions return a fresh screenshot.",
    inputSchema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: ['screenshot', 'left_click', 'right_click', 'middle_click', 'double_click', 'triple_click', 'mouse_move', 'left_click_drag', 'scroll', 'type', 'key', 'zoom', 'cursor_position', 'wait'],
        },
        coordinate: { ...POINT, description: '[x, y] for clicks, mouse_move, scroll, and the end of a drag' },
        start_coordinate: { ...POINT, description: '[x, y] where a left_click_drag starts' },
        text: { type: 'string', description: 'Text for type, or keys for key, e.g. "ctrl+l" or "Enter"' },
        scroll_direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] },
        scroll_amount: { type: 'number', description: 'Wheel clicks, default 3' },
        region: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4, description: '[x0, y0, x1, y1] for zoom' },
        duration: { type: 'number', description: 'Seconds for wait, up to 10' },
        ...BOX,
      },
    },
  },
  {
    name: 'browser',
    description:
      "Drive the cloud desktop's signed-in Chrome with agent-browser commands, e.g. [\"open\", \"http://localhost:3000\"], [\"snapshot\", \"-i\"], [\"click\", \"@e3\"], [\"fill\", \"@e5\", \"text\"], [\"console\"]. [\"screenshot\"] returns the page as an image. [\"skills\", \"get\", \"core\", \"--full\"] prints the full guide.",
    inputSchema: { type: 'object', required: ['args'], properties: { args: { type: 'array', items: { type: 'string' } }, ...BOX } },
  },
  {
    name: 'shell',
    description: "Run a shell command in the cloud desktop, in the repo's folder by default. Returns its output and exit code.",
    inputSchema: {
      type: 'object',
      required: ['command'],
      properties: { command: { type: 'string' }, cwd: { type: 'string' }, timeout_seconds: { type: 'number', description: 'Default 300' }, ...BOX },
    },
  },
  {
    name: 'boxes',
    description: 'List your cloud desktops: id, name, state, repo and branch.',
    inputSchema: { type: 'object', properties: {} },
  },
]

// The box a tool call acts on: named in the call, or the one rig mcp started for.
async function boxFor(args: Json, fallback: () => Promise<string>): Promise<{ sbx: Sandbox; dir: string }> {
  const info = args.box ? await resolveBox(String(args.box)) : await resolveBox(await fallback())
  return { sbx: await openBox(info.sandboxId, 600_000), dir: info.metadata.dir ?? HOME }
}

const point = (p: unknown, what: string): [number, number] => {
  if (!Array.isArray(p) || p.length !== 2) throw new Error(`${what} must be [x, y].`)
  return [Number(p[0]), Number(p[1])]
}

async function afterAction(sbx: Sandbox): Promise<Result> {
  await Bun.sleep(500) // let the screen settle before showing it
  return { content: [image(await computer.screenshot(sbx))] }
}

export async function runComputer(sbx: Sandbox, a: Json): Promise<Result> {
  const act = String(a.action)
  const clicks: Record<string, [computer.Button, number]> = {
    left_click: ['left', 1], right_click: ['right', 1], middle_click: ['middle', 1], double_click: ['left', 2], triple_click: ['left', 3],
  }
  if (act === 'screenshot') {
    const [png, size] = await Promise.all([computer.screenshot(sbx), computer.screenSize(sbx)])
    return { content: [image(png), text(`Screen is ${size.width}x${size.height} pixels.`)] }
  }
  if (act in clicks) await computer.click(sbx, ...point(a.coordinate, 'coordinate'), ...clicks[act]!)
  else if (act === 'mouse_move') await computer.move(sbx, ...point(a.coordinate, 'coordinate'))
  else if (act === 'left_click_drag') await computer.drag(sbx, ...point(a.start_coordinate, 'start_coordinate'), ...point(a.coordinate, 'coordinate'))
  else if (act === 'scroll') await computer.scroll(sbx, ...point(a.coordinate, 'coordinate'), a.scroll_direction ?? 'down', Number(a.scroll_amount ?? 3))
  else if (act === 'type') await computer.type(sbx, String(a.text ?? ''))
  else if (act === 'key') await computer.key(sbx, String(a.text ?? ''))
  else if (act === 'zoom') {
    const [x0, y0, x1, y1] = (a.region ?? []).map(Number)
    return { content: [image(await computer.zoom(sbx, x0, y0, x1, y1))] }
  } else if (act === 'cursor_position') {
    const { x, y } = await computer.cursor(sbx)
    return { content: [text(`${x} ${y}`)] }
  } else if (act === 'wait') await Bun.sleep(Math.min(10, Math.max(0, Number(a.duration ?? 1))) * 1000)
  else throw new Error(`Unknown action "${act}".`)
  return afterAction(sbx)
}

async function run(sbx: Sandbox, command: string, cwd: string, timeoutMs: number): Promise<{ out: string; code: number }> {
  try {
    const r = await sbx.commands.run(command, { cwd, timeoutMs })
    return { out: r.stdout + r.stderr, code: 0 }
  } catch (err) {
    if (err instanceof CommandExitError) return { out: err.stdout + err.stderr, code: err.exitCode }
    throw err
  }
}

const shellWords = (words: string[]) => words.map((w) => `'${w.replace(/'/g, `'\\''`)}'`).join(' ')

async function callTool(name: string, args: Json, fallback: () => Promise<string>): Promise<Result> {
  if (name === 'boxes') {
    const rows = (await listBoxes()).map((b) => `${b.sandboxId}  ${b.metadata.name ?? ''}  ${b.state}  ${b.metadata.repo ?? ''} ${b.metadata.branch ?? ''}`)
    return { content: [text(rows.join('\n') || 'No boxes. Run `rig up` in a repo, or `rig new`.')] }
  }
  const { sbx, dir } = await boxFor(args, fallback)
  if (name === 'computer') return runComputer(sbx, args)
  if (name === 'browser') {
    const words = (args.args ?? []).map(String)
    if (words[0] === 'screenshot') {
      await run(sbx, 'rig-ab screenshot /tmp/rig-mcp-shot.png', HOME, 60_000)
      return { content: [image(await sbx.files.read('/tmp/rig-mcp-shot.png', { format: 'bytes' }))] }
    }
    const r = await run(sbx, `rig-ab ${shellWords(words)}`, HOME, 300_000)
    return { content: [text(r.out || '(no output)')], isError: r.code !== 0 }
  }
  if (name === 'shell') {
    const r = await run(sbx, String(args.command), String(args.cwd ?? dir), Number(args.timeout_seconds ?? 300) * 1000)
    return { content: [text(`${r.out.slice(-20_000) || '(no output)'}\n[exit ${r.code}]`)], isError: r.code !== 0 }
  }
  throw new Error(`Unknown tool "${name}".`)
}

async function handle(msg: Json, fallback: () => Promise<string>): Promise<Json | undefined> {
  const reply = (result: Json) => ({ jsonrpc: '2.0', id: msg.id, result })
  if (msg.method === 'initialize') {
    return reply({ protocolVersion: msg.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'rig', version: '0.1.0' } })
  }
  if (msg.method === 'ping') return reply({})
  if (msg.method === 'tools/list') return reply({ tools: TOOLS })
  if (msg.method === 'tools/call') {
    try {
      return reply(await callTool(msg.params?.name, msg.params?.arguments ?? {}, fallback))
    } catch (err) {
      return reply({ content: [text((err as Error).message)], isError: true })
    }
  }
  if (msg.id === undefined) return undefined // a notification, such as notifications/initialized
  return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Unknown method ${msg.method}` } }
}

export async function mcp(a: Args): Promise<void> {
  // The box to use when a tool call names none: -b, else this repo + branch's box.
  const pinned = str(a.flags.box)
  const fallback = async () => pinned ?? (await target(a, false)).sandboxId
  const write = (m: Json) => process.stdout.write(`${JSON.stringify(m)}\n`)
  let buffer = ''
  for await (const chunk of Bun.stdin.stream()) {
    buffer += new TextDecoder().decode(chunk)
    let nl: number
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      let msg: Json
      try {
        msg = JSON.parse(line)
      } catch {
        write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
        continue
      }
      // Requests run concurrently; each answers with its own id.
      void handle(msg, fallback).then((res) => res && write(res))
    }
  }
}
