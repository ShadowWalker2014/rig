import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const KEYCHAIN_SERVICE = 'rig-e2b-api-key'
const ACCOUNT = process.env.USER ?? 'rig'
export const CONFIG_FILE = join(homedir(), '.config', 'rig', '.env')

// The E2B SDK falls back to E2B_* variables for its key and API address. Dropping
// them means rig can only ever talk to the account the user configured for rig.
for (const k of Object.keys(process.env)) if (k.startsWith('E2B_')) delete process.env[k]

let fileSettings: Record<string, string> | undefined

// Settings come from the shell, then ~/.config/rig/.env — never the current repo.
export function setting(name: string): string | undefined {
  return process.env[name] || readConfigFile()[name] || undefined
}

function readConfigFile(): Record<string, string> {
  if (fileSettings) return fileSettings
  fileSettings = {}
  if (!existsSync(CONFIG_FILE)) return fileSettings
  if ((statSync(CONFIG_FILE).mode & 0o077) !== 0) {
    throw new Error(`${CONFIG_FILE} is readable by other users. Run: chmod 600 ${CONFIG_FILE}`)
  }
  for (const line of readFileSync(CONFIG_FILE, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && m[2]) fileSettings[m[1]!] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return fileSettings
}

// Everything the SDK needs to reach the user's own E2B account.
export function connection(): { apiKey: string; domain: string } {
  return { apiKey: apiKey(), domain: setting('RIG_E2B_DOMAIN') ?? 'e2b.app' }
}

function apiKey(): string {
  const key = setting('RIG_E2B_API_KEY') ?? readKeychain()
  if (key) return key
  throw new Error(`No E2B API key. Run \`rig login\` (macOS), or put RIG_E2B_API_KEY in ${CONFIG_FILE} (see .env.example).`)
}

function readKeychain(): string | undefined {
  if (process.platform !== 'darwin') return undefined
  const res = Bun.spawnSync(['security', 'find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', ACCOUNT, '-w'])
  if (res.exitCode !== 0) return undefined
  return res.stdout.toString().trim() || undefined
}

// `-w` as the last argument makes `security` prompt for the value itself,
// so the key never appears in argv or shell history.
export function login(): void {
  if (process.platform !== 'darwin') throw new Error(`\`rig login\` uses the macOS Keychain. Elsewhere, put RIG_E2B_API_KEY in ${CONFIG_FILE}.`)
  console.log('Paste your E2B API key (input is hidden), then paste it again when asked to retype it.')
  const res = Bun.spawnSync(['security', 'add-generic-password', '-U', '-s', KEYCHAIN_SERVICE, '-a', ACCOUNT, '-w'], {
    stdio: ['inherit', 'inherit', 'inherit'],
  })
  if (res.exitCode !== 0) throw new Error('Keychain refused to store the key.')
  console.log('Stored in the macOS Keychain as', KEYCHAIN_SERVICE)
}

export function logout(): void {
  Bun.spawnSync(['security', 'delete-generic-password', '-s', KEYCHAIN_SERVICE, '-a', ACCOUNT])
  console.log('Removed the E2B key from the Keychain.')
}
