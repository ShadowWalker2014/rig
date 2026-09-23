import { Template, type SandboxInfo } from 'e2b'
import { str, type Args } from './args'
import { deleteSnapshot, goldenExists, killBox, listBoxes, listSnapshots, pauseBox, resolveBox } from './box'
import { target } from './commands'
import { baseTemplate, boxCpu, boxMemoryMb, golden, idleMs } from './config'
import { connection, setting } from './key'
import { currentRepo, git } from './repo'
import { forEachBox, hasSelection, lastUsed, parseAge, selectBoxes } from './select'

function age(d: Date): string {
  const min = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000))
  if (min < 1) return 'now'
  return min < 60 ? `${min}m ago` : min < 2880 ? `${Math.round(min / 60)}h ago` : `${Math.round(min / 1440)}d ago`
}

function printTable(rows: string[][]): void {
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => r[i]!.length)))
  for (const r of rows) console.log(r.map((c, i) => c.padEnd(widths[i]!)).join('  ').trimEnd())
}

function printBoxes(boxes: SandboxInfo[], limit: number): void {
  const rows = boxes.slice(0, limit).map((b) => [
    b.sandboxId, b.metadata.name ?? '', b.state, b.metadata.repo ?? '', b.metadata.branch ?? '',
    `${b.cpuCount}cpu/${b.memoryMB / 1024}GB`, age(lastUsed(b)),
  ])
  printTable([['ID', 'NAME', 'STATE', 'REPO', 'BRANCH', 'SIZE', 'LAST USED'], ...rows])
  if (boxes.length > limit) console.log(`… and ${boxes.length - limit} more. Use --limit, or narrow with --state, --repo, --branch, --older-than.`)
}

const summary = (boxes: SandboxInfo[]) => {
  const running = boxes.filter((b) => b.state === 'running').length
  return `${boxes.length} box${boxes.length === 1 ? '' : 'es'}: ${running} running, ${boxes.length - running} paused.`
}

export async function ls(a: Args): Promise<void> {
  const boxes = await selectBoxes(a)
  if (a.flags.ids) return void boxes.forEach((b) => console.log(b.sandboxId))
  if (a.flags.json) return void console.log(JSON.stringify(boxes, null, 2))
  if (boxes.length === 0) return void console.log(hasSelection(a) ? 'No boxes match.' : 'No boxes. Run `rig up` in a repo, or `rig new`.')
  printBoxes(boxes, Number(str(a.flags.limit) ?? 50))
  console.log(summary(boxes))
}

// Explicit ids or names, a filter, or else this repo + branch's box.
async function pick(a: Args): Promise<SandboxInfo[]> {
  if (hasSelection(a)) return selectBoxes(a)
  if (a.sub.length > 0) return Promise.all(a.sub.map(resolveBox))
  return [await target(a)]
}

export async function pause(a: Args): Promise<void> {
  const boxes = (await pick(a)).filter((b) => b.state === 'running')
  if (boxes.length === 0) return void console.error('Nothing to pause: those boxes are already paused.')
  const { done, failed } = await forEachBox(boxes, 'pause', pauseBox)
  console.error(`Paused ${done} box${done === 1 ? '' : 'es'}${failed ? `; ${failed} failed` : ''}. Any rig command wakes a box.`)
}

export async function kill(a: Args): Promise<void> {
  const boxes = await pick(a)
  if (boxes.length === 0) return void console.error('No boxes match.')
  if (hasSelection(a) && !a.flags.yes) return preview(boxes, 'delete')
  const { done, failed } = await forEachBox(boxes, 'delete', killBox)
  console.error(`Deleted ${done} box${done === 1 ? '' : 'es'}${failed ? `; ${failed} failed` : ''}.`)
  if (failed) process.exitCode = 1
}

function preview(boxes: SandboxInfo[], verb: string): void {
  printBoxes(boxes, 20)
  console.error(`\nThis would ${verb} ${boxes.length} box${boxes.length === 1 ? '' : 'es'}. Run again with --yes to do it.`)
}

