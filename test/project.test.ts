import { expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detectConfig, detectPort, localEnvFiles, projectConfig } from '../src/project'

const repo = (files: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-project-'))
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body)
  return dir
}
const pkg = (p: object) => JSON.stringify(p)

test('package manager and commands come from the lockfile and package.json', () => {
  const dir = repo({ 'bun.lock': '', 'package.json': pkg({ scripts: { dev: 'next dev' }, dependencies: { next: '16' } }) })
  expect(detectConfig(dir)).toMatchObject({ setup: 'bun install', dev: 'bun run dev', port: 3000, copy: [], submodules: false })
  expect(detectConfig(repo({ 'pnpm-lock.yaml': '', 'package.json': pkg({}) }))).toMatchObject({ setup: 'pnpm install', dev: undefined })
})

test('the dev port comes from the script, then the framework', () => {
  expect(detectPort({ scripts: { dev: 'vite --port 4000' } })).toBe(4000)
  expect(detectPort({ scripts: { dev: 'next dev -p 3100' } })).toBe(3100)
  expect(detectPort({ scripts: { dev: 'PORT=8080 node server.js' } })).toBe(8080)
  expect(detectPort({ scripts: { dev: 'vite' }, devDependencies: { vite: '6' } })).toBe(5173)
  expect(detectPort({ scripts: { dev: 'astro dev' }, dependencies: { astro: '5' } })).toBe(4321)
  expect(detectPort({ scripts: { dev: 'node server.js' } })).toBe(3000)
  // the command in the script beats a package that is merely installed
  expect(detectPort({ scripts: { dev: 'vite' }, dependencies: { next: '16', vite: '6' } })).toBe(5173)
})

test('rig.json overrides what was detected', () => {
  const dir = repo({ 'bun.lock': '', 'package.json': pkg({ scripts: { dev: 'next dev' } }), 'rig.json': pkg({ port: 4100, copy: ['.env.local'] }) })
  expect(projectConfig(dir)).toMatchObject({ setup: 'bun install', port: 4100, copy: ['.env.local'] })
  expect(() => projectConfig(repo({ 'rig.json': '{ nope' }))).toThrow('rig init')
})

test('only gitignored env files that exist are offered for copying', () => {
  const dir = repo({ '.env.local': 'X=1', '.env': 'Y=2', '.env.example': 'Z=' })
  expect(localEnvFiles(dir, (f) => f === '.env.local')).toEqual(['.env.local'])
})
