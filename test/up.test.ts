import { expect, test } from 'bun:test'
import { parseArgs } from '../src/args'
import { repoBoxProblem } from '../src/commands'

const repo = { slug: 'acme/web', branch: 'feat/login' }
const box = (metadata: Record<string, string>) => ({ sandboxId: 'ibox123', metadata })

test('rig up -b parses the box id', () => {
  expect(parseArgs(['up', '-b', 'ibox123']).flags.box).toBe('ibox123')
  expect(parseArgs(['up', '--box', 'ibox123', '--no-dev']).flags.box).toBe('ibox123')
})

test('a box for this repo and branch is accepted', () => {
  expect(repoBoxProblem(box({ repo: 'acme/web', branch: 'feat/login' }), repo)).toBeUndefined()
})

test('a box for another repo is refused', () => {
  expect(repoBoxProblem(box({ repo: 'acme/api', branch: 'feat/login' }), repo)).toContain('not a acme/web box (it holds acme/api)')
})

test('a clean rig new box, with no repo, is refused', () => {
  expect(repoBoxProblem(box({ name: 'scratch' }), repo)).toContain('not a acme/web box.')
})

test('a box for another branch is refused', () => {
  expect(repoBoxProblem(box({ repo: 'acme/web', branch: 'main' }), repo)).toContain('is for branch main, and you are on feat/login')
})
