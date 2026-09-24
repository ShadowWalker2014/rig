export type Args = {
  cmd: string
  sub: string[]
  flags: Record<string, string | true>
  rest: string[]
}

const SHORT: Record<string, string> = { b: 'box', t: 'timeout', n: 'lines', h: 'help' }
const BOOLEAN = new Set(['promote', 'default', 'force', 'new', 'no-dev', 'all', 'yes', 'json', 'help', 'ids', 'merged', 'here', 'golden', 'include-sensitive', 'use', 'serve', 'stop'])
// Older names that still work.
const ALIASES: Record<string, string> = { golden: 'default', promote: 'default' }

// `rig <cmd> [positionals] [--flags] [-- command to run in the box]`
export function parseArgs(argv: string[]): Args {
  const split = argv.indexOf('--')
  const head = split === -1 ? argv : argv.slice(0, split)
  const rest = split === -1 ? [] : argv.slice(split + 1)
  const flags: Args['flags'] = {}
  const positional: string[] = []
  for (let i = 0; i < head.length; i++) {
    const a = head[i]!
    const key = a.startsWith('--') ? a.slice(2) : a.startsWith('-') && a.length === 2 ? SHORT[a[1]!] : undefined
    if (!key) positional.push(a)
    else if (BOOLEAN.has(key)) flags[ALIASES[key] ?? key] = true
    else flags[key] = head[++i] ?? ''
  }
  return { cmd: positional[0] ?? 'help', sub: positional.slice(1), flags, rest }
}

export const str = (v: string | true | undefined) => (typeof v === 'string' ? v : undefined)
