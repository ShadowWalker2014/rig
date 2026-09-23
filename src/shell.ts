import { CommandExitError, type Sandbox } from 'e2b'
import { sanitizer } from './sanitize'

export const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

type RunOpts = { cwd?: string; timeoutMs?: number; stream?: boolean }

// Runs a bash command in the box and returns stdout. A non-zero exit throws
// with the command's own stderr, so callers never swallow a failure.
export async function sh(sbx: Sandbox, cmd: string, opts: RunOpts = {}): Promise<string> {
  const toTerminal = sanitizer()
  const echo = opts.stream ? (d: string) => void process.stderr.write(toTerminal(d)) : undefined
  try {
    const res = await sbx.commands.run(cmd, { cwd: opts.cwd, timeoutMs: opts.timeoutMs ?? 120_000, onStdout: echo, onStderr: echo })
    return res.stdout.trim()
  } catch (err) {
    if (err instanceof CommandExitError) {
      throw new Error(`Box command failed (exit ${err.exitCode}): ${cmd}\n${err.stderr || err.stdout}`.trim())
    }
    throw err
  }
}

// Same, but a non-zero exit is an answer, not an error.
export async function test(sbx: Sandbox, cmd: string, cwd?: string): Promise<boolean> {
  try {
    await sbx.commands.run(cmd, { cwd, timeoutMs: 60_000 })
    return true
  } catch (err) {
    if (err instanceof CommandExitError) return false
    throw err
  }
}
