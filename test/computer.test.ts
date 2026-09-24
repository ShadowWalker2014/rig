import { expect, test } from 'bun:test'
import { toKeysym } from '../src/computer'
import { TOOLS } from '../src/mcp'

test('friendly key names become X keysyms', () => {
  expect(toKeysym('Enter')).toBe('Return')
  expect(toKeysym('ctrl+l')).toBe('ctrl+l')
  expect(toKeysym('cmd+shift+t')).toBe('super+shift+t')
  expect(toKeysym('esc')).toBe('Escape')
  expect(toKeysym('PageDown')).toBe('Next')
  expect(toKeysym('f5')).toBe('F5')
})

test('the MCP tools mirror computer use, the browser and a shell', () => {
  expect(TOOLS.map((t) => t.name)).toEqual(['computer', 'browser', 'shell', 'boxes'])
  const actions = (TOOLS[0]!.inputSchema.properties as any).action.enum
  for (const a of ['screenshot', 'left_click', 'type', 'key', 'scroll', 'left_click_drag', 'zoom']) expect(actions).toContain(a)
})

test('rig mcp answers the MCP handshake and lists its tools over stdio', async () => {
  const bin = new URL('../bin/rig', import.meta.url).pathname
  const p = Bun.spawn([bin, 'mcp', '-b', 'none'], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
  const send = (m: object) => p.stdin.write(`${JSON.stringify(m)}\n`)
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } })
  send({ jsonrpc: '2.0', method: 'notifications/initialized' })
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
  send({ jsonrpc: '2.0', id: 3, method: 'nope' })
  const reader = p.stdout.getReader()
  let out = ''
  while (out.split('\n').filter(Boolean).length < 3) out += new TextDecoder().decode((await reader.read()).value)
  p.kill()
  const [init, list, unknown] = out.trim().split('\n').map((l) => JSON.parse(l))
  expect(init.result.serverInfo.name).toBe('rig')
  expect(init.result.capabilities.tools).toBeDefined()
  expect(list.result.tools).toHaveLength(4)
  expect(unknown.error.code).toBe(-32601)
})
