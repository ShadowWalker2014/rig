import { setting } from './key'

// Names on the E2B side. The default desktop is a named snapshot: every
// `rig save` adds a new build to it, and new boxes start from the latest.
export const baseTemplate = () => setting('RIG_BASE_TEMPLATE') ?? 'rig-base'
export const defaultDesktop = () => setting('RIG_DEFAULT_DESKTOP') ?? setting('RIG_GOLDEN') ?? 'rig-default'

// A box pauses after this long without a rig command, keeping its RAM.
export const idleMs = () => Number(setting('RIG_IDLE_MIN') ?? 15) * 60_000

// Box size is fixed when the image is built. E2B's free Hobby plan allows 2 CPUs / 4 GB.
export const boxCpu = () => Number(setting('RIG_BOX_CPU') ?? 4)
export const boxMemoryMb = () => Number(setting('RIG_BOX_MEMORY_MB') ?? 8192)

// Every box rig creates carries this tag, so `rig ls` never shows other sandboxes.
export const OWNER_TAG = { rig: '1' }

export const HOME = '/home/user'
export const WORK_DIR = `${HOME}/work`
export const DEV_LOG = '/tmp/rig-dev.log'
export const DEV_PID = '/tmp/rig-dev.pid'
export const DISPLAY = ':0'
export const CDP_PORT = 9222
export const NOVNC_PORT = 6080
