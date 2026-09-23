import { NotFoundError, Sandbox, type SandboxInfo, type SandboxState } from 'e2b'
import { baseTemplate, DISPLAY, golden, idleMs, OWNER_TAG } from './config'
import { connection } from './key'

export type Tags = Record<string, string>

const auth = () => connection()

// Private by construction: every port needs the box's traffic token, which only
// rig holds. Idle boxes pause with RAM kept, and wake on the next request.
export async function createBox(tags: Tags): Promise<Sandbox> {
  const opts = {
    ...auth(),
    metadata: { ...OWNER_TAG, ...tags },
    timeoutMs: idleMs(),
    lifecycle: { onTimeout: 'pause' as const, autoResume: true },
    // The dev server sees `localhost:<port>` as its Host, exactly as on a laptop,
    // so OAuth redirects and dev-origin checks behave the same.
    network: { allowPublicTraffic: false, maskRequestHost: 'localhost:${PORT}' },
    envs: { DISPLAY },
  }
  if (await goldenExists()) return Sandbox.create(golden(), opts)
  console.error(`No golden snapshot "${golden()}" yet — starting from "${baseTemplate()}".`)
  return Sandbox.create(baseTemplate(), opts)
}

export async function goldenExists(): Promise<boolean> {
  const pages = Sandbox.listSnapshots({ ...auth(), name: golden() })
  return pages.hasNext && (await pages.nextItems()).length > 0
}

// Connecting resumes a paused box and pushes its idle deadline out again.
export async function openBox(id: string, busyMs = 0): Promise<Sandbox> {
  const sbx = await Sandbox.connect(id, { ...auth(), timeoutMs: idleMs() })
  if (busyMs > 0) await sbx.setTimeout(busyMs + idleMs())
  return sbx
}

export type ListQuery = { tags?: Tags; state?: SandboxState[] }

// Filters run on E2B's side, page by page, so listing stays cheap with thousands of boxes.
export async function listBoxes(query: ListQuery = {}): Promise<SandboxInfo[]> {
  const pages = Sandbox.list({
    ...auth(),
    limit: 100,
    query: { metadata: { ...OWNER_TAG, ...query.tags }, state: query.state ?? ['running', 'paused'] },
  })
  const boxes: SandboxInfo[] = []
  while (pages.hasNext) boxes.push(...(await pages.nextItems()))
  return boxes.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
}

// A box is named by its id (one direct lookup), its `name` tag (one filtered list),
// or, as a last resort, an id prefix.
export async function resolveBox(ref: string): Promise<SandboxInfo> {
  const byId = await getRigBox(ref)
  if (byId) return byId
  const byName = await listBoxes({ tags: { name: ref } })
  const hits = byName.length > 0 ? byName : (await listBoxes()).filter((b) => b.sandboxId.startsWith(ref))
  if (hits.length === 1) return hits[0]!
  if (hits.length === 0) throw new Error(`No box matches "${ref}". Run \`rig ls\`.`)
  throw new Error(`"${ref}" matches ${hits.length} boxes: ${hits.map((b) => b.sandboxId).join(', ')}`)
}

async function getRigBox(id: string): Promise<SandboxInfo | undefined> {
  if (!/^[a-z0-9]{12,}$/.test(id)) return undefined
  try {
    const info = await Sandbox.getInfo(id, auth())
    return info.metadata.rig === OWNER_TAG.rig ? info : undefined
  } catch (err) {
    if (err instanceof NotFoundError) return undefined
    throw err
  }
}

export async function killBox(id: string): Promise<void> {
  await Sandbox.kill(id, auth())
}

export async function pauseBox(id: string): Promise<void> {
  await Sandbox.pause(id, auth())
}

// Naming the snapshot adds a new build to the golden template, so it becomes
// what every later `rig up` starts from.
export async function snapshotBox(id: string, promote: boolean): Promise<string> {
  const info = await Sandbox.createSnapshot(id, { ...auth(), ...(promote ? { name: golden() } : {}) })
  return info.names[0] ?? info.snapshotId
}

export type SnapshotRow = { snapshotId: string; names: string[] }

export async function listSnapshots(): Promise<SnapshotRow[]> {
  const pages = Sandbox.listSnapshots({ ...auth(), limit: 100 })
  const rows: SnapshotRow[] = []
  while (pages.hasNext) rows.push(...(await pages.nextItems()))
  return rows
}

export async function deleteSnapshot(id: string): Promise<boolean> {
  return Sandbox.deleteSnapshot(id, auth())
}
