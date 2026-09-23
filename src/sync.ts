import { lstatSync, readFileSync, realpathSync, unlinkSync } from 'node:fs'
import { basename, dirname, join, sep } from 'node:path'
import { tmpdir } from 'node:os'
import type { Sandbox } from 'e2b'
import { git, gitBytes, lockfile, projectConfig, type Repo } from './repo'
import { clean } from './sanitize'
import { q, sh, test } from './shell'

const MAX_UNTRACKED_BYTES = 25 * 1024 * 1024

// Makes the box's checkout match the local working tree exactly: same commit,
// same uncommitted edits, same untracked files — with no push to GitHub needed.
export async function syncRepo(sbx: Sandbox, repo: Repo): Promise<{ installed: boolean }> {
  await ensureClone(sbx, repo)
  await shipHead(sbx, repo)
  await sh(sbx, `git checkout -f -B ${q(repo.branch)} ${repo.head} && git clean -fdq`, { cwd: repo.boxDir })
  const cfg = projectConfig(repo.root)
  if (cfg.submodules) await sh(sbx, 'git submodule update --init --recursive', { cwd: repo.boxDir, timeoutMs: 600_000 })
  await applyUncommitted(sbx, repo)
  await uploadFiles(sbx, repo, untrackedFiles(repo.root).concat(cfg.copy))
  return { installed: await installIfLockChanged(sbx, repo) }
}

async function ensureClone(sbx: Sandbox, repo: Repo): Promise<void> {
  if (await test(sbx, `test -d ${q(repo.boxDir)}/.git`)) return
  console.error(`Cloning ${repo.slug} into the box…`)
  await sh(sbx, `mkdir -p "$(dirname ${q(repo.boxDir)})" && git clone --quiet ${q(repo.origin)} ${q(repo.boxDir)}`, { timeoutMs: 900_000 }).catch(
    (err) => {
      throw new Error(`${err.message}\n\nThe box could not clone ${repo.slug}. Sign in to GitHub inside it: \`rig desktop\`, run \`gh auth login\`, then \`rig save <box>\`.`)
    },
  )
}

// Commits the box can't fetch (unpushed ones) travel as a git bundle.
async function shipHead(sbx: Sandbox, repo: Repo): Promise<void> {
  const has = () => test(sbx, `git cat-file -e ${repo.head}^{commit}`, repo.boxDir)
  if (await has()) return
  await sh(sbx, 'git fetch --quiet origin', { cwd: repo.boxDir, timeoutMs: 600_000 }).catch((err) => {
    console.error(`git fetch in the box failed, shipping commits directly instead: ${err.message}`)
  })
  if (await has()) return
  const bundle = join(tmpdir(), `rig-${process.pid}.bundle`)
  git(repo.root, ['bundle', 'create', bundle, 'HEAD', '--not', '--remotes=origin'])
  await sbx.files.write('/tmp/rig.bundle', new Blob([readFileSync(bundle)]))
  unlinkSync(bundle)
  await sh(sbx, 'git fetch --quiet /tmp/rig.bundle HEAD && rm /tmp/rig.bundle', { cwd: repo.boxDir })
}

async function applyUncommitted(sbx: Sandbox, repo: Repo): Promise<void> {
  const patch = gitBytes(repo.root, ['diff', '--binary', '--ignore-submodules', '--no-ext-diff', '--no-textconv', 'HEAD'])
  if (patch.length === 0) return
  await sbx.files.write('/tmp/rig.patch', new Blob([patch]))
  await sh(sbx, 'git apply --whitespace=nowarn /tmp/rig.patch && rm /tmp/rig.patch', { cwd: repo.boxDir })
}

function untrackedFiles(root: string): string[] {
  return git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)
}

async function uploadFiles(sbx: Sandbox, repo: Repo, paths: string[]): Promise<void> {
  const root = realpathSync(repo.root)
  const entries = paths.flatMap((rel) => {
    const abs = join(repo.root, rel)
    const size = safeSize(abs)
    if (size === undefined) return []
    if (!insideRepo(root, abs) || isGitDir(root, abs)) {
      console.error(`Skipping ${clean(rel)}: rig only uploads files inside the repo, never from .git.`)
      return []
    }
    if (size > MAX_UNTRACKED_BYTES) {
      console.error(`Skipping ${rel} (${Math.round(size / 1e6)} MB is over the upload limit).`)
      return []
    }
    return [{ path: `${repo.boxDir}/${rel}`, data: new Blob([readFileSync(abs)]) }]
  })
  if (entries.length > 0) await sbx.files.write(entries)
}

// Resolves every symlink along the path, so neither `../x`, `/etc/x` nor a committed
// folder symlink (`h -> ~`) can point an upload at a file outside the repo.
// Only the parent folder is resolved: the file itself is already known to be a
// regular file, and resolving a FIFO would block forever.
function insideRepo(root: string, abs: string): boolean {
  try {
    return join(realpathSync(dirname(abs)), basename(abs)).startsWith(root + sep)
  } catch {
    return false
  }
}

// .git/config can hold a token in the remote URL or an auth header.
const isGitDir = (root: string, abs: string) =>
  join(realpathSync(dirname(abs)), basename(abs)).slice(root.length + 1).split(sep)[0] === '.git'

// lstat, not stat: the file itself must be a regular file, never a symlink.
function safeSize(abs: string): number | undefined {
  try {
    const st = lstatSync(abs)
    return st.isFile() ? st.size : undefined
  } catch {
    return undefined
  }
}

// Installs only when the lockfile differs from the last install, so a plain
// file sync never pays for `bun install`.
async function installIfLockChanged(sbx: Sandbox, repo: Repo): Promise<boolean> {
  const cfg = projectConfig(repo.root)
  if (!cfg.setup) return false
  const lock = lockfile(repo.root) ?? 'package.json'
  const hash = (await sh(sbx, `sha256sum ${q(lock)} 2>/dev/null | cut -c1-64`, { cwd: repo.boxDir })) || 'no-lockfile'
  const marker = `${repo.boxDir}/.git/rig-lock-hash`
  const last = await sh(sbx, `cat ${q(marker)} 2>/dev/null || true`)
  if (hash === last) return false
  console.error(`Running setup: ${clean(cfg.setup)}`)
  await sh(sbx, cfg.setup, { cwd: repo.boxDir, timeoutMs: 1_800_000, stream: true })
  await sh(sbx, `echo ${q(hash)} > ${q(marker)}`)
  return true
}
