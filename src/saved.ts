import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { setting } from './key'

// A saved desktop named "work" is the E2B snapshot "rig-work". Which one new boxes
// start from is kept on this machine, like `kubectl config use-context`.
const STATE = join(homedir(), '.config', 'rig', 'state.json')
const PREFIX = 'rig-'

export const templateOf = (name: string) => (name.startsWith(PREFIX) ? name : `${PREFIX}${name}`)
export const nameOf = (template: string) => template.split('/').pop()!.split(':')[0]!.replace(/^rig-/, '')

export function isValidName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,40}$/.test(name) && name !== 'base'
}

type State = { default?: string }

function readState(): State {
  try {
    return existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {}
  } catch {
    return {}
  }
}

// RIG_DEFAULT_DESKTOP (shell or ~/.config/rig/.env) wins; otherwise `rig saved use`.
export function defaultName(): string {
  const pinned = setting('RIG_DEFAULT_DESKTOP') ?? setting('RIG_GOLDEN')
  return nameOf(pinned ?? readState().default ?? 'default')
}

export const pinnedBySetting = () => Boolean(setting('RIG_DEFAULT_DESKTOP') ?? setting('RIG_GOLDEN'))

export function setDefaultName(name: string): void {
  mkdirSync(dirname(STATE), { recursive: true })
  chmodSync(dirname(STATE), 0o700)
  const tmp = `${STATE}.tmp`
  writeFileSync(tmp, JSON.stringify({ ...readState(), default: name }, null, 2))
  renameSync(tmp, STATE)
}