// Cleanup: paused boxes unused for a while, plus (with --merged) boxes of this repo
// whose branch no longer exists on origin. Shows the list first; --yes deletes.
export async function prune(a: Args): Promise<void> {
  const cutoff = Date.now() - parseAge(str(a.flags['older-than']) ?? '7d')
  const stale = (await listBoxes({ state: ['paused'] })).filter((b) => lastUsed(b).getTime() < cutoff)
  const gone = a.flags.merged ? await boxesForDeletedBranches() : []
  const boxes = [...new Map([...stale, ...gone].map((b) => [b.sandboxId, b])).values()]
  if (boxes.length === 0) return void console.error('Nothing to prune.')
  if (!a.flags.yes) return preview(boxes, 'delete')
  const { done, failed } = await forEachBox(boxes, 'delete', killBox)
  console.error(`Pruned ${done} box${done === 1 ? '' : 'es'}${failed ? `; ${failed} failed` : ''}.`)
}

async function boxesForDeletedBranches(): Promise<SandboxInfo[]> {
  const repo = currentRepo()
  const heads = git(repo.root, ['ls-remote', '--heads', 'origin'])
  const live = new Set(heads.split('\n').map((l) => l.split('refs/heads/')[1]).filter(Boolean))
  const boxes = await listBoxes({ tags: { repo: repo.slug } })
  return boxes.filter((b) => b.metadata.branch && !live.has(b.metadata.branch))
}

export async function snaps(a: Args): Promise<void> {
  if (a.sub[0] === 'rm') return removeSnapshots(a.sub.slice(1), Boolean(a.flags.force))
  const rows = await listSnapshots()
  if (rows.length === 0) return void console.log('No snapshots.')
  printTable([['SNAPSHOT', 'NAMES'], ...rows.map((r) => [r.snapshotId, r.names.join(', ')])])
}

async function removeSnapshots(ids: string[], force: boolean): Promise<void> {
  if (ids.length === 0) throw new Error('Usage: rig snaps rm <snapshot id>…')
  for (const id of ids) {
    if (id.split(':')[0]!.endsWith(golden()) && !force) throw new Error(`${id} is the golden snapshot. Add --force to delete it.`)
    const deleted = await deleteSnapshot(id).catch((err: Error) => {
      if (!/running sandboxes/.test(err.message)) throw err
      throw new Error(`${id} is still in use by running boxes. Delete them first (rig ls, then rig kill <id>), then retry.`)
    })
    console.error(`${deleted ? 'Deleted' : 'Not found:'} ${id}`)
  }
}

// One screen that answers "is rig set up right?" without printing any secret.
export async function doctor(): Promise<void> {
  const check = (ok: boolean, label: string, fix = '') => console.log(`${ok ? '✓' : '✗'} ${label}${!ok && fix ? `  →  ${fix}` : ''}`)
  const conn = safely(() => connection())
  check(Boolean(conn), 'E2B API key found', 'rig login, or RIG_E2B_API_KEY in ~/.config/rig/.env')
  if (!conn) return
  console.log(`  E2B at ${conn.domain}`)
  const boxes = await listBoxes().catch((e: Error) => e)
  check(!(boxes instanceof Error), 'E2B accepts the key', boxes instanceof Error ? boxes.message : '')
  if (boxes instanceof Error) return
  console.log(`  ${summary(boxes)}`)
  check(await Template.exists(baseTemplate(), conn), `base image "${baseTemplate()}" built`, 'rig image build')
  check(await goldenExists(), `golden snapshot "${golden()}"`, 'rig new → rig desktop <id> → rig snap <id> --promote (see docs/setup.md)')
  console.log(`  Boxes pause after ${idleMs() / 60_000} idle minutes. New images get ${boxCpu()} CPUs and ${boxMemoryMb() / 1024} GB.`)
  console.log(`  Bun ${Bun.version}. Settings file: ${setting('RIG_E2B_API_KEY') ? 'key from shell or ~/.config/rig/.env' : 'key from the macOS Keychain'}.`)
}

function safely<T>(fn: () => T): T | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}
