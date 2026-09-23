import { expect, test } from 'bun:test'
import { RateLimitError, type SandboxInfo } from 'e2b'
import { forEachBox, lastUsed, parseAge } from '../src/select'

const box = (id: string, state: 'running' | 'paused' = 'paused', endAt = new Date()) =>
  ({ sandboxId: id, state, endAt, metadata: {} }) as unknown as SandboxInfo

test('reads ages in minutes, hours and days', () => {
  expect(parseAge('30m')).toBe(30 * 60_000)
  expect(parseAge('12h')).toBe(12 * 3_600_000)
  expect(parseAge('7d')).toBe(7 * 86_400_000)
  expect(() => parseAge('7 days')).toThrow()
})

test('a paused box was last used one idle window before it paused', () => {
  const pausedAt = new Date('2026-09-01T12:15:00Z')
  expect(lastUsed(box('a', 'paused', pausedAt)).toISOString()).toBe('2026-09-01T12:00:00.000Z')
  expect(Date.now() - lastUsed(box('b', 'running')).getTime()).toBeLessThan(1000)
})

test('acts on thousands of boxes, a few at a time', async () => {
  const boxes = Array.from({ length: 2000 }, (_, i) => box(`b${i}`))
  let inFlight = 0
  let peak = 0
  const seen = new Set<string>()
  const result = await forEachBox(boxes, 'test', async (id) => {
    peak = Math.max(peak, ++inFlight)
    await Bun.sleep(0)
    seen.add(id)
    inFlight--
  })
  expect(result).toEqual({ done: 2000, failed: 0 })
  expect(seen.size).toBe(2000)
  expect(peak).toBeLessThanOrEqual(8)
})

test('retries rate limits, and one failure never stops the rest', async () => {
  const boxes = [box('flaky'), box('broken'), box('fine')]
  let flakyCalls = 0
  const result = await forEachBox(boxes, 'test', async (id) => {
    if (id === 'flaky' && ++flakyCalls < 2) throw new RateLimitError('429')
    if (id === 'broken') throw new Error('boom')
  })
  expect(flakyCalls).toBe(2)
  expect(result).toEqual({ done: 2, failed: 1 })
})
