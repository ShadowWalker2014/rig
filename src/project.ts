import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// A repo's rig settings: what `rig up` runs in the box. Stored in `rig.json` at
// the repo root; anything missing is detected from the repo itself.
export type ProjectConfig = {
  setup?: string
  dev?: string
  port: number
  copy: string[]
  submodules: boolean
}

export const CONFIG_FILE = 'rig.json'

const LOCKFILES: [string, string][] = [
  ['bun.lock', 'bun'], ['bun.lockb', 'bun'], ['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['package-lock.json', 'npm'],
]

// Default dev-server ports: [package, command it installs, port].
const FRAMEWORKS: [string, string, number][] = [
  ['next', 'next', 3000], ['nuxt', 'nuxt', 3000], ['@remix-run/dev', 'remix', 3000], ['astro', 'astro', 4321],
  ['@sveltejs/kit', 'vite', 5173], ['vite', 'vite', 5173], ['@angular/cli', 'ng', 4200],
  ['react-scripts', 'react-scripts', 3000], ['gatsby', 'gatsby', 8000], ['expo', 'expo', 8081],
]

// Gitignored files that commonly hold the secrets a dev server needs.
const ENV_CANDIDATES = ['.env', '.env.local', '.env.development', '.env.development.local', '.dev.vars']

export const lockfile = (root: string) => LOCKFILES.find(([f]) => existsSync(join(root, f)))?.[0]

export function packageManager(root: string): string | undefined {
  const lock = LOCKFILES.find(([f]) => existsSync(join(root, f)))
  if (lock) return lock[1]
  return existsSync(join(root, 'package.json')) ? 'npm' : undefined
}

type PackageJson = { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }

function readPackage(root: string): PackageJson | undefined {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  } catch {
    return undefined
  }
}

// `--port 4000`, `-p 4000` or `PORT=4000` in the dev script wins; otherwise the
// framework's own default; otherwise 3000.
export function detectPort(pkg: PackageJson | undefined): number {
  const script = pkg?.scripts?.dev ?? ''
  const explicit = script.match(/(?:--port[ =]|-p\s+|PORT=)(\d{2,5})/)
  if (explicit) return Number(explicit[1])
  const words = script.split(/[\s;&|]+/)
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies }
  const byCommand = FRAMEWORKS.find(([, bin]) => words.includes(bin))
  return (byCommand ?? FRAMEWORKS.find(([name]) => name in deps))?.[2] ?? 3000
}

// What rig would do with no rig.json at all.
export function detectConfig(root: string): ProjectConfig {
  const pm = packageManager(root)
  const pkg = readPackage(root)
  return {
    setup: pm ? `${pm} install` : undefined,
    dev: pm && pkg?.scripts?.dev ? `${pm} run dev` : undefined,
    port: detectPort(pkg),
    copy: [],
    submodules: existsSync(join(root, '.gitmodules')),
  }
}

export const hasConfigFile = (root: string) => existsSync(join(root, CONFIG_FILE))

// rig.json on top of what was detected.
export function projectConfig(root: string): ProjectConfig {
  const file = join(root, CONFIG_FILE)
  let saved: Partial<ProjectConfig> = {}
  if (existsSync(file)) {
    try {
      saved = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      throw new Error(`${CONFIG_FILE} is not valid JSON. Fix it, or delete it and run \`rig init\`.`)
    }
  }
  return { ...detectConfig(root), ...saved }
}

export function writeConfig(root: string, cfg: ProjectConfig): void {
  const out: Partial<ProjectConfig> = { ...cfg }
  if (!out.setup) delete out.setup
  if (!out.dev) delete out.dev
  writeFileSync(join(root, CONFIG_FILE), `${JSON.stringify(out, null, 2)}\n`)
}

// Gitignored env files that exist on this machine: the box will not have them
// unless they are listed in `copy`.
export function localEnvFiles(root: string, isIgnored: (file: string) => boolean): string[] {
  return ENV_CANDIDATES.filter((f) => existsSync(join(root, f)) && isIgnored(f))
}
