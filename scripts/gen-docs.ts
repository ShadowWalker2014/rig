// Writes docs/commands.md from the CLI's own help text, so the two never disagree.
// Run with `bun run docs`; a test fails if the file is out of date.
import { COMMAND_HELP } from '../src/help'

const ORDER = [
  ['Setup', ['login', 'logout', 'image', 'new', 'desktop', 'save', 'saved', 'cookies', 'skill', 'doctor']],
  ['Every task', ['up', 'sync', 'exec', 'browser', 'shot', 'port', 'logs', 'pull', 'guide']],
  ['Managing boxes', ['status', 'ls', 'pause', 'kill', 'prune', 'snap']],
] as const

export function commandsDoc(): string {
  const out = ['# Command reference', '', 'Generated from `rig help <command>` by `bun run docs`. Every command also prints this with `--help`.', '']
  for (const [group, names] of ORDER) {
    out.push(`## ${group}`, '')
    for (const name of names) out.push(`### rig ${name}`, '', '```', COMMAND_HELP[name]!, '```', '')
  }
  return out.join('\n')
}

if (import.meta.main) await Bun.write(`${import.meta.dir}/../docs/commands.md`, commandsDoc())
