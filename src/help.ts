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
  golden snapshot), copies your working tree to it, installs packages if the
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
  ls: `rig ls [--json]
  Lists your boxes: id, name, running or paused, branch, size, age.`,
  pause: `rig pause [box]
  Pauses a box now. It keeps its memory and costs nothing; any rig command wakes it.
  Boxes also pause by themselves after 15 idle minutes.`,
  kill: `rig kill [box]   |   rig kill --all --yes
  Deletes a box, or every rig box. Cannot be undone.`,
  snap: `rig snap [box] [--promote [--force]]
  Saves a snapshot of the box. With --promote it becomes the golden snapshot: every
  new box starts with its files and logins. Promote a clean box made with \`rig new\`;
  a box that ran a repo's code is refused unless you add --force.`,
}

export function commandHelp(cmd: string): string | undefined {
  return COMMAND_HELP[cmd]
}

// The agent workflow lives in the skill file, so the CLI and the skill never drift.
export function guide(): string {
  const skill = readFileSync(join(import.meta.dir, '..', 'skills', 'rig', 'SKILL.md'), 'utf8')
  return skill.replace(/^---[\s\S]*?---\s*/, '')
}
