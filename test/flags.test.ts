import { expect, test } from 'bun:test'
import { parseArgs } from '../src/args'
import { boxRef } from '../src/commands'
import { allowedFlags } from '../src/help'

const FILTERS = ['state', 'older-than', 'repo', 'branch', 'here', 'all']

// Every flag each command's code reads. If a help edit drops one, this fails
// before a user finds the flag refused.
const READS: Record<string, string[]> = {
  up: ['box', 'new', 'name', 'from', 'no-dev', 'yes', 'copy', 'dev', 'port', 'setup'],
  new: ['name', 'from'],
  init: ['yes', 'copy', 'dev', 'port', 'setup'],
  sync: ['box'],
  exec: ['box', 'timeout', 'cwd'],
  browser: ['box'],
  shot: ['box', 'url'],
  port: ['box', 'local'],
  desktop: ['box', 'local', 'stop', 'serve'],
  logs: ['box', 'lines'],
  pull: ['box'],
  ls: ['limit', 'ids', 'json', ...FILTERS],
  pause: ['box', ...FILTERS],
  kill: ['box', 'yes', ...FILTERS],
  prune: ['older-than', 'merged', 'yes'],
  cookies: ['box', 'site', 'skip', 'all', 'from', 'force', 'yes', 'limit', 'include-sensitive'],
  saved: ['force'],
  snaps: ['force'],
  save: ['as', 'use', 'force'],
  snap: ['box', 'default', 'as', 'use', 'force'],
  mcp: ['box'],
  screen: ['box'],
  click: ['box', 'right', 'middle', 'double', 'triple'],
  move: ['box'],
  drag: ['box'],
  scroll: ['box'],
  type: ['box'],
  key: ['box'],
  zoom: ['box'],
  cursor: ['box'],
}

test('every flag a command reads is one it accepts', () => {
  for (const [cmd, flags] of Object.entries(READS)) {
    const allowed = allowedFlags(cmd)!
    for (const f of flags) expect(`${cmd} --${f}: ${allowed.has(f)}`).toBe(`${cmd} --${f}: true`)
  }
})

test('flags a command does not use are refused', () => {
  expect(allowedFlags('up')!.has('verbose')).toBe(false)
  expect(allowedFlags('prune')!.has('repo')).toBe(false)
  expect(allowedFlags('status')!.has('box')).toBe(false)
  expect(allowedFlags('login')!.has('new')).toBe(false)
  // Flags in examples after " -- " belong to the command run in the box, not to rig.
  expect(allowedFlags('exec')!.has('no')).toBe(false)
  expect(allowedFlags('browser')!.has('full')).toBe(false)
})

test('an on/off flag with a value is refused, so --yes=false never means yes', () => {
  expect(() => parseArgs(['kill', '--repo', 'acme/web', '--yes=false'])).toThrow('takes no value')
  expect(() => parseArgs(['up', '--new=false'])).toThrow('takes no value')
})

test('errors name the flag as it was typed', () => {
  expect(parseArgs(['save', 'x', '--promote']).typed?.default).toBe('promote')
})

test('inline values work for long and short flags', () => {
  expect(parseArgs(['up', '--box=ibox1']).flags.box).toBe('ibox1')
  expect(parseArgs(['up', '-b=ibox1']).flags.box).toBe('ibox1')
  expect(parseArgs(['exec', '--timeout=30', '--', 'ls']).flags.timeout).toBe('30')
  expect(parseArgs(['exec', '--', 'grep', '--color=never', 'x']).rest).toEqual(['grep', '--color=never', 'x'])
})

test('naming two different boxes is refused; the same box twice is fine', () => {
  expect(() => boxRef(parseArgs(['logs', 'boxa', '-b', 'boxb']))).toThrow('Two boxes named')
  expect(boxRef(parseArgs(['logs', 'boxa', '-b', 'boxa']))).toBe('boxa')
  expect(boxRef(parseArgs(['logs', '-b', 'boxb']))).toBe('boxb')
  expect(boxRef(parseArgs(['screen', 'out.png', '-b', 'boxb']), false)).toBe('boxb')
  expect(boxRef(parseArgs(['logs', 'boxa', '--box=']))).toBe('boxa')
})
