import { NotFoundError, Sandbox, type SandboxInfo } from 'e2b'
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
  try {
    return await Sandbox.create(golden(), opts)
  } catch (err) {
    if (!(err instanceof NotFoundError)) throw err
    console.error(`No golden snapshot "${golden()}" yet — starting from "${baseTemplate()}".`)
    return Sandbox.create(baseTemplate(), opts)
  }
}

// Connecting resumes a paused box and pushes its idle deadline out again.
export async function openBox(id: string, busyMs = 0): Promise<Sandbox> {
  const sbx = await Sandbox.connect(id, { ...auth(), timeoutMs: idleMs() })
  if (busyMs > 0) await sbx.setTimeout(busyMs + idleMs())
  return sbx
}

export async function listBoxes(filter: Tags = {}): Promise<SandboxInfo[]> {
  const pages = Sandbox.list({ ...auth(), query: { metadata: { ...OWNER_TAG, ...filter } } })
  const boxes: SandboxInfo[] = []
  while (pages.hasNext) boxes.push(...(await pages.nextItems()))
  return boxes.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
}

// A box is named by its sandbox id, an id prefix, or its `name` tag.
export async function resolveBox(ref: string): Promise<SandboxInfo> {
  const boxes = await listBoxes()
  const hits = boxes.filter((b) => b.sandboxId === ref || b.metadata.name === ref || b.sandboxId.startsWith(ref))
  if (hits.length === 1) return hits[0]!
  if (hits.length === 0) throw new Error(`No box matches "${ref}". Run \`rig ls\`.`)
  throw new Error(`"${ref}" matches ${hits.length} boxes: ${hits.map((b) => b.sandboxId).join(', ')}`)
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
