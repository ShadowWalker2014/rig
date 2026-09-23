import { expect, test } from 'bun:test'
import { clean, sanitizer } from '../src/sanitize'

test('keeps text and colours', () => {
  expect(clean('ok \x1b[32mgreen\x1b[0m\n\ttab')).toBe('ok \x1b[32mgreen\x1b[0m\n\ttab')
})

test('drops clipboard writes, title changes, DCS and cursor tricks', () => {
  expect(clean('a\x1b]52;c;ZXZpbA==\x07b')).toBe('ab')
  expect(clean('a\x1b]0;title\x1b\\b')).toBe('ab')
  expect(clean('a\x1bP1000p\x1b\\b')).toBe('ab')
  expect(clean('a\x1b[2Jb\x1b[10;10Hc')).toBe('abc')
  expect(clean('a\u009d52;c;x\x07b')).toBe('ab')
  expect(clean('a\x00\x08b')).toBe('ab')
})

test('catches a sequence split across chunks', () => {
  const s = sanitizer()
  expect(s('safe\x1b') + s(']52;c;ZXZpbA==') + s('\x07done')).toBe('safedone')
})
