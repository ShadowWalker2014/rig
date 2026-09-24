import { spawn } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { NotFoundError, type Sandbox } from 'e2b'
import { openBox } from './box'
import { idleMs, NOVNC_PORT } from './config'
import { forward, type Activity } from './proxy'
import { startViewer } from './services'

// `rig desktop` runs its tunnel in a small background helper, so the desktop
// keeps working — and the box keeps awake — after the terminal or agent session
// that opened it has gone. E2B does not count traffic as activity, so the
// helper renews the box's timer while a desktop tab is open.
const RUN_DIR = join(homedir(), '.config', 'rig', 'run')
const BEAT_MS = 60_000
const GIVE_UP_MS = 30 * 60_000

type State = { pid: number; port: number; url: string }

const stateFile = (id: string) => join(RUN_DIR, `desktop-${id}.json`)

function readState(id: string): State | undefined {
  try {
    return JSON.parse(readFileSync(stateFile(id), 'utf8'))
  } catch {
    return undefined
  }
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function answers(port: number): Promise<boolean> {
  try {
    return (await fetch(`http://127.0.0.1:${port}/vnc.html`, { signal: AbortSignal.timeout(3000) })).ok
  } catch {
    return false
  }
}

function freePort(): number {
  const probe = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response() })
  const port = probe.port!
  probe.stop(true)
  return port
}

// Reuses a running helper for this box, or starts the viewer and a new helper.
export async function openDesktop(id: string, wantedPort?: number): Promise<string> {
  const running = readState(id)
  if (running && alive(running.pid) && (await answers(running.port))) return running.url
  stopDesktop(id)
  const password = await startViewer(await openBox(id))
  const port = wantedPort || freePort()
  const pid = startHelper(id, port)
  for (let i = 0; i < 60 && !(await answers(port)); i++) await Bun.sleep(250)
  if (!(await answers(port))) throw new Error(`The desktop helper did not start. See ${join(RUN_DIR, `desktop-${id}.log`)}`)
  // The password rides in the #fragment, which browsers never send to a server.
  const url = `http://127.0.0.1:${port}/vnc.html?autoconnect=true&resize=scale#&password=${password}`
  mkdirSync(RUN_DIR, { recursive: true })
  chmodSync(RUN_DIR, 0o700)
  writeFileSync(stateFile(id), JSON.stringify({ pid, port, url }), { mode: 0o600 })
  return url
}

function startHelper(id: string, port: number): number {
  mkdirSync(RUN_DIR, { recursive: true })
  chmodSync(RUN_DIR, 0o700)
  const log = openSync(join(RUN_DIR, `desktop-${id}.log`), 'a', 0o600)
  const bin = resolve(import.meta.dir, '..', 'bin', 'rig')
  const child = spawn(bin, ['desktop', id, '--serve', '--local', String(port)], { detached: true, stdio: ['ignore', log, log] })
  child.unref()
  return child.pid!
}

export function stopDesktop(id: string): boolean {
  const running = readState(id)
  if (running && alive(running.pid)) process.kill(running.pid, 'SIGTERM')
  const had = existsSync(stateFile(id))
  rmSync(stateFile(id), { force: true })
  return had
}

// The helper itself: tunnel the viewer, renew the box's timer while someone is
// watching, and exit once nobody has for a while or the box is gone.
export async function serveDesktop(id: string, port: number): Promise<never> {
  const sbx = await openBox(id)
  const activity: Activity = { viewers: 0, lastSeen: Date.now() }
  const token = sbx.trafficAccessToken
  if (!token) throw new Error('This box has no traffic token.')
  const server = forward(`https://${sbx.getHost(NOVNC_PORT)}`, token, port, false, activity)
  const quit = () => {
    server.stop(true)
    if (readState(id)?.pid === process.pid) rmSync(stateFile(id), { force: true })
    process.exit(0)
  }
  process.on('SIGTERM', quit)
  process.on('SIGINT', quit)
  setInterval(() => void beat(sbx, activity, quit), BEAT_MS)
  return new Promise<never>(() => {})
}

async function beat(sbx: Sandbox, activity: Activity, quit: () => void): Promise<void> {
  const quietFor = Date.now() - activity.lastSeen
  if (activity.viewers === 0 && quietFor > GIVE_UP_MS) return quit()
  if (activity.viewers === 0 && quietFor > BEAT_MS) return
  try {
    await sbx.setTimeout(idleMs())
  } catch (err) {
    if (err instanceof NotFoundError) return quit()
    console.error(`${new Date().toISOString()} keep-awake failed: ${(err as Error).message}`)
  }
}
