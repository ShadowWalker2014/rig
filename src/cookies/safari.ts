import { readFileSync } from 'node:fs'
import type { Cookie } from './read'

const MAC_EPOCH = 978_307_200 // 2001-01-01 in Unix seconds

// Safari's Cookies.binarycookies: a big-endian page table, then little-endian
// pages of records. Values are stored in the clear, but macOS only lets an app
// with Full Disk Access read the file.
export function readSafariCookies(path: string): Cookie[] {
  let buf: Buffer
  try {
    buf = readFileSync(path)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EPERM') {
      throw new Error('macOS blocked reading Safari cookies. Give your terminal Full Disk Access in System Settings → Privacy & Security, then retry.')
    }
    throw err
  }
  if (buf.subarray(0, 4).toString() !== 'cook') throw new Error('Safari cookie file is not in the expected format.')
  const pages = buf.readUInt32BE(4)
  const sizes = Array.from({ length: pages }, (_, i) => buf.readUInt32BE(8 + i * 4))
  let offset = 8 + pages * 4
  return sizes.flatMap((size) => {
    const page = buf.subarray(offset, offset + size)
    offset += size
    return readPage(page)
  })
}

// Any offset that points outside its record makes the file unreadable, rather
// than producing garbage.
function readPage(page: Buffer): Cookie[] {
  const count = page.readUInt32LE(4)
  return Array.from({ length: count }, (_, i) => {
    const at = page.readUInt32LE(8 + i * 4)
    if (at + 56 > page.length) throw new Error('Safari cookie file is damaged.')
    return readRecord(page.subarray(at, at + page.readUInt32LE(at)))
  })
}

function readRecord(rec: Buffer): Cookie {
  const flags = rec.readUInt32LE(8)
  const str = (at: number) => {
    const start = rec.readUInt32LE(at)
    const end = rec.indexOf(0, start)
    if (start >= rec.length || end < 0) throw new Error('Safari cookie file is damaged.')
    return rec.subarray(start, end).toString('utf8')
  }
  return {
    host: str(16),
    name: str(20),
    path: str(24) || '/',
    value: str(28),
    secure: Boolean(flags & 1),
    httpOnly: Boolean(flags & 4),
    expires: rec.readDoubleLE(40) + MAC_EPOCH,
  }
}
