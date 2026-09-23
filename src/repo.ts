import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WORK_DIR } from './config'

export type Repo = {
  root: string
  origin: string
  slug: string
  name: string
  branch: string
  head: string
  boxDir: string
}

export type ProjectConfig = {
  setup?: string
  dev?: string
  port: number
  copy: string[]
  submodules: boolean
}

// A repo's own .git/config can name programs for git to run: fsmonitor, hooks,
// clean/process filters (run by `git diff` on touched files) and the ssh command a
// partial clone's lazy fetch uses. rig switches all of them off for the repo's own
// config, so reading a repo never runs its code on this machine. Filters from your
// global config (git-lfs) keep working.
const SAFE_GIT = ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null']
const SAFE_ENV = { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' }

function runGit(cwd: string, args: string[]): Buffer {
  const res = Bun.spawnSync(['git', ...SAFE_GIT, ...localFilterOverrides(cwd), ...args], { cwd, stderr: 'pipe', env: SAFE_ENV })
  if (res.exitCode !== 0) throw new Error(`git ${args.join(' ')}: ${res.stderr.toString().trim()}`)
  return res.stdout
}

function localFilterOverrides(cwd: string): string[] {
  const res = Bun.spawnSync(['git', ...SAFE_GIT, 'config', '--local', '--name-only', '--get-regexp', '^filter\\.'], { cwd, env: SAFE_ENV })
  const names = new Set(res.stdout.toString().split('\n').map((k) => k.replace(/\.[^.]+$/, '')).filter(Boolean))
  return [...names].flatMap((f) => ['-c', `${f}.clean=`, '-c', `${f}.smudge=`, '-c', `${f}.process=`])
}

export const git = (cwd: string, args: string[]): string => runGit(cwd, args).toString().trim()
export const gitBytes = (cwd: string, args: string[]): Uint8Array => runGit(cwd, args)

// SSH remotes become HTTPS so the box can clone with its own `gh` login.
// Any user:token@ part is dropped: the box signs in with its own `gh` login.
export function httpsRemote(url: string): string {
  const ssh = url.match(/^git@([^:]+):(.+?)(\.git)?$/)
  return ssh ? `https://${ssh[1]}/${ssh[2]}.git` : url.replace(/^(https?:\/\/)[^@/]*@/, '$1')
}

export function slugOf(url: string): string {
  return httpsRemote(url).replace(/^https?:\/\/[^/]+\//, '').replace(/\.git$/, '')
}

export function currentRepo(cwd = process.cwd()): Repo {
  const root = git(cwd, ['rev-parse', '--show-toplevel'])
  const origin = httpsRemote(git(root, ['remote', 'get-url', 'origin']))
  const slug = slugOf(origin)
  const name = slug.split('/').pop() ?? ''
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name === '.' || name === '..') {
    throw new Error(`Cannot use "${name}" from remote ${origin} as a folder name.`)
  }
  return {
    root,
    origin,
    slug,
    name,
    branch: git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    head: git(root, ['rev-parse', 'HEAD']),
    boxDir: `${WORK_DIR}/${name}`,
  }
}

// Per-repo settings live in `rig.json` at the repo root; everything has a default.
export function projectConfig(root: string): ProjectConfig {
  const file = join(root, 'rig.json')
  const raw = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
  const pm = packageManager(root)
  return {
    setup: raw.setup ?? (pm ? `${pm} install` : undefined),
    dev: raw.dev ?? (pm && hasDevScript(root) ? `${pm} run dev` : undefined),
    port: raw.port ?? 3000,
    copy: raw.copy ?? [],
    submodules: raw.submodules ?? existsSync(join(root, '.gitmodules')),
  }
}

export function lockfile(root: string): string | undefined {
  return ['bun.lock', 'bun.lockb', 'pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'].find((f) => existsSync(join(root, f)))
}

function packageManager(root: string): string | undefined {
  const lock = lockfile(root)
  if (lock?.startsWith('bun')) return 'bun'
  if (lock === 'pnpm-lock.yaml') return 'pnpm'
  if (lock === 'yarn.lock') return 'yarn'
  if (lock === 'package-lock.json' || existsSync(join(root, 'package.json'))) return 'npm'
  return undefined
}

function hasDevScript(root: string): boolean {
  const pkg = join(root, 'package.json')
  return existsSync(pkg) && Boolean(JSON.parse(readFileSync(pkg, 'utf8')).scripts?.dev)
}
