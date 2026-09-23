import type { Server, ServerWebSocket } from 'bun'

const TOKEN_HEADER = 'e2b-traffic-access-token'

type Pipe = { path: string; protocols: string[]; up?: WebSocket; queue: (string | Buffer)[] }

// A private box port, served on 127.0.0.1 of this machine. The proxy adds the
// box's traffic token, so the port never needs to be public and nothing off
// this machine can reach it.
// `navigations` lets other sites send you here with a plain link or redirect, which
// OAuth callbacks need. The desktop viewer never needs it, so it stays off there.
export function forward(origin: string, token: string, localPort: number, navigations = false): Server<Pipe> {
  return Bun.serve<Pipe>({
    hostname: '127.0.0.1',
    port: localPort,
    fetch(req, server) {
      if (!fromThisMachine(req, server.port, navigations)) return new Response('Forbidden', { status: 403 })
      const url = new URL(req.url)
      const path = url.pathname + url.search
      if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
        const protocols = (req.headers.get('sec-websocket-protocol') ?? '').split(',').map((p) => p.trim()).filter(Boolean)
        if (server.upgrade(req, { data: { path, protocols, queue: [] } })) return undefined
        return new Response('WebSocket upgrade failed', { status: 400 })
      }
      return relay(req, `${origin}${path}`, token)
    },
    websocket: {
      open: (ws) => openUpstream(ws, origin.replace(/^http/, 'ws'), token),
      message: (ws, msg) => {
        if (ws.data.up?.readyState === WebSocket.OPEN) ws.data.up.send(msg)
        else ws.data.queue.push(msg)
      },
      close: (ws) => ws.data.up?.close(),
    },
  })
}

// Blocks DNS rebinding (a website pointing its own hostname at 127.0.0.1 still sends
// that hostname as Host) and requests or WebSockets started by another website.
export function fromThisMachine(req: Request, port: number | undefined, navigations = false): boolean {
  const host = req.headers.get('host') ?? ''
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return false
  const isNavigation = req.method === 'GET' && req.headers.get('sec-fetch-mode') === 'navigate'
  if (navigations && isNavigation) return true
  if (req.headers.get('sec-fetch-site') === 'cross-site') return false
  const origin = req.headers.get('origin')
  return !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
}

const HOP_BY_HOP = ['host', 'connection', 'keep-alive', 'proxy-authorization', 'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade']

async function relay(req: Request, target: string, token: string): Promise<Response> {
  const headers = new Headers(req.headers)
  for (const h of HOP_BY_HOP) headers.delete(h)
  headers.set('accept-encoding', 'identity')
  headers.set(TOKEN_HEADER, token)
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  const res = await fetch(target, { method: req.method, headers, body: hasBody ? req.body : undefined, redirect: 'manual' })
  // fetch hands back a decoded body, so its encoding headers no longer describe it.
  const out = new Headers(res.headers)
  out.delete('content-encoding')
  out.delete('content-length')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out })
}

function openUpstream(ws: ServerWebSocket<Pipe>, wsOrigin: string, token: string): void {
  const up = new WebSocket(`${wsOrigin}${ws.data.path}`, {
    headers: { [TOKEN_HEADER]: token },
    protocols: ws.data.protocols,
  } as unknown as string[])
  up.binaryType = 'arraybuffer'
  up.onopen = () => ws.data.queue.splice(0).forEach((m) => up.send(m))
  up.onmessage = (e) => ws.send(typeof e.data === 'string' ? e.data : new Uint8Array(e.data as ArrayBuffer))
  up.onclose = () => ws.close()
  up.onerror = (e) => {
    console.error('Box WebSocket error:', (e as ErrorEvent).message ?? e.type)
    ws.close()
  }
  ws.data.up = up
}
