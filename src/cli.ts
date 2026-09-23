#!/usr/bin/env bun
import { parseArgs, type Args } from './args'
import * as c from './commands'
import { commandHelp, guide } from './help'
import { buildImage } from './image'
import { login, logout } from './key'
import { clean } from './sanitize'

const HELP = `rig — cloud dev boxes your local agent drives. Dev servers, tests and Chrome
run in a paused-when-idle E2B box instead of on your laptop.

Setup (once)
  rig login                      Store your E2B API key in the macOS Keychain
  rig image build                Build the base box image (desktop, Chrome, bun, node, gh)
  rig new                        Start an empty box to sign in to things
  rig desktop <box>              Open the box's desktop; sign in to sites and CLIs there
  rig snap <box> --promote       Save that box as the golden snapshot for every new box
  rig skill install              Teach Claude Code agents to use rig

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

Boxes
  rig ls [--json]                List your boxes
  rig pause | kill [box]         Pause (keeps RAM, costs nothing) or delete a box
  rig kill --all --yes           Delete every rig box

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
  ls: c.ls,
  pause: c.pause,
  kill: c.kill,
  snap: c.snap,
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
