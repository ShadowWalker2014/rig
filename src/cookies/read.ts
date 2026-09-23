import { Database } from 'bun:sqlite'
import { copyFileSync, chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { createDecipheriv, pbkdf2Sync } from 'node:crypto'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { onInterrupt } from '../cleanup'
import { readSafariCookies } from './safari'

// Cookie values live only in memory: nothing here logs, prints or writes them.
export type Cookie = {
  host: string
  name: string
  value: string
  path: string
  secure: boolean
  httpOnly: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
  expires?: number
}

export type Profile = { browser: string; browserName: string; profile: string; profileName: string; cookiesPath: string }

// Chromium browsers differ only in where the profile tree lives and which
// Keychain entry holds the cookie password.
const CHROMIUM = [
  { id: 'chrome', name: 'Google Chrome', dir: 'Google/Chrome', service: 'Chrome Safe Storage' },
  { id: 'edge', name: 'Microsoft Edge', dir: 'Microsoft Edge', service: 'Microsoft Edge Safe Storage' },
  { id: 'brave', name: 'Brave', dir: 'BraveSoftware/Brave-Browser', service: 'Brave Safe Storage' },
  { id: 'arc', name: 'Arc', dir: 'Arc/User Data', service: 'Arc Safe Storage' },
  { id: 'comet', name: 'Comet', dir: 'Comet', service: 'Comet Safe Storage' },
  { id: 'chromium', name: 'Chromium', dir: 'Chromium', service: 'Chromium Safe Storage' },
  { id: 'vivaldi', name: 'Vivaldi', dir: 'Vivaldi', service: 'Vivaldi Safe Storage' },
  { id: 'opera', name: 'Opera', dir: 'com.operasoftware.Opera', service: 'Opera Safe Storage' },
]

const support = () => join(homedir(), 'Library', 'Application Support')
const SAFARI = () => join(homedir(), 'Library', 'Containers', 'com.apple.Safari', 'Data', 'Library', 'Cookies', 'Cookies.binarycookies')

export function listProfiles(): Profile[] {
  return [...chromiumProfiles(), ...firefoxProfiles(), ...safariProfile()]
}

function chromiumProfiles(): Profile[] {
  return CHROMIUM.flatMap((b) => {
    const root = join(support(), b.dir)
    if (!existsSync(root)) return []
    const names = profileNames(root)
    return readdirSync(root, { withFileTypes: true }).flatMap((e) => {
      const display = names[e.name] ?? e.name
      const cookiesPath = [join(root, e.name, 'Network', 'Cookies'), join(root, e.name, 'Cookies')].find(existsSync)
      if (!e.isDirectory() || !cookiesPath || display.startsWith('__') || e.name === 'System Profile') return []
      return [{ browser: b.id, browserName: b.name, profile: e.name, profileName: display, cookiesPath }]
    })
  })
}

function profileNames(root: string): Record<string, string> {
  try {
    const state = JSON.parse(readFileSync(join(root, 'Local State'), 'utf8'))
    const cache: Record<string, { name?: string }> = state.profile?.info_cache ?? {}
    return Object.fromEntries(Object.entries(cache).map(([dir, info]) => [dir, info.name ?? dir]))
  } catch {
    return {}
  }
}

function firefoxProfiles(): Profile[] {
  const root = join(support(), 'Firefox', 'Profiles')
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true }).flatMap((e) => {
    const cookiesPath = join(root, e.name, 'cookies.sqlite')
    if (!e.isDirectory() || !existsSync(cookiesPath)) return []
    const profileName = e.name.replace(/^[a-z0-9]+\./i, '')
    return [{ browser: 'firefox', browserName: 'Firefox', profile: profileName, profileName, cookiesPath }]
  })
}

function safariProfile(): Profile[] {
  return existsSync(SAFARI())
    ? [{ browser: 'safari', browserName: 'Safari', profile: 'Default', profileName: 'Default', cookiesPath: SAFARI() }]
    : []
}

// "chrome", "chrome:Profile 1" or "chrome:Work" (the name shown in the browser).
export function findProfile(spec: string): Profile {
  const [browser, which] = spec.split(/:(.*)/s) as [string, string | undefined]
  const candidates = listProfiles().filter((p) => p.browser === browser.toLowerCase())
  if (candidates.length === 0) throw new Error(`No ${browser} profile found on this machine. Run \`rig cookies browsers\`.`)
  if (!which) return candidates.find((p) => p.profile === 'Default') ?? candidates[0]!
  const hit = candidates.find((p) => p.profile === which || p.profileName.toLowerCase() === which.toLowerCase())
  if (!hit) throw new Error(`No ${browser} profile "${which}". Run \`rig cookies browsers\`.`)
  return hit
}

