import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { Template, defaultBuildLogger } from 'e2b'
import { baseTemplate, boxCpu, boxMemoryMb } from './config'
import { connection } from './key'

// Every npm tool is pinned: this image later holds every login you add to it.
const NPM_TOOLS = [
  'agent-browser@0.38.1',
  'bun@1.4.2',
  'pnpm@12.6.0',
  'vercel@59.26.0',
  'wrangler@4.137.0',
  '@railway/cli@5.62.0',
  '@anthropic-ai/claude-code@2.1.281',
  '@openai/codex@0.156.1',
  'opencode-ai@1.18.32',
  'resend-cli@2.21.1',
  '@e2b/cli@2.20.0',
  'playwright@1.63.0',
  'puppeteer@25.12.0',
]
const FLYCTL_VERSION = '0.4.107'
const UV_VERSION = '0.12.18'

const APT_PACKAGES = [
  // desktop and remote viewing
  'dbus-x11', 'novnc', 'websockify', 'x11-utils', 'x11vnc', 'xdotool', 'xfce4', 'xfce4-terminal', 'xvfb',
  // clipboard: CLI tools that copy codes (gh), and syncing the two X selections
  'xclip', 'xsel', 'autocutsel',
  'fonts-liberation', 'fonts-noto-color-emoji', 'fonts-noto-cjk',
  // everyday dev tools
  'build-essential', 'ca-certificates', 'curl', 'wget', 'git', 'git-lfs', 'gnupg', 'jq', 'ripgrep', 'fd-find',
  'unzip', 'zip', 'rsync', 'file', 'tree', 'tmux', 'vim', 'htop', 'lsof', 'iproute2', 'dnsutils', 'netcat-openbsd',
  'openssh-client', 'procps', 'sqlite3', 'postgresql-client', 'redis-tools',
  // python, media and captions
  'python3', 'python3-pip', 'python3-venv', 'python-is-python3', 'pipx', 'ffmpeg', 'imagemagick',
  'python3-pil', 'python3-fonttools', 'python3-brotli',
]

// Chrome, Node 24, gh, Google Cloud and Stripe come from their vendors' signed apt repos.
const SIGNED_REPOS: [string, string, string][] = [
  ['https://dl.google.com/linux/linux_signing_key.pub', 'google-chrome', 'deb [arch=amd64 signed-by=KEY] https://dl.google.com/linux/chrome/deb/ stable main'],
  ['https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key', 'nodesource', 'deb [signed-by=KEY] https://deb.nodesource.com/node_24.x nodistro main'],
  ['https://cli.github.com/packages/githubcli-archive-keyring.gpg', 'github-cli', 'deb [signed-by=KEY] https://cli.github.com/packages stable main'],
  ['https://packages.cloud.google.com/apt/doc/apt-key.gpg', 'google-cloud', 'deb [signed-by=KEY] https://packages.cloud.google.com/apt cloud-sdk main'],
  ['https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public', 'stripe', 'deb [signed-by=KEY] https://packages.stripe.dev/stripe-cli-debian-local stable main'],
]

const addRepo = ([keyUrl, name, line]: [string, string, string]) => [
  `curl -fsSL ${keyUrl} | gpg --dearmor -o /usr/share/keyrings/${name}.gpg`,
  `echo "${line.replace('KEY', `/usr/share/keyrings/${name}.gpg`)}" > /etc/apt/sources.list.d/${name}.list`,
]

// Your own additions (private CLIs, company tools) go in ~/.config/rig/image.sh,
// which runs as root at the end of every build. It never enters the repo.
const EXTRAS = join(homedir(), '.config', 'rig', 'image.sh')

