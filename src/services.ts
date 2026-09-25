import type { Sandbox } from 'e2b'
import { DEV_LOG, DEV_PID } from './config'
import type { ProjectConfig } from './project'
import type { Repo } from './repo'
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

// A swap file of up to 4 GB, leaving 8 GB of disk for the repo and its build caches. Without
// it a dev server that outgrows RAM is killed and the agent only sees "connection refused";
// with it, the box slows down instead. A RAM-sized file filled a 16 GB box's disk, so Next's
// cache writes failed. Idempotent, and skipped if the kernel refuses swap.
export const SWAP_SCRIPT = [
  'swapon --show=NAME --noheadings | grep -q . && exit 0',
  "ram=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)",
  "disk=$(df -m --output=avail / | tail -1 | tr -d ' ')",
  'size=$(( ram < 4096 ? ram : 4096 ))',
  'size=$(( size < disk - 8192 ? size : disk - 8192 ))',
  '[ "$size" -ge 1024 ] || exit 0',
  'fallocate -l ${size}M /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile || { rm -f /swapfile; exit 3; }',
].join('\n')

// zswap compresses pages in RAM before they reach the swap file: a dev server's cold heap
// compresses about 2:1, so most swapping never touches the slow disk. E2B's kernel has zswap
// but no zram. Kernel settings, so it runs on every `rig up`, not just when swap is created.
export const ZSWAP_SCRIPT = [
  'z=/sys/module/zswap/parameters',
  '[ -w $z/enabled ] || exit 0',
  'echo 1 > $z/enabled',
  'for c in zstd lz4 lzo; do echo $c > $z/compressor 2>/dev/null && break; done',
  'for p in zsmalloc z3fold zbud; do echo $p > $z/zpool 2>/dev/null && break; done',
  'echo 40 > $z/max_pool_percent',
  'sysctl -q -w vm.swappiness=150 vm.page-cluster=0 vm.watermark_scale_factor=125',
].join('\n')

// The kernel default (65,536 inotify watches, 128 instances) runs out on a large repo: the dev server then
// silently stops seeing new folders, so newly added routes 404 until their files are touched.
export const WATCH_LIMITS_SCRIPT = 'sysctl -q -w fs.inotify.max_user_watches=1048576 fs.inotify.max_user_instances=8192'

export async function ensureSwap(sbx: Sandbox): Promise<void> {
  try {
    await sbx.commands.run(WATCH_LIMITS_SCRIPT, { user: 'root', timeoutMs: 30_000 })
    await sbx.commands.run(SWAP_SCRIPT, { user: 'root', timeoutMs: 60_000 })
    await sbx.commands.run(ZSWAP_SCRIPT, { user: 'root', timeoutMs: 30_000 })
  } catch {
    console.error('Could not add swap to this box, so a dev server that outgrows its memory will be stopped. rig works otherwise.')
  }
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
