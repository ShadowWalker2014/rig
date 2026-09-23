import { existsSync, lstatSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { CommandExitError, type Sandbox, type SandboxInfo } from 'e2b'
import { str, type Args } from './args'
import { createBox, listBoxes, openBox, resolveBox, snapshotBox, type Tags } from './box'
import { DEV_LOG, HOME, idleMs, NOVNC_PORT } from './config'
import { forward } from './proxy'
import { currentRepo, projectConfig, type Repo } from './repo'
import { devRunning, ensureDesktop, startDev, startViewer, stopDev, stopViewer } from './services'
import { clean, sanitizer } from './sanitize'
import { q, sh } from './shell'
import { syncRepo } from './sync'

// The box named by `-b`/positional, or else the one for this repo and branch.
export async function target(a: Args, positionalIsBox = true): Promise<SandboxInfo> {
  const ref = str(a.flags.box) ?? (positionalIsBox ? a.sub[0] : undefined)
  if (ref) return resolveBox(ref)
  const repo = currentRepo()
  const [box] = await listBoxes({ tags: { repo: repo.slug, branch: repo.branch } })
  if (!box) throw new Error(`No box for ${repo.slug} on ${repo.branch}. Run \`rig up\` first.`)
  return box
}

const shortId = () => crypto.randomUUID().slice(0, 4)
const slug = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()

function repoTags(repo: Repo, a: Args): Tags {
  const base = str(a.flags.name) ?? `${repo.name}-${slug(repo.branch)}`
  return { name: a.flags.new ? `${base}-${shortId()}` : base, repo: repo.slug, branch: repo.branch, dir: repo.boxDir }
}

export async function up(a: Args): Promise<void> {
  const repo = currentRepo()
  const cfg = projectConfig(repo.root)
  const existing = a.flags.new ? undefined : (await listBoxes({ tags: { repo: repo.slug, branch: repo.branch } }))[0]
  const sbx = existing ? await openBox(existing.sandboxId) : await createBox(repoTags(repo, a))
  console.error(`${existing ? 'Reusing' : 'Created'} box ${sbx.sandboxId}`)
  await sbx.setTimeout(idleMs() + 1_800_000)
  const { installed } = await syncRepo(sbx, repo)
  if (!a.flags['no-dev'] && (installed || !(await devRunning(sbx)))) await startDev(sbx, repo, cfg)
  await sbx.setTimeout(idleMs())
  console.log(sbx.sandboxId)
  console.error(nextSteps(cfg.port))
}

function nextSteps(port: number): string {
  return [
    'Box is ready.',
    `  See the dev server on this Mac:  rig port ${port}   (then open http://localhost:${port})`,
    `  Drive the box's Chrome:          rig browser -- open http://localhost:${port}`,
    '  Take over the desktop:           rig desktop',
  ].join('\n')
}

export async function sync(a: Args): Promise<void> {
  const repo = currentRepo()
  const box = await target(a)
  // A box only ever holds one repo's code, so a clean `rig new` box stays promotable.
  if (box.metadata.repo !== repo.slug) {
    throw new Error(`Box ${box.sandboxId} is not a ${repo.slug} box. Use \`rig up\` to get one.`)
  }
  const sbx = await openBox(box.sandboxId, 1_800_000)
  const { installed } = await syncRepo(sbx, repo)
  if (installed) await startDev(sbx, repo, projectConfig(repo.root))
  console.error(`Synced ${repo.branch} @ ${repo.head.slice(0, 8)} to ${box.sandboxId}`)
}

const shellLine = (words: string[]) => (words.length === 1 ? words[0]! : words.map(q).join(' '))

export async function exec(a: Args): Promise<number> {
  if (a.rest.length === 0) throw new Error('Usage: rig exec [box] -- <command>')
  const box = await target(a)
  const timeoutMs = Number(str(a.flags.timeout) ?? 600) * 1000
  const sbx = await openBox(box.sandboxId, timeoutMs)
  return stream(sbx, shellLine(a.rest), str(a.flags.cwd) ?? box.metadata.dir ?? HOME, timeoutMs)
}

export async function browser(a: Args): Promise<number> {
  if (a.rest.length === 0) throw new Error('Usage: rig browser [box] -- <agent-browser args>   e.g. rig browser -- snapshot -i')
  const box = await target(a)
  const sbx = await openBox(box.sandboxId, 300_000)
  return stream(sbx, `rig-ab ${a.rest.map(q).join(' ')}`, HOME, 300_000)
}

async function stream(sbx: Sandbox, cmd: string, cwd: string, timeoutMs: number): Promise<number> {
  const [out, err] = [sanitizer(), sanitizer()]
  try {
    await sbx.commands.run(cmd, {
      cwd,
      timeoutMs,
      onStdout: (d) => void process.stdout.write(out(d)),
      onStderr: (d) => void process.stderr.write(err(d)),
    })
    return 0
  } catch (err) {
    if (err instanceof CommandExitError) return err.exitCode
    throw err
  }
}

export async function shot(a: Args): Promise<void> {
  const box = await target(a, false)
  const sbx = await openBox(box.sandboxId, 120_000)
  const url = str(a.flags.url)
  if (url) await sh(sbx, `rig-ab open ${q(url)}`, { timeoutMs: 90_000 })
  await sh(sbx, 'rig-ab screenshot /tmp/rig-shot.png', { timeoutMs: 60_000 })
  const out = resolve(a.sub[0] ?? join(tmpdir(), `rig-shot-${Date.now()}.png`))
  writeFileSync(out, await sbx.files.read('/tmp/rig-shot.png', { format: 'bytes' }))
  console.log(out)
}

export async function pull(a: Args): Promise<void> {
  const remote = a.sub[0]
  if (!remote) throw new Error('Usage: rig pull <path in box> [local path] [-b box]')
  const box = await target(a, false)
  const sbx = await openBox(box.sandboxId)
  const out = resolve(a.sub[1] ?? remote.split('/').pop()!)
  writeFileSync(out, await sbx.files.read(remote, { format: 'bytes' }))
  console.log(out)
}

export async function logs(a: Args): Promise<void> {
  const box = await target(a)
  const sbx = await openBox(box.sandboxId)
  console.log(clean(await sh(sbx, `tail -n ${Number(str(a.flags.lines) ?? 80)} ${DEV_LOG} 2>/dev/null || echo "No dev server log yet."`)))
}

// Long-running: keeps the box awake while the tunnel is open; Ctrl-C closes it.
function holdOpen(sbx: Sandbox, stop: () => void): Promise<never> {
  const beat = setInterval(() => sbx.setTimeout(idleMs()).catch((e) => console.error('Keep-alive failed:', e.message)), 300_000)
  const close = () => {
    clearInterval(beat)
    stop()
    process.exit(0)
  }
  return new Promise<never>(() => {
    process.on('SIGINT', close)
    process.on('SIGTERM', close)
  })
}

function trafficToken(sbx: Sandbox): string {
  if (!sbx.trafficAccessToken) throw new Error('This box has no traffic token, so its ports are public. Recreate it with `rig up --new`.')
  return sbx.trafficAccessToken
}

export async function desktop(a: Args): Promise<void> {
  const box = await target(a)
  const sbx = await openBox(box.sandboxId)
  const password = await startViewer(sbx)
  const server = forward(`https://${sbx.getHost(NOVNC_PORT)}`, trafficToken(sbx), Number(str(a.flags.local) ?? 0))
  // The password rides in the #fragment, which browsers never send to a server.
  console.log(`http://127.0.0.1:${server.port}/vnc.html?autoconnect=true&resize=scale#&password=${password}`)
  console.error('Open that link to see and control the box. Press Ctrl-C to close it.')
  await holdOpen(sbx, () => server.stop(true))
}

export async function port(a: Args): Promise<void> {
  const remote = Number(a.sub[0])
  if (!remote) throw new Error('Usage: rig port <port in box> [--local <port on this Mac>] [-b box]')
  const box = await target(a, false)
  const sbx = await openBox(box.sandboxId)
  const local = Number(str(a.flags.local) ?? remote)
  const server = forward(`https://${sbx.getHost(remote)}`, trafficToken(sbx), local, true)
  console.log(`http://localhost:${server.port}`)
  console.error(`Box port ${remote} is on this Mac at localhost:${server.port}. Press Ctrl-C to close it.`)
  await holdOpen(sbx, () => server.stop(true))
}

// `rig save <box>`: make this box the default desktop every new box starts from.
export const save = (a: Args) => snap({ ...a, flags: { ...a.flags, default: true } })

export async function snap(a: Args): Promise<void> {
  const box = await target(a)
  const sbx = await openBox(box.sandboxId, 900_000)
  if (a.flags.default) {
    // A box that ran a repo's install and dev scripts may carry changes that code
    // planted; saving it would copy them into every future box.
    if (box.metadata.repo && !a.flags.force) {
      throw new Error(`This box ran code from ${box.metadata.repo}. Save a box made with \`rig new\`, or add --force if you trust that repo.`)
    }
    await stopDev(sbx)
    await stopViewer(sbx)
    console.error('Saving this box as your default desktop. Every new box will start with its logins and files.')
    console.error(`Any open desktop view of this box is now closed; reopen it with: rig desktop ${box.metadata.name ?? box.sandboxId}`)
  }
  console.log(await snapshotBox(box.sandboxId, Boolean(a.flags.default)))
}

export async function newBox(a: Args): Promise<void> {
  const sbx = await createBox({ name: str(a.flags.name) ?? `rig-${shortId()}` })
  await ensureDesktop(sbx)
  console.log(sbx.sandboxId)
  console.error(`Empty box ready. Sign in to things with: rig desktop ${sbx.sandboxId}\nThen make it your default desktop, so every new box starts signed in: rig save ${sbx.sandboxId}`)
}

export function installSkill(): void {
  const src = resolve(import.meta.dir, '..', 'skills', 'rig')
  const dir = join(homedir(), '.claude', 'skills')
  const dest = join(dir, 'rig')
  mkdirSync(dir, { recursive: true })
  if (existsSync(dest) || isLink(dest)) return void console.error(`${dest} already exists.`)
  symlinkSync(src, dest)
  console.error(`Linked the rig skill into ${dest}. Claude Code agents will now use rig for dev servers and browsers.`)
}

function isLink(p: string): boolean {
  try {
    return lstatSync(p).isSymbolicLink()
  } catch {
    return false
  }
}
