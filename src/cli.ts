#!/usr/bin/env bun
import { parseArgs, type Args } from './args'
import * as c from './commands'
import * as m from './manage'
import { cookies } from './cookies/command'
import { commandHelp, guide } from './help'
import { buildImage } from './image'
import { login, logout } from './key'
import { clean } from './sanitize'

const HELP = `rig — open-source cloud desktops for AI agents. Dev servers, tests and a
signed-in Chrome run in a cloud desktop (a "box") that pauses when idle, not on your laptop.

Setup (once)
  rig login                      Store your E2B API key in the macOS Keychain
  rig image build                Build the base box image (desktop, Chrome, bun, node, gh)
  rig new                        Start an empty box to sign in to things
  rig desktop <box>              Open the box's desktop; sign in to sites and CLIs there
  rig save <box>                 Make that box your default desktop: every new box starts from it
  rig skill install              Teach Claude Code agents to use rig
  rig cookies push --from chrome --site github.com --default
                                 Bring logins from your own browser into cloud desktops

Every task (run inside a git repo)
  rig up [--new] [--name n]      Box for this repo + branch: sync code, install, start dev server
  rig sync                       Push local edits (committed or not) to the box
  rig exec -- <cmd>              Run a command in the box's repo folder (streams output)
  rig browser -- <args>          Drive the box's logged-in Chrome with agent-browser
  rig shot [out.png] [--url u]   Screenshot the box's Chrome to a local file
  rig port <port> [--local n]    Serve a box port on this machine's localhost
  rig desktop                    Watch or take over the box's desktop
  rig logs [-n 80]               Tail the dev server log
  rig pull <path> [local]        Copy a file out of the box

Boxes (any number of them)
  rig ls [filters] [--limit 50]  List boxes, newest first; --ids or --json for scripts
  rig pause [box…|filters]       Pause now (keeps memory, costs nothing); boxes also pause after 15 idle min
  rig kill [box…|filters]        Delete boxes; with filters it previews first, --yes deletes
  rig prune [--older-than 7d] [--merged] [--yes]
                                 Clean up: paused boxes unused for 7 days, and boxes whose branch is gone
  rig snaps [rm <id>…]           List or delete snapshots
  rig doctor                     Check your key, image, default desktop and settings

Filters: --state running|paused  --older-than 7d  --repo owner/name  --branch b  --here  --all

Commands act on this repo + branch's box unless you name one with -b <id|name>.

rig help <command>   Details and examples for one command
rig guide            The full workflow for coding agents`

type Handler = (a: Args) => Promise<unknown> | unknown

const COMMANDS: Record<string, Handler> = {
  login: () => login(),
  logout: () => logout(),
  image: (a) => (a.sub[0] === 'build' ? buildImage() : fail('Usage: rig image build')),
  skill: (a) => (a.sub[0] === 'install' ? c.installSkill() : fail('Usage: rig skill install')),
  help: (a) => console.log((a.sub[0] && commandHelp(a.sub[0])) ?? HELP),
  guide: () => console.log(guide()),
  new: c.newBox,
  up: c.up,
  sync: c.sync,
  exec: c.exec,
  browser: c.browser,
  shot: c.shot,
  port: c.port,
  desktop: c.desktop,
  logs: c.logs,
  pull: c.pull,
  ls: m.ls,
  pause: m.pause,
  kill: m.kill,
  prune: m.prune,
  cookies,
  snaps: m.snaps,
  doctor: () => m.doctor(),
  snap: c.snap,
  save: c.save,
}

function fail(msg: string): never {
  throw new Error(msg)
}

async function main(): Promise<void> {
  const a = parseArgs(process.argv.slice(2))
  const handler = COMMANDS[a.cmd]
  if (!handler) return void console.log(HELP)
  if (a.flags.help) return void console.log(commandHelp(a.cmd) ?? HELP)
  const result = await handler(a)
  if (typeof result === 'number') process.exit(result)
}

main().catch((err: Error) => {
  console.error(`rig: ${clean(err.message)}`)
  process.exit(1)
})
