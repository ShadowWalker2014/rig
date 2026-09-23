import { afterAll, expect, test } from 'bun:test'
import { forward } from '../src/proxy'

// Stand-in for a private box port: it only answers requests carrying the token.
const box = Bun.serve<undefined>({
  port: 0,
  fetch(req, server) {
    if (req.headers.get('e2b-traffic-access-token') !== 'secret') return new Response('no token', { status: 401 })
    if (server.upgrade(req, { data: undefined })) return undefined
    return new Response(`${req.method} ${new URL(req.url).pathname} enc=${req.headers.get('accept-encoding') ?? 'none'}`)
  },
  websocket: { message: (ws, msg) => void ws.send(`echo:${msg}`) },
})
const local = forward(`http://127.0.0.1:${box.port}`, 'secret', 0)
afterAll(() => {
  local.stop(true)
  box.stop(true)
})

test('adds the traffic token and keeps the path', async () => {
  const res = await fetch(`http://127.0.0.1:${local.port}/vnc.html?x=1`)
  expect(res.status).toBe(200)
  expect(await res.text()).toBe('GET /vnc.html enc=identity')
})

test('forwards request bodies', async () => {
  const res = await fetch(`http://127.0.0.1:${local.port}/api`, { method: 'POST', body: 'hi' })
  expect(await res.text()).toStartWith('POST /api')
})

test('relays WebSocket messages both ways, including ones sent before upstream opens', async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${local.port}/websockify`)
  const got: string[] = []
  const done = new Promise<void>((resolve) => {
    ws.onmessage = (e) => {
      got.push(String(e.data))
      if (got.length === 2) resolve()
    }
  })
  ws.onopen = () => {
    ws.send('a')
    ws.send('b')
  }
  await done
  expect(got).toEqual(['echo:a', 'echo:b'])
  ws.close()
})

test('listens on loopback only', () => {
  expect(local.hostname).toBe('127.0.0.1')
})

test('refuses a rebound hostname and a cross-site WebSocket', async () => {
  const rebound = await fetch(`http://127.0.0.1:${local.port}/`, { headers: { host: 'evil.example:80' } })
  expect(rebound.status).toBe(403)
  const { fromThisMachine } = await import('../src/proxy')
  const ws = (origin: string) =>
    new Request(`http://127.0.0.1:${local.port}/websockify`, {
      headers: { host: `127.0.0.1:${local.port}`, upgrade: 'websocket', origin },
    })
  expect(fromThisMachine(ws('https://evil.example'), local.port)).toBe(false)
  expect(fromThisMachine(ws(`http://127.0.0.1:${local.port}`), local.port)).toBe(true)
  expect(fromThisMachine(ws('http://localhost:5173'), local.port)).toBe(true)
})

test('refuses a request another website starts, even a plain POST', async () => {
  const res = await fetch(`http://127.0.0.1:${local.port}/api`, {
    method: 'POST',
    body: 'x',
    headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
  })
  expect(res.status).toBe(403)
})

test('rig port lets an OAuth redirect back in; the desktop does not', async () => {
  const { fromThisMachine } = await import('../src/proxy')
  const callback = new Request(`http://localhost:3000/auth/callback?code=x`, {
    headers: { host: 'localhost:3000', 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' },
  })
  expect(fromThisMachine(callback, 3000, true)).toBe(true)
  expect(fromThisMachine(callback, 3000, false)).toBe(false)
  const post = new Request('http://localhost:3000/api', {
    method: 'POST',
    headers: { host: 'localhost:3000', 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' },
  })
  expect(fromThisMachine(post, 3000, true)).toBe(false)
})