function image(context: string, withExtras: boolean) {
  const t = Template({ fileContextPath: context })
    .fromUbuntuImage('24.04')
    .setUser('root')
    .aptInstall(APT_PACKAGES)
    .runCmd([...SIGNED_REPOS.flatMap(addRepo), 'apt-get update && apt-get install -y google-chrome-stable nodejs gh google-cloud-cli stripe'])
    .runCmd([
      'curl -fsSL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/aws.zip && unzip -q /tmp/aws.zip -d /tmp && /tmp/aws/install && rm -rf /tmp/aws /tmp/aws.zip',
      `curl -fsSL https://github.com/superfly/flyctl/releases/download/v${FLYCTL_VERSION}/flyctl_${FLYCTL_VERSION}_Linux_x86_64.tar.gz | tar -xz -C /usr/local/bin flyctl && ln -sf flyctl /usr/local/bin/fly`,
      `curl -fsSL https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-x86_64-unknown-linux-gnu.tar.gz | tar -xz --strip-components=1 -C /usr/local/bin`,
      'ln -sf /usr/bin/python3 /usr/local/bin/py && ln -sf /usr/bin/fdfind /usr/local/bin/fd',
    ])
    // Puppeteer drives the system Chrome, so it skips its own browser download.
    .runCmd(`PUPPETEER_SKIP_DOWNLOAD=true npm install -g ${NPM_TOOLS.join(' ')}`)
    // Playwright's own Chromium, shared by every user. Puppeteer uses the system Chrome.
    .runCmd('PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright playwright install --with-deps chromium && chmod -R a+rX /opt/ms-playwright')
    // Whisper for captions, with CPU-only torch so the image stays small.
    .runCmd('UV_TOOL_DIR=/opt/uv-tools UV_TOOL_BIN_DIR=/usr/local/bin uv tool install openai-whisper --index https://download.pytorch.org/whl/cpu --index-strategy unsafe-best-match')
    .copy(['rig-desktop', 'rig-vnc', 'rig-ab', 'rig-1password', 'rig-open', 'rig-open-setup', 'rig-no-keyring'], '/usr/local/bin/', { mode: 0o755 })
    // 1Password: the CLI from its signed apt repo, and the Chrome extension via Chrome policy.
    .runCmd('/usr/local/bin/rig-1password && rm -rf /var/lib/apt/lists/*')
    .copy('rig-profile.sh', '/etc/profile.d/rig.sh', { mode: 0o644 })
    // Every "open this link" (gh, vercel, Xfce) goes to the one signed-in Chrome.
    .runCmd('/usr/local/bin/rig-open-setup')
    // No locked desktop keyring: CLI logins go in their own config files instead.
    .runCmd('/usr/local/bin/rig-no-keyring')
    .runCmd(['git lfs install --system', 'rm -rf /var/lib/apt/lists/* /root/.npm /root/.cache'])
    // Homebrew installs as a normal user into /home/linuxbrew.
    .runCmd('mkdir -p /home/linuxbrew && chown -R user:user /home/linuxbrew')
    .setUser('user')
    .runCmd('NONINTERACTIVE=1 bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"')
  const withUserExtras = withExtras
    ? t.setUser('root').copy('image.sh', '/tmp/rig-extras.sh').runCmd('bash /tmp/rig-extras.sh && rm /tmp/rig-extras.sh').setUser('user')
    : t
  return withUserExtras
    .setWorkdir('/home/user')
    .runCmd('mkdir -p ~/work ~/.config/rig-chrome && git config --global init.defaultBranch main')
}

// The build context is a temporary copy, so your extras never land in rig's folder.
export async function buildImage(): Promise<void> {
  const context = mkdtempSync(join(tmpdir(), 'rig-image-'))
  cpSync(join(import.meta.dir, '..', 'image'), context, { recursive: true })
  const withExtras = existsSync(EXTRAS)
  if (withExtras) {
    console.error(`Adding your extras from ${EXTRAS}`)
    cpSync(EXTRAS, join(context, 'image.sh'))
  }
  try {
    await Template.build(image(context, withExtras), baseTemplate(), {
      ...connection(),
      cpuCount: boxCpu(),
      memoryMB: boxMemoryMb(),
      onBuildLogs: defaultBuildLogger(),
    })
  } finally {
    rmSync(context, { recursive: true, force: true })
  }
}
