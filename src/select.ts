import { RateLimitError, type SandboxInfo, type SandboxState } from 'e2b'
import { str, type Args } from './args'
import { idleMs } from './config'
import { listBoxes, type Tags } from './box'
import { currentRepo } from './repo'

// "7d", "12h", "30m" → milliseconds.
export function parseAge(text: string): number {
  const m = text.match(/^(\d+)([mhd])$/)
  if (!m) throw new Error(`Cannot read "${text}" as an age. Use a number and m, h or d: 30m, 12h, 7d.`)
  return Number(m[1]) * { m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 'm' | 'h' | 'd']
}

// A paused box stopped at its idle deadline, so that deadline minus the idle window
// is roughly when it was last used. A running box is in use now.
export function lastUsed(b: SandboxInfo): Date {
  return b.state === 'running' ? new Date() : new Date(b.endAt.getTime() - idleMs())
}

export const hasSelection = (a: Args) =>
  Boolean(a.flags.all || a.flags.state || a.flags['older-than'] || a.flags.repo || a.flags.branch || a.flags.here)

// Turns --state/--older-than/--repo/--branch/--here/--all into one box list.
// Tag and state filters run on E2B's side; age is checked here.
export async function selectBoxes(a: Args): Promise<SandboxInfo[]> {
  const tags: Tags = {}
  if (a.flags.here) {
    const repo = currentRepo()
    tags.repo = repo.slug
  }
  if (str(a.flags.repo)) tags.repo = str(a.flags.repo)!
  if (str(a.flags.branch)) tags.branch = str(a.flags.branch)!
  const state = str(a.flags.state)
  if (state && state !== 'running' && state !== 'paused') throw new Error('--state must be running or paused.')
  const boxes = await listBoxes({ tags, state: state ? [state as SandboxState] : undefined })
  const olderThan = str(a.flags['older-than'])
  if (!olderThan) return boxes
  const cutoff = Date.now() - parseAge(olderThan)
  return boxes.filter((b) => lastUsed(b).getTime() < cutoff)
}

// Runs an action over many boxes, a few at a time, retrying when E2B rate-limits.
// One box failing never stops the rest; failures are counted and reported.
export async function forEachBox(
  boxes: SandboxInfo[],
  verb: string,
  action: (id: string) => Promise<unknown>,
  concurrency = 8,
): Promise<{ done: number; failed: number }> {
  let next = 0
  let done = 0
  let failed = 0
  const worker = async () => {
    while (next < boxes.length) {
      const box = boxes[next++]!
      try {
        await withRetry(() => action(box.sandboxId))
        done++
      } catch (err) {
        failed++
        console.error(`Could not ${verb} ${box.sandboxId}: ${(err as Error).message}`)
      }
      if (boxes.length > 20 && (done + failed) % 25 === 0) console.error(`  ${done + failed}/${boxes.length}`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, boxes.length) }, worker))
  return { done, failed }
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn()
    } catch (err) {
      if (!(err instanceof RateLimitError) || i >= attempts) throw err
      await Bun.sleep(500 * 2 ** i)
    }
  }
}
