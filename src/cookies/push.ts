import { CommandExitError, type Sandbox } from 'e2b'
import { CDP_PORT } from '../config'
import { ensureDesktop } from '../services'
import { q } from '../shell'
import type { Cookie } from './read'

// Runs inside the box. Reads cookies from stdin and hands them to the desktop's
// Chrome over its local debugging port. It prints only counts and error names —
// never a message, which could quote a value — and nothing touches the box's
// disk except Chrome's own profile.
const INJECT = `
const chunks = []; process.stdin.on('data', (c) => chunks.push(c))
process.stdin.on('end', () => main().catch((e) => { console.error('cookie import failed: ' + (e && e.name)); process.exit(1) }))
async function main() {
  const cookies = JSON.parse(Buffer.concat(chunks).toString('utf8')); chunks.length = 0
  const { webSocketDebuggerUrl } = await (await fetch('http://127.0.0.1:${CDP_PORT}/json/version')).json()
  const ws = new WebSocket(webSocketDebuggerUrl); await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail })
  let id = 0; const waiting = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); const w = waiting.get(m.id); if (w) { waiting.delete(m.id); m.error ? w.fail(m.error) : w.ok(m.result) } }
  const call = (method, params) => new Promise((ok, fail) => { waiting.set(++id, { ok, fail }); ws.send(JSON.stringify({ id, method, params })) })
  let imported = 0, failed = 0
  for (let i = 0; i < cookies.length; i += 200) {
    const batch = cookies.slice(i, i + 200)
    try { await call('Storage.setCookies', { cookies: batch }); imported += batch.length }
    catch { for (const c of batch) { try { await call('Storage.setCookies', { cookies: [c] }); imported++ } catch { failed++ } } }
  }
  ws.close(); console.log(JSON.stringify({ imported, failed }))
}`

// Chrome's cookie format. A host without a leading dot is host-only, which CDP
// expresses with a url instead of a domain.
export function toCdp(c: Cookie) {
  const host = c.host.replace(/^\./, '')
  const where = c.host.startsWith('.') ? { domain: c.host } : { url: `${c.secure ? 'https' : 'http'}://${host}${c.path}` }
  const sameSite = c.sameSite === 'None' && !c.secure ? undefined : c.sameSite
  return { name: c.name, value: c.value, path: c.path, secure: c.secure, httpOnly: c.httpOnly, sameSite, expires: c.expires, ...where }
}

export async function pushCookies(sbx: Sandbox, cookies: Cookie[]): Promise<{ imported: number; failed: number }> {
  await ensureDesktop(sbx)
  const handle = await sbx.commands.run(`node -e ${q(INJECT)}`, { background: true, stdin: true, timeoutMs: 300_000 })
  const payload = new TextEncoder().encode(JSON.stringify(cookies.map(toCdp)))
  for (let i = 0; i < payload.length; i += 64 * 1024) await handle.sendStdin(payload.subarray(i, i + 64 * 1024))
  await handle.closeStdin()
  try {
    const res = await handle.wait()
    return JSON.parse(res.stdout.trim().split('\n').pop()!)
  } catch (err) {
    // The box script never prints values, so its error text is safe to show.
    if (err instanceof CommandExitError) throw new Error(`Chrome in the box refused the cookies: ${err.stderr.slice(0, 300)}`)
    throw err
  }
}
