import { join } from 'node:path'
import { Template, defaultBuildLogger } from 'e2b'
import { baseTemplate, boxCpu, boxMemoryMb } from './config'
import { connection } from './key'

const PINNED_TOOLS = ['agent-browser@0.38.1', 'bun@1.2.21', 'vercel@59.26.0', 'pnpm@12.6.0']

// The base image: a desktop, Chrome and the usual dev CLIs, with no logins.
// Logins are added later in a running box and saved with `rig snap --promote`.
export const image = Template({ fileContextPath: join(import.meta.dir, '..', 'image') })
  .fromUbuntuImage('24.04')
  .setUser('root')
  .aptInstall([
    'build-essential', 'ca-certificates', 'curl', 'dbus-x11', 'fonts-liberation', 'fonts-noto-color-emoji',
    'git', 'gnupg', 'iproute2', 'jq', 'novnc', 'procps', 'python3', 'unzip', 'websockify', 'x11-utils',
    'x11vnc', 'xdotool', 'xfce4', 'xfce4-terminal', 'xvfb',
  ])
  // Chrome, Node and gh come from their vendors' signed apt repos, and every
  // npm tool is pinned: this image later holds every login you add to it.
  .runCmd([
    'curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg',
    'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list',
    'curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /usr/share/keyrings/nodesource.gpg',
    'echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list',
    'curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /usr/share/keyrings/githubcli-archive-keyring.gpg',
    'echo "deb [signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list',
    'apt-get update && apt-get install -y google-chrome-stable nodejs gh',
    'rm -rf /var/lib/apt/lists/*',
  ])
  .npmInstall(PINNED_TOOLS, { g: true })
  .copy(['rig-desktop', 'rig-vnc', 'rig-ab'], '/usr/local/bin/', { mode: 0o755 })
  .setUser('user')
  .setWorkdir('/home/user')
  .runCmd('mkdir -p ~/work ~/.config/rig-chrome && git config --global init.defaultBranch main')

export async function buildImage(): Promise<void> {
  await Template.build(image, baseTemplate(), {
    ...connection(),
    cpuCount: boxCpu(),
    memoryMB: boxMemoryMb(),
    onBuildLogs: defaultBuildLogger(),
  })
}
