import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { commandsDoc } from '../scripts/gen-docs'
import { COMMAND_HELP } from '../src/help'

test('docs/commands.md matches the CLI help (run `bun run docs` to update)', () => {
  expect(readFileSync(join(import.meta.dir, '..', 'docs', 'commands.md'), 'utf8')).toBe(commandsDoc())
})

test('every command with help appears in the reference', () => {
  for (const name of Object.keys(COMMAND_HELP)) expect(commandsDoc()).toContain(`### rig ${name}`)
})
