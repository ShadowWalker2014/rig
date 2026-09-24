import { expect, test } from 'bun:test'
import { SWAP_SCRIPT } from '../src/services'

test('the swap script is valid bash', () => {
  const r = Bun.spawnSync(['bash', '-n', '-c', SWAP_SCRIPT])
  expect(r.stderr.toString()).toBe('')
  expect(r.exitCode).toBe(0)
})

test('swap is added once: a box that already has swap is left alone', () => {
  expect(SWAP_SCRIPT.split('\n')[0]).toBe('swapon --show=NAME --noheadings | grep -q . && exit 0')
})

test('a refused swapon removes the swap file instead of filling the disk', () => {
  expect(SWAP_SCRIPT).toContain('swapon /swapfile || { rm -f /swapfile; exit 3; }')
})
