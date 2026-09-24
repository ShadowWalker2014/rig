import { existsSync, lstatSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { CommandExitError, type Sandbox, type SandboxInfo } from 'e2b'
import { str, type Args } from './args'
import { createBox, killBox, listBoxes, openBox, resolveBox, savedExists, snapshotBox, type Tags } from './box'
import { defaultName, isValidName, setDefaultName } from './saved'
import { DEV_LOG, HOME, idleMs, NOVNC_PORT } from './config'
import { forward } from './proxy'
import { projectConfig } from './project'
import { currentRepo, type Repo } from './repo'
import { devRunning, ensureDesktop, ensureSwap, startDev, startViewer, stopDev, stopViewer } from './services'
import { clean, sanitizer } from './sanitize'
import { q, sh } from './shell'
import { RepoAccessError, syncRepo } from './sync'
import { openDesktop, serveDesktop, stopDesktop } from './viewer'
import { describe, settleConfig } from './init'
import { hasConfigFile, writeConfig } from './project'

// The box named by `-b`/positional, or else the one for this repo and branch.
export async function target(a: Args, positionalIsBox = true): Promise<SandboxInfo> {
  const ref = boxRef(a, positionalIsBox)
  if (ref) return resolveBox(ref)
  const repo = currentRepo()
  const [box] = await listBoxes({ tags: { repo: repo.slug, branch: repo.branch } })
  if (!box) throw new Error(`No box for ${repo.slug} on ${repo.branch}. Run \`rig up\` first.`)
  return box
}

// The box a command names, by -b or as its first word; naming two different ones is an error.
export function boxRef(a: Args, positionalIsBox = true): string | undefined {
  const flag = str(a.flags.box)
  const word = positionalIsBox ? a.sub[0] : undefined
  if (flag && word && flag !== word) throw new Error(`Two boxes named: ${word} and -b ${flag}. Name one.`)
  return flag || word
}

const shortId = () => crypto.randomUUID().slice(0, 4)
const slug = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()

function repoTags(repo: Repo, a: Args): Tags {
  const base = str(a.flags.name) ?? `${repo.name}-${slug(repo.branch)}`
  return { name: a.flags.new ? `${base}-${shortId()}` : base, repo: repo.slug, branch: repo.branch, dir: repo.boxDir }
}

// Why a box can't take this repo and branch's code, or undefined if it can.
export function repoBoxProblem(box: Pick<SandboxInfo, 'sandboxId' | 'metadata'>, repo: Pick<Repo, 'slug' | 'branch'>): string | undefined {
  const { repo: boxRepo, branch } = box.metadata
  if (boxRepo !== repo.slug) return `Box ${box.sandboxId} is not a ${repo.slug} box${boxRepo ? ` (it holds ${boxRepo})` : ''}. Run \`rig up\` without -b to get one.`
  if (branch !== repo.branch) return `Box ${box.sandboxId} is for branch ${branch}, and you are on ${repo.branch}. Run \`rig up\` without -b to get this branch's box.`
}

// -b names the box to use; otherwise this repo and branch's box, unless --new.
async function boxForUp(a: Args, repo: Repo): Promise<SandboxInfo | undefined> {
  const ref = boxRef(a)
  if (ref && a.flags.new) throw new Error('Use either -b <box> or --new, not both.')
  const box = ref ? await resolveBox(ref) : a.flags.new ? undefined : (await listBoxes({ tags: { repo: repo.slug, branch: repo.branch } }))[0]
  if (!box) return undefined
  const problem = repoBoxProblem(box, repo)
  if (problem) throw new Error(problem)
  const setup = ['from', 'name'].filter((f) => a.flags[f] !== undefined)
  if (setup.length) throw new Error(`--${setup.join(' and --')} only apply to a new box, and ${box.sandboxId} already exists. Add --new for a separate box.`)
  return box
}

export async function up(a: Args): Promise<void> {
  const repo = currentRepo()
  const existing = await boxForUp(a, repo) // before setup, so a wrong box is refused before any questions
  const cfg = await settingsFor(repo, a)
  const missing = cfg.copy.filter((f) => !existsSync(join(repo.root, f)))
  if (missing.length) throw new Error(`rig.json copies ${missing.join(', ')}, but ${missing.length === 1 ? 'it is' : 'they are'} not in this repo on this machine. Add ${missing.length === 1 ? 'it' : 'them'}, or run \`rig init\`.`)
  const sbx = existing ? await openBox(existing.sandboxId) : await createBox(repoTags(repo, a), str(a.flags.from))
  console.error(`${existing ? 'Reusing' : 'Created'} box ${sbx.sandboxId}`)
  await sbx.setTimeout(idleMs() + 1_800_000)
  await ensureSwap(sbx)
  const { installed } = await syncRepo(sbx, repo).catch(async (err) => {
    // A box that could not reach the repo is useless; do not leave it to be reused.
    if (err instanceof RepoAccessError && !existing) await killBox(sbx.sandboxId)
    throw err
  })
  if (!a.flags['no-dev'] && (installed || !(await devRunning(sbx)))) await startDev(sbx, repo, cfg)
  await sbx.setTimeout(idleMs())
  console.log(sbx.sandboxId)
  console.error(nextSteps(cfg.port))
}

// The first `rig up` in a repo settles its settings: with a person at the terminal
// it runs `rig init`; for an agent it uses what it detects and says what it skipped.
async function settingsFor(repo: Repo, a: Args) {
  if (hasConfigFile(repo.root)) return projectConfig(repo.root)
  if (process.stdin.isTTY && !a.flags.yes) {
    console.error('First time in this repo: rig init will work out how it runs.')
    const cfg = await settleConfig(repo.root, a, true)
    writeConfig(repo.root, cfg)
    describe(repo.slug, cfg)
    console.error('Saved rig.json.\n')
    return cfg
  }
  return settleConfig(repo.root, a, false)
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
  // A box only ever holds one repo and branch's code, so a clean `rig new` box stays promotable
  // and a parallel agent's box is never overwritten with another branch.
  const problem = repoBoxProblem(box, repo)
  if (problem) throw new Error(problem)
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
// E2B does not count traffic as activity, so the timer is renewed every minute.
function holdOpen(sbx: Sandbox, stop: () => void): Promise<never> {
  const beat = setInterval(() => sbx.setTimeout(idleMs()).catch((e) => console.error('Keep-alive failed:', e.message)), 60_000)
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

// `rig desktop`: print a private link to the box's screen. A background helper
// serves it and keeps the box awake while the tab is open, so the link survives
// the terminal or agent session that asked for it.
export async function desktop(a: Args): Promise<void> {
  if (a.flags.serve) return serveDesktop(a.sub[0]!, Number(str(a.flags.local)))
  const box = await target(a)
  const label = box.metadata.name ?? box.sandboxId
  if (a.flags.stop) return void console.error(stopDesktop(box.sandboxId) ? `Closed the desktop view of ${label}.` : `No desktop view of ${label} was open.`)
  const url = await openDesktop(box.sandboxId, Number(str(a.flags.local) ?? 0))
  console.log(url)
  console.error('Open that link to see and control the box. It stays awake while the tab is open,')
  console.error(`and sleeps 15 minutes after you close it. Close the link now with: rig desktop ${label} --stop`)
  // A clean box someone is setting up is exactly what should be saved afterwards.
  if (!box.metadata.repo) console.error(`When you are done setting it up, save it so every new box starts this way: rig save ${label}`)
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

// `rig save <box> [--as name] [--use]`: keep this box as a saved desktop that new
// boxes start from. Without --as it updates your default desktop.
export async function save(a: Args): Promise<void> {
  const name = str(a.flags.as) ?? defaultName()
  if (!isValidName(name)) throw new Error(`"${name}" cannot be a desktop name. Use lowercase letters, digits and dashes.`)
  const box = await target(a)
  // A box that ran a repo's install and dev scripts may carry changes that code
  // planted; saving it would copy them into every box started from it.
  if (box.metadata.repo && !a.flags.force) {
    throw new Error(`This box ran code from ${box.metadata.repo}. Save a box made with \`rig new\`, or add --force if you trust that repo.`)
  }
  const sbx = await openBox(box.sandboxId, 900_000)
  await stopDev(sbx)
  stopDesktop(box.sandboxId)
  await stopViewer(sbx)
  const hadDefault = await savedExists()
  await snapshotBox(box.sandboxId, name)
  const makeDefault = Boolean(a.flags.use) || name === defaultName() || !hadDefault
  if (makeDefault && name !== defaultName()) setDefaultName(name)
  console.error(`Saved "${name}"${makeDefault ? ', your default desktop: every new box starts from it' : `. Start a box from it with \`rig new --from ${name}\`, or make it the default with \`rig saved use ${name}\``}.`)
  console.error(`The desktop view of this box was closed; reopen it with: rig desktop ${box.metadata.name ?? box.sandboxId}`)
}

// `rig snap <box>`: a one-off snapshot, printed by id. `--default` is the old spelling of `rig save`.
export async function snap(a: Args): Promise<void> {
  if (a.flags.default) return save(a)
  const box = await target(a)
  console.log(await snapshotBox(box.sandboxId))
}

export async function newBox(a: Args): Promise<void> {
  const sbx = await createBox({ name: str(a.flags.name) ?? `rig-${shortId()}` }, str(a.flags.from))
  await ensureDesktop(sbx)
  await ensureSwap(sbx)
  console.log(sbx.sandboxId)
  console.error(`Box ready. Sign in to things with: rig desktop ${sbx.sandboxId}\nThen save it, so every new box starts signed in: rig save ${sbx.sandboxId}`)
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
