import type { Sandbox } from 'e2b'
import { DEV_LOG, DEV_PID } from './config'
import type { ProjectConfig, Repo } from './repo'
import { clean } from './sanitize'
import { q, sh, test } from './shell'

// setsid makes the dev server its own process group, so a restart kills the
// whole tree (bun → next → workers), not just the shell that launched it.
export async function startDev(sbx: Sandbox, repo: Repo, cfg: ProjectConfig): Promise<void> {
  if (!cfg.dev) return
  await stopDev(sbx)
  const launch = `setsid nohup bash -lc ${q(cfg.dev)} > ${DEV_LOG} 2>&1 < /dev/null & echo $! > ${DEV_PID}`
  await sh(sbx, launch, { cwd: repo.boxDir })
  console.error(`Dev server starting: ${clean(cfg.dev)} (port ${cfg.port})`)
  await waitForPort(sbx, cfg.port)
}

export async function stopDev(sbx: Sandbox): Promise<void> {
  await sh(sbx, `[ -f ${DEV_PID} ] && kill -- -$(cat ${DEV_PID}) 2>/dev/null; rm -f ${DEV_PID}; true`)
}

export async function devRunning(sbx: Sandbox): Promise<boolean> {
  return test(sbx, `[ -f ${DEV_PID} ] && kill -0 $(cat ${DEV_PID})`)
}

async function waitForPort(sbx: Sandbox, port: number): Promise<void> {
  const probe = `for i in $(seq 300); do ss -ltn | grep -q ':${port} ' && exit 0; kill -0 $(cat ${DEV_PID}) 2>/dev/null || exit 2; sleep 1; done; exit 1`
  if (await test(sbx, probe)) return
  const tail = await sh(sbx, `tail -n 40 ${DEV_LOG} 2>/dev/null || true`)
  throw new Error(`Dev server did not open port ${port}. Last log lines:\n${tail}`)
}

// Desktop, Chrome (with the logged-in profile) and CDP on :9222. Idempotent.
export async function ensureDesktop(sbx: Sandbox): Promise<void> {
  await sh(sbx, 'rig-desktop', { timeoutMs: 90_000 })
}

// noVNC on :6080, gated by a one-time password on top of the box's traffic token.
export async function startViewer(sbx: Sandbox): Promise<string> {
  await ensureDesktop(sbx)
  const password = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  await sbx.files.write('/tmp/rig-vnc-pass', password)
  await sh(sbx, 'chmod 600 /tmp/rig-vnc-pass && rig-vnc', { timeoutMs: 60_000 })
  return password
}

// A saved default desktop must not carry a live viewer or its password into every box.
export async function stopViewer(sbx: Sandbox): Promise<void> {
  await sh(sbx, 'pkill -x x11vnc; pkill -f "[w]ebsockify.*6080"; rm -f /tmp/rig-vnc-pass; true')
}
