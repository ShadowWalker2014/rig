import { expect, test } from 'bun:test'
import { isValidName, nameOf, templateOf } from '../src/saved'

test('a saved desktop "work" is the E2B snapshot "rig-work"', () => {
  expect(templateOf('work')).toBe('rig-work')
  expect(templateOf('rig-work')).toBe('rig-work')
  expect(nameOf('kai-a03c/rig-work:default')).toBe('work')
  expect(nameOf('rig-default')).toBe('default')
})

test('names are short, lowercase and safe', () => {
  expect(isValidName('work')).toBe(true)
  expect(isValidName('client-a-2')).toBe(true)
  for (const bad of ['Work', 'a b', '../x', '-x', '', 'base', 'x'.repeat(50)]) expect(isValidName(bad)).toBe(false)
})
