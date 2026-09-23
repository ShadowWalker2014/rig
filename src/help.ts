import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// One entry per command: what it does, its usage, and a real example.
export const COMMAND_HELP: Record<string, string> = {
  login: `rig login
  Stores your E2B API key in the macOS Keychain. It prompts for the key, so the key
  never appears in your shell history. Elsewhere, put RIG_E2B_API_KEY in
  ~/.config/rig/.env (chmod 600).`,
  logout: `rig logout
  Removes the E2B key from the Keychain.`,
  image: `rig image build
  Builds the base box image once: Ubuntu 24.04, an Xfce desktop, Google Chrome, bun,
  node 22, gh, vercel, pnpm and agent-browser. Takes a few minutes. Box size comes
  from RIG_BOX_CPU / RIG_BOX_MEMORY_MB (default 4 CPUs, 8 GB; the free E2B plan allows 2 / 4096).`,
  skill: `rig skill install
  Links rig's Claude Code skill into ~/.claude/skills/rig, so agents use rig for dev
  servers, tests and browser checks instead of running them on your laptop.`,
  guide: `rig guide
  Prints the full workflow for agents: the edit → sync → test → check loop, how to
  drive Chrome, and when to hand the desktop to a human.`,
  new: `rig new [--name <name>]
  Starts an empty box with the desktop and Chrome running, for signing in to things.
  Example:  rig new --name logins`,
  up: `rig up [--new] [--name <name>] [--no-dev]
  Run inside a git repo. Finds this repo + branch's box (or creates one from the
  default desktop), copies your working tree to it, installs packages if the
  lockfile changed, and starts the dev server. Prints the box id.
  --new     Always make a separate box (for parallel agents on one branch).
  --no-dev  Do not start the dev server.`,
  sync: `rig sync [box]
  Sends your local commits, uncommitted edits and untracked files to the box, with no
  push needed. Reinstalls and restarts the dev server only if the lockfile changed.`,
  exec: `rig exec [box] [--timeout <sec>] [--cwd <dir>] -- <command>
  Runs a command in the box's repo folder. Output streams live; rig exits with the
  command's exit code. Default timeout 600s.
  Examples:  rig exec -- bun test src/foo.test.ts
             rig exec -- 'bunx tsc --noEmit && bun run lint'   (one quoted arg = shell line)`,
  browser: `rig browser [box] -- <agent-browser args>
  Drives the box's Chrome, the same one you sign in to on the desktop.
  Examples:  rig browser -- open http://localhost:3000
             rig browser -- snapshot -i
             rig browser -- click @e3
             rig browser -- skills get core --full   (full agent-browser guide)`,
  shot: `rig shot [out.png] [--url <url>] [-b box]
  Screenshots the box's Chrome to a local PNG and prints its path.
  Example:  rig shot --url http://localhost:3000/pricing`,
  port: `rig port <port> [--local <port>] [-b box]
  Serves a box port on this machine at http://localhost:<port> (127.0.0.1 only).
  Stays open until Ctrl-C.
  Example:  rig port 3000`,
  desktop: `rig desktop [box] [--local <port>]
  Prints a link to watch and control the box's desktop in any browser tab. Use it to
  sign in to sites, or to finish a login or 2FA step for the agent. Ctrl-C closes it.`,
  logs: `rig logs [box] [-n <lines>]
  Shows the last lines of the dev server's output (default 80).`,
  pull: `rig pull <path in box> [local path] [-b box]
  Copies one file out of the box.`,
  ls: `rig ls [filters] [--limit 50] [--ids | --json]
  Lists your boxes, newest first, with state, repo, branch and when each was last used.
  Filters run on E2B's side, so thousands of boxes list quickly.
  Filters:  --state running|paused   --older-than 7d   --repo owner/name   --branch b
            --here (this repo)   --all
  Examples: rig ls --here
            rig ls --state paused --older-than 3d
            rig ls --ids --repo acme/web | xargs rig kill`,
  pause: `rig pause [box…] | rig pause <filters>
  Pauses boxes now. A paused box keeps its memory and costs nothing; any rig command
  wakes it in about a second. Boxes also pause by themselves after RIG_IDLE_MIN
  (default 15) minutes without a rig command.
  Example:  rig pause --all`,
  kill: `rig kill [box…] | rig kill <filters> [--yes]
  Deletes boxes. Cannot be undone. Naming boxes deletes them at once; a filter shows
  what it matches first and only deletes with --yes. Runs 8 at a time with retries.
  Examples: rig kill fix-cart-box
            rig kill --repo acme/web --state paused --yes`,
  prune: `rig prune [--older-than 7d] [--merged] [--yes]
  The cleanup command. Finds paused boxes not used for 7 days (or --older-than), and
  with --merged, boxes of this repo whose branch no longer exists on origin. Shows
  the list first; --yes deletes. Running boxes are only pruned by --merged.
  Example:  rig prune --merged --yes`,
  cookies: `rig cookies push [--site a.com,b.com | --all] [--skip c.com] [--from chrome] [-b box]
rig cookies sites [--from chrome]
rig cookies browsers
  Copies your sign-ins from a browser on this machine into cloud desktops, so they
  are signed in wherever you are. Run it again any time to bring the latest.
  rig cookies push            every site EXCEPT banking and payments, email, and
                              sign-in and password managers, into your default desktop
  rig cookies push --all      every site, the sensitive ones too (asks you to confirm)
  rig cookies push --site github.com,linear.app    only those sites
  --skip a.com,b.com   leave more sites out      --from arc:Work   another browser or profile
  -b <box>             one box instead of your default desktop (a box that ran a
                       repo's code needs --force: that code could read the cookies)
  Browsers: Chrome, Edge, Brave, Arc, Comet, Chromium, Vivaldi, Opera, Firefox, Safari.
  \`sites\` and \`browsers\` list what is there without reading any cookie value.
  rig prints only site names and counts. For Chrome-family browsers macOS asks you
  to allow access each time: click Allow, not Always Allow.`,
  snaps: `rig snaps | rig snaps rm <snapshot id>… [--force]
  Lists snapshots, or deletes them. Your default desktop needs --force.`,
  save: `rig save <box> [--force]
  Makes this box your default desktop: every new box starts as a copy of it, with
  its files, logins and running Chrome. Use a clean box from \`rig new\`; a box that
  ran a repo's code is refused unless you add --force. Save again any time.`,
  doctor: `rig doctor
  Checks the E2B key, that E2B accepts it, the base image, the default desktop and
  your settings, and says how to fix anything missing. Prints no secrets.`,
  snap: `rig snap [box]
  Saves a snapshot of the box and prints its id. To make a box the one every new
  box starts from, use \`rig save\` instead.`,
}

export function commandHelp(cmd: string): string | undefined {
  return COMMAND_HELP[cmd]
}

// The agent workflow lives in the skill file, so the CLI and the skill never drift.
export function guide(): string {
  const skill = readFileSync(join(import.meta.dir, '..', 'skills', 'rig', 'SKILL.md'), 'utf8')
  return skill.replace(/^---[\s\S]*?---\s*/, '')
}
