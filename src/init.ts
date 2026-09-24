import { str, type Args } from './args'
import { detectConfig, hasConfigFile, localEnvFiles, projectConfig, writeConfig, type ProjectConfig } from './project'
import { currentRepo, isIgnored } from './repo'
import { clean } from './sanitize'

const csv = (v: string | true | undefined) => (str(v) ?? '').split(',').map((s) => s.trim()).filter(Boolean)

let lines: AsyncIterator<string> | undefined
async function ask(question: string): Promise<boolean> {
  process.stderr.write(`${question} [y/N] `)
  lines ??= console[Symbol.asyncIterator]()
  const { value } = await lines.next()
  return /^y(es)?$/i.test(String(value ?? '').trim())
}

// `rig init`: work out how this repo runs, ask about anything that needs a
// person (env files with secrets), and write rig.json. `--yes` never copies an
// env file unless it is named with --copy.
export async function init(a: Args): Promise<void> {
  const repo = currentRepo()
  const interactive = Boolean(process.stdin.isTTY) && !a.flags.yes
  const cfg = await settleConfig(repo.root, a, interactive)
  writeConfig(repo.root, cfg)
  describe(repo.slug, cfg)
  console.error('\nSaved rig.json. Commit it to share these settings, or add it to .gitignore to keep them to yourself.')
  console.error('Next: rig up')
}

export async function settleConfig(root: string, a: Args, interactive: boolean): Promise<ProjectConfig> {
  const cfg = hasConfigFile(root) ? projectConfig(root) : detectConfig(root)
  if (str(a.flags.setup)) cfg.setup = str(a.flags.setup)
  if (str(a.flags.dev)) cfg.dev = str(a.flags.dev)
  if (str(a.flags.port)) cfg.port = Number(str(a.flags.port))
  cfg.copy = [...new Set([...cfg.copy, ...csv(a.flags.copy)])]
  const envs = localEnvFiles(root, (f) => isIgnored(root, f)).filter((f) => !cfg.copy.includes(f))
  for (const f of envs) {
    if (interactive && (await ask(`${f} is on this Mac but not in git, so the box won't have it. It usually holds secrets. Copy it into the box on every sync?`))) {
      cfg.copy.push(f)
    }
  }
  const skipped = envs.filter((f) => !cfg.copy.includes(f))
  if (skipped.length && !interactive) console.error(`Not copying ${skipped.join(', ')}. If the dev server needs it: rig init --copy ${skipped.join(',')}`)
  return cfg
}

export function describe(slug: string, cfg: ProjectConfig): void {
  console.error(`Settings for ${clean(slug)}:`)
  console.error(`  setup       ${cfg.setup ? clean(cfg.setup) : '(none)'}`)
  console.error(`  dev server  ${cfg.dev ? `${clean(cfg.dev)}  on port ${cfg.port}` : '(none)'}`)
  console.error(`  copy        ${cfg.copy.length ? cfg.copy.map(clean).join(', ') : '(nothing)'}`)
  console.error(`  submodules  ${cfg.submodules ? 'yes' : 'no'}`)
}
