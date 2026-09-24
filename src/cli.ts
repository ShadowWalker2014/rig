#!/usr/bin/env bun
import { parseArgs, type Args } from './args'
import * as c from './commands'
import * as m from './manage'
import { cookies } from './cookies/command'
import { init } from './init'
import * as cu from './computer-commands'
import { mcp } from './mcp'
import { commandHelp, guide } from './help'
import { buildImage } from './image'
import { login, logout } from './key'
import { clean } from './sanitize'

const HELP = `rig — open-source cloud desktops for AI agents. Dev servers, tests and a
signed-in Chrome run in a cloud desktop (a "box") that pauses when idle, not on your laptop.

Set up (once)
  rig login                      Store your E2B API key in the macOS Keychain
  rig image build                Build the base image: desktop, Chrome, 1Password, dev CLIs
  rig new                        Start a clean box to sign in to things
  rig desktop <box>              See and control its screen; sign in there
  rig save <box>                 Save it: every new box starts as a copy of it
  rig skill install              Teach Claude Code to use rig
  rig doctor                     Check everything is set up

Saved desktops
  rig saved                      List them; * marks the one new boxes start from
  rig save <box> --as work       Save a box under another name (add --use to make it the default)
  rig saved use work             Make "work" the default
  rig new --from work            Start one box from "work" without changing the default
  rig saved rm work              Delete a saved desktop

Logins from your own browser
  rig cookies push               Every site except banking and payments, into your default desktop
  rig cookies push --site a.com  Only some sites (--skip, --from arc, -b <box>, --all: see rig help cookies)

Every task (inside a git repo)
  rig init                       Once per repo: detect how it runs, choose env files, write rig.json
  rig up [--new] [--from name]   This branch's box: sync code, install, start the dev server
  rig sync                       Send local edits (committed or not) to the box
  rig exec -- <cmd>              Run a command in the box's repo folder
  rig browser -- <args>          Drive the box's signed-in Chrome
  rig shot [out.png] [--url u]   Screenshot the box's Chrome to a local file
  rig port <port>                Open a box port on this machine's localhost
  rig desktop                    See and control the box's screen
  rig logs [-n 80]               The dev server's output
  rig pull <path> [local]        Copy a file out of the box

Computer use (the whole desktop, not just Chrome)
  rig screen [out.png]           Screenshot the whole desktop
  rig click <x> <y>              Click (--right, --middle, --double, --triple)
  rig type "text" · rig key ctrl+l   Type text, press keys
  rig scroll <x> <y> down [3] · rig drag <x0> <y0> <x1> <y1> · rig move <x> <y>
  rig zoom <x0> <y0> <x1> <y1>   Enlarged close-up of one region
  rig mcp                        MCP server: computer, browser and shell tools for Claude Code
                                 (add once: claude mcp add rig -- rig mcp)

Managing boxes
  rig status                     Default desktop, running and paused boxes, this branch's box
  rig ls [filters]               List boxes; --ids or --json for scripts
  rig pause [box…|filters]       Pause now (keeps memory, costs nothing); idle boxes pause after 15 min
  rig kill [box…|filters]        Delete boxes; with filters it previews first, --yes deletes
  rig prune [--merged] [--yes]   Clean up boxes unused for 7 days, and boxes whose branch is gone

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
  init,
  screen: cu.screen,
  zoom: cu.zoom,
  click: cu.click,
  move: cu.move,
  drag: cu.drag,
  scroll: cu.scroll,
  type: cu.type,
  key: cu.key,
  cursor: cu.cursor,
  mcp,
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
  saved: m.saved,
  snaps: m.saved,
  status: () => m.status(),
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
  if (a.cmd === 'up' || a.cmd === 'new') await m.autoPrune()
  const result = await handler(a)
  if (typeof result === 'number') process.exit(result)
}

main().catch((err: Error) => {
  console.error(`rig: ${clean(err.message)}`)
  process.exit(1)
})
