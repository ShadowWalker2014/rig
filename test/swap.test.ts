import { expect, test } from 'bun:test'
import { SWAP_SCRIPT, WATCH_LIMITS_SCRIPT, ZSWAP_SCRIPT } from '../src/services'

test('the swap scripts are valid bash', () => {
  for (const script of [SWAP_SCRIPT, ZSWAP_SCRIPT]) {
    const r = Bun.spawnSync(['bash', '-n', '-c', script])
    expect(r.stderr.toString()).toBe('')
    expect(r.exitCode).toBe(0)
  }
})

test('the swap file is capped at 4 GB and leaves 8 GB of disk free', () => {
  expect(SWAP_SCRIPT).toContain('size=$(( ram < 4096 ? ram : 4096 ))')
  expect(SWAP_SCRIPT).toContain('size=$(( size < disk - 8192 ? size : disk - 8192 ))')
})

test('file-watch limits are raised past the kernel default of 65,536', () => {
  expect(WATCH_LIMITS_SCRIPT).toContain('fs.inotify.max_user_watches=1048576')
  expect(WATCH_LIMITS_SCRIPT).toContain('fs.inotify.max_user_instances=8192')
})

test('zswap is skipped on a kernel without it', () => {
  expect(ZSWAP_SCRIPT.split('\n')[1]).toBe('[ -w $z/enabled ] || exit 0')
})

test('swap is added once: a box that already has swap is left alone', () => {
  expect(SWAP_SCRIPT.split('\n')[0]).toBe('swapon --show=NAME --noheadings | grep -q . && exit 0')
})

test('a refused swapon removes the swap file instead of filling the disk', () => {
  expect(SWAP_SCRIPT).toContain('swapon /swapfile || { rm -f /swapfile; exit 3; }')
})
