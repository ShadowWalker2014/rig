import { expect, test } from 'bun:test'
import { parseArgs } from '../src/args'
import { httpsRemote, slugOf } from '../src/repo'

test('splits flags, positionals and the box command after --', () => {
  const a = parseArgs(['exec', '-b', 'abc', '--timeout', '30', '--', 'bun', 'test', '--watch'])
  expect(a.cmd).toBe('exec')
  expect(a.flags).toEqual({ box: 'abc', timeout: '30' })
  expect(a.rest).toEqual(['bun', 'test', '--watch'])
})

test('boolean flags take no value', () => {
  const a = parseArgs(['snap', 'box1', '--promote'])
  expect(a.sub).toEqual(['box1'])
  expect(a.flags.default).toBe(true) // --promote is the old name for --default
})

test('no command shows help', () => {
  expect(parseArgs([]).cmd).toBe('help')
})

test('ssh remotes become https so the box can clone with gh', () => {
  expect(httpsRemote('git@github.com:acme/web-app.git')).toBe('https://github.com/acme/web-app.git')
  expect(slugOf('git@github.com:acme/web-app.git')).toBe('acme/web-app')
  expect(slugOf('https://github.com/a/b')).toBe('a/b')
})

test('tokens embedded in a remote URL never reach the box', () => {
  expect(httpsRemote('https://user:ghp_secret@github.com/acme/web-app.git')).toBe('https://github.com/acme/web-app.git')
})
