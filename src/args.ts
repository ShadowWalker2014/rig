export type Args = {
  cmd: string
  sub: string[]
  flags: Record<string, string | true>
  rest: string[]
  typed?: Record<string, string> // the name each flag was given as, for error messages
}

const SHORT: Record<string, string> = { b: 'box', t: 'timeout', n: 'lines', h: 'help' }
const BOOLEAN = new Set(['promote', 'default', 'force', 'new', 'no-dev', 'all', 'yes', 'json', 'help', 'ids', 'merged', 'here', 'golden', 'include-sensitive', 'use', 'serve', 'stop', 'right', 'middle', 'double', 'triple'])
// Older names that still work.
const ALIASES: Record<string, string> = { golden: 'default', promote: 'default' }

// `rig <cmd> [positionals] [--flags] [-- command to run in the box]`
export function parseArgs(argv: string[]): Args {
  const split = argv.indexOf('--')
  const head = split === -1 ? argv : argv.slice(0, split)
  const rest = split === -1 ? [] : argv.slice(split + 1)
  const flags: Args['flags'] = {}
  const typed: Record<string, string> = {}
  const positional: string[] = []
  for (let i = 0; i < head.length; i++) {
    const [a, inline] = splitInline(head[i]!)
    const key = a.startsWith('--') ? a.slice(2) : a.startsWith('-') && a.length === 2 ? SHORT[a[1]!] : undefined
    if (!key) positional.push(head[i]!)
    else if (BOOLEAN.has(key)) {
      // "--yes=false" must not quietly mean yes.
      if (inline !== undefined) throw new Error(`--${key} takes no value; leave it out to turn it off.`)
      flags[ALIASES[key] ?? key] = true
      typed[ALIASES[key] ?? key] = key
    } else {
      flags[key] = inline ?? head[++i] ?? ''
      typed[key] = key
    }
  }
  return { cmd: positional[0] ?? 'help', sub: positional.slice(1), flags, rest, typed }
}

// "--box=foo" and "-b=foo" carry their value inline.
function splitInline(a: string): [string, string | undefined] {
  const eq = a.indexOf('=')
  return a.startsWith('-') && eq > 1 ? [a.slice(0, eq), a.slice(eq + 1)] : [a, undefined]
}

export const str = (v: string | true | undefined) => (typeof v === 'string' ? v : undefined)
