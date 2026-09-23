import { expect, test } from 'bun:test'
import { createCipheriv, pbkdf2Sync } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { toCdp } from '../src/cookies/push'
import { decrypt, type Cookie } from '../src/cookies/read'
import { readSafariCookies } from '../src/cookies/safari'
import { chooseCookies, registrable, sensitiveCategory } from '../src/cookies/sites'

const key = pbkdf2Sync('peanuts', 'saltysalt', 1003, 16, 'sha1')
const encrypt = (plain: Buffer) => {
  const c = createCipheriv('aes-128-cbc', key, Buffer.alloc(16, ' '))
  return Buffer.concat([Buffer.from('v10'), c.update(plain), c.final()])
}

test('decrypts Chromium values, before and after the Chrome 130+ host hash', () => {
  expect(decrypt(encrypt(Buffer.from('session=abc')), key, false)).toBe('session=abc')
  const hash = new Bun.CryptoHasher('sha256').update('.github.com').digest()
  expect(decrypt(encrypt(Buffer.concat([hash, Buffer.from('token123')])), key, true)).toBe('token123')
  // a value with non-ASCII text is never cut on an older database
  expect(decrypt(encrypt(Buffer.from('é'.repeat(40))), key, false)).toBe('é'.repeat(40))
})

test('a row written with another key is refused, not garbled', () => {
  const other = pbkdf2Sync('other', 'saltysalt', 1003, 16, 'sha1')
  const c = createCipheriv('aes-128-cbc', other, Buffer.alloc(16, ' '))
  const foreign = Buffer.concat([Buffer.from('v10'), c.update(Buffer.from('x'.repeat(20))), c.final()])
  expect(() => decrypt(foreign, key, false)).toThrow()
})

const cookie = (host: string, extra: Partial<Cookie> = {}): Cookie => ({
  host, name: 'n', value: 'v', path: '/', secure: true, httpOnly: true, ...extra,
})

test('by default every site goes except banking, email and sign-in', () => {
  const all = [cookie('.linear.app'), cookie('.github.com'), cookie('.chase.com'), cookie('.chase.co.uk'), cookie('.stripe.com'),
    cookie('.brex.com'), cookie('mail.google.com'), cookie('accounts.google.com'), cookie('.google.com')]
  const pick = (choice: Partial<{ sites: string[]; skip: string[]; all: boolean }>) =>
    chooseCookies(all, { sites: [], skip: [], all: false, ...choice }).map((c) => c.host)
  expect(pick({})).toEqual(['.linear.app', '.github.com', '.google.com'])
  expect(pick({ skip: ['github.com'] })).toEqual(['.linear.app', '.google.com'])
  expect(pick({ all: true })).toHaveLength(all.length)
  // naming a site is consent, even for a sensitive one
  expect(pick({ sites: ['stripe.com'] })).toEqual(['.stripe.com'])
  expect(pick({ sites: ['mail.google.com'] })).toEqual(['mail.google.com'])
  expect(sensitiveCategory('.chase.co.uk')).toBe('banking and payments')
  expect(sensitiveCategory('mail.google.com')).toBe('email')
  expect(sensitiveCategory('accounts.google.com')).toBe('sign-in and passwords')
})

test('expired and empty cookies are never sent', () => {
  const list = [cookie('.a.com', { expires: 1 }), cookie('.b.com', { value: '' }), cookie('.c.com')]
  expect(chooseCookies(list, { sites: [], skip: [], all: false }).map((c) => c.host)).toEqual(['.c.com'])
})

test('groups hosts by site', () => {
  expect(registrable('.www.github.com')).toBe('github.com')
  expect(registrable('shop.example.co.uk')).toBe('example.co.uk')
  // shared hosting suffixes: each user's site is its own site
  expect(registrable('alice.github.io')).toBe('alice.github.io')
  expect(registrable('my-app.vercel.app')).toBe('my-app.vercel.app')
})

test('host-only cookies stay host-only in Chrome', () => {
  expect(toCdp(cookie('app.example.com', { path: '/x' }))).toMatchObject({ url: 'https://app.example.com/x' })
  expect(toCdp(cookie('.example.com'))).toMatchObject({ domain: '.example.com' })
  expect(toCdp(cookie('.a.com', { sameSite: 'None', secure: false })).sameSite).toBeUndefined()
})

test('reads Safari binarycookies', () => {
  const s = (t: string) => Buffer.from(`${t}\0`)
  const [host, name, path, value] = [s('.github.com'), s('user_session'), s('/'), s('xyz')]
  const head = Buffer.alloc(56)
  let off = 56
  const at = (b: Buffer) => { const o = off; off += b.length; return o }
  head.writeUInt32LE(56 + host.length + name.length + path.length + value.length, 0)
  head.writeUInt32LE(5, 8) // secure + httpOnly
  head.writeUInt32LE(at(host), 16); head.writeUInt32LE(at(name), 20); head.writeUInt32LE(at(path), 24); head.writeUInt32LE(at(value), 28)
  head.writeDoubleLE(1e9, 40)
  const record = Buffer.concat([head, host, name, path, value])
  const pageHead = Buffer.alloc(12)
  pageHead.writeUInt32BE(0x100, 0); pageHead.writeUInt32LE(1, 4); pageHead.writeUInt32LE(12, 8)
  const page = Buffer.concat([pageHead, record])
  const file = Buffer.alloc(12)
  file.write('cook', 0); file.writeUInt32BE(1, 4); file.writeUInt32BE(page.length, 8)
  const path_ = join(mkdtempSync(join(tmpdir(), 'rig-safari-')), 'Cookies.binarycookies')
  writeFileSync(path_, Buffer.concat([file, page]))
  const [c] = readSafariCookies(path_)
  expect(c).toMatchObject({ host: '.github.com', name: 'user_session', value: 'xyz', path: '/', secure: true, httpOnly: true })
  expect(Math.round(c!.expires!)).toBe(1e9 + 978_307_200)
})