// Opens a private copy of a browser's cookie database (the browser locks the
// live one), and removes the copy afterwards, even on Ctrl-C.
export async function withCopy<T>(p: Profile, read: (db: Database) => T | Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'rig-cookies-'))
  chmodSync(dir, 0o700)
  const forget = onInterrupt(() => rmSync(dir, { recursive: true, force: true }))
  try {
    const copy = join(dir, 'cookies.db')
    for (const suffix of ['', '-wal', '-journal']) {
      if (existsSync(p.cookiesPath + suffix)) copyFileSync(p.cookiesPath + suffix, copy + suffix)
    }
    const db = new Database(copy, { readonly: true })
    try {
      return await read(db)
    } finally {
      db.close()
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
    forget()
  }
}

export type ReadResult = { cookies: Cookie[]; unreadable: number }

export async function readCookies(p: Profile): Promise<ReadResult> {
  if (p.browser === 'safari') return { cookies: readSafariCookies(p.cookiesPath), unreadable: 0 }
  if (p.browser === 'firefox') return withCopy(p, (db) => ({ cookies: readFirefox(db), unreadable: 0 }))
  const key = await keychainKey(p.browser)
  return withCopy(p, (db) => readChromium(db, key))
}

const SAME_SITE = { 0: 'None', 1: 'Lax', 2: 'Strict' } as const

// Database version 24 (Chrome 130+) puts a SHA-256 of the host before each value.
const hashesHost = (db: Database) => {
  const row = db.query("select value from meta where key = 'version'").get() as { value: string } | null
  return Number(row?.value ?? 0) >= 24
}

// Partitioned cookies belong to one embedding site; importing them as ordinary
// cookies would share them everywhere, so they stay behind.
const hasColumn = (db: Database, table: string, column: string) =>
  (db.query(`pragma table_info(${table})`).all() as { name: string }[]).some((c) => c.name === column)

function readChromium(db: Database, key: Buffer): ReadResult {
  const partitioned = hasColumn(db, 'cookies', 'top_frame_site_key') ? "where top_frame_site_key = ''" : ''
  const rows = db.query(`select host_key, name, value, encrypted_value, path, is_secure, is_httponly, expires_utc, samesite from cookies ${partitioned}`).all() as any[]
  const hashed = hashesHost(db)
  let unreadable = 0
  const cookies = rows.flatMap((r) => {
    let value: string = r.value
    if (r.encrypted_value?.length) {
      try {
        value = decrypt(Buffer.from(r.encrypted_value), key, hashed)
      } catch {
        unreadable++ // written with another key, e.g. before a profile migration
        return []
      }
    }
    return [{
      host: r.host_key,
      name: r.name,
      value,
      path: r.path || '/',
      secure: Boolean(r.is_secure),
      httpOnly: Boolean(r.is_httponly),
      sameSite: SAME_SITE[r.samesite as 0 | 1 | 2],
      // microseconds since 1601; 0 means a session cookie
      expires: r.expires_utc ? Number(r.expires_utc) / 1e6 - 11644473600 : undefined,
    }]
  })
  return { cookies, unreadable }
}

// Cookies from a Firefox container (originAttributes set) stay behind, like
// Chrome's partitioned cookies.
function readFirefox(db: Database): Cookie[] {
  const rows = db.query("select host, name, value, path, isSecure, isHttpOnly, expiry, sameSite from moz_cookies where originAttributes = ''").all() as any[]
  return rows.map((r) => ({
    host: r.host,
    name: r.name,
    value: r.value,
    path: r.path || '/',
    secure: Boolean(r.isSecure),
    httpOnly: Boolean(r.isHttpOnly),
    sameSite: SAME_SITE[r.sameSite as 0 | 1 | 2],
    // Firefox 125+ stores milliseconds, older versions seconds
    expires: r.expiry > 1e11 ? r.expiry / 1000 : r.expiry || undefined,
  }))
}

// Reading this password is what shows the macOS "allow access" prompt, so the
// person at the keyboard approves every import. Capped so an unanswered prompt
// cannot hang the command.
async function keychainKey(browser: string): Promise<Buffer> {
  const service = CHROMIUM.find((b) => b.id === browser)?.service
  if (!service) throw new Error(`rig cannot read ${browser} cookies yet.`)
  const proc = Bun.spawn(['security', 'find-generic-password', '-w', '-s', service], { stdout: 'pipe', stderr: 'ignore' })
  const timer = setTimeout(() => proc.kill(), 120_000)
  const password = (await new Response(proc.stdout).text()).trim()
  clearTimeout(timer)
  if ((await proc.exited) !== 0 || !password) {
    throw new Error(`macOS did not allow access to "${service}". Run the command again and click Allow.`)
  }
  return pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1')
}

// AES-128-CBC, IV of 16 spaces, "v10"/"v11" prefix. Throws on a wrong key.
export function decrypt(encrypted: Buffer, key: Buffer, hashedHost: boolean): string {
  const version = encrypted.subarray(0, 3).toString()
  if (version !== 'v10' && version !== 'v11') return encrypted.toString('utf8')
  const decipher = createDecipheriv('aes-128-cbc', key, Buffer.alloc(16, ' '))
  const plain = Buffer.concat([decipher.update(encrypted.subarray(3)), decipher.final()])
  return (hashedHost ? plain.subarray(32) : plain).toString('utf8')
}
