# Command reference

Generated from `rig help <command>` by `bun run docs`. Every command also prints this with `--help`.

## Setup

### rig login

```
rig login
  Stores your E2B API key in the macOS Keychain. It prompts for the key, so the key
  never appears in your shell history. Elsewhere, put RIG_E2B_API_KEY in
  ~/.config/rig/.env (chmod 600).
```

### rig logout

```
rig logout
  Removes the E2B key from the Keychain.
```

### rig image

```
rig image build
  Builds the base box image once: Ubuntu 24.04, an Xfce desktop, Google Chrome, bun,
  node 22, gh, vercel, pnpm and agent-browser. Takes a few minutes. Box size comes
  from RIG_BOX_CPU / RIG_BOX_MEMORY_MB (default 4 CPUs, 8 GB; the free E2B plan allows 2 / 4096).
```

### rig new

```
rig new [--name <name>] [--from <saved desktop>]
  Starts a box that is not tied to a repo, with the desktop and Chrome running —
  for signing in to things and then saving it. It starts from your default saved
  desktop, or from --from.
  Example:  rig new --name logins
```

### rig desktop

```
rig desktop [box] [--local <port>] | rig desktop [box] --stop
  Prints a private link to see and control the box's screen in any browser tab — to
  sign in to sites, or finish a login or 2FA step for an agent. It returns at once:
  a small background helper serves the link, so it keeps working after the terminal
  or agent session closes, and running it again prints the same link.
  The box stays awake while the tab is open and sleeps 15 minutes after you close it.
  Copy and paste: use the clipboard panel on the left edge of the view.
  --stop   close the link now
```

### rig save

```
rig save <box> [--as <name>] [--use] [--force]
  Saves this box as a saved desktop: its files, logins and running Chrome. New boxes
  start as a copy of your default saved desktop.
  rig save <box>              update your default desktop from this box
  rig save <box> --as work    save it as "work" (becomes the default if you have none)
  rig save <box> --as work --use    save it and make it the default
  Save a clean box from `rig new`; a box that ran a repo's code is refused unless you
  add --force. Saving the same name again replaces it with the newer version.
```

### rig saved

```
rig saved | rig saved use <name> | rig saved rm <name> [--force]
  Lists your saved desktops, with * on the default one new boxes start from.
  use   make another saved desktop the default (stored on this machine)
  rm    delete one; the default needs --force
  RIG_DEFAULT_DESKTOP, if set, overrides `rig saved use`.
```

### rig cookies

```
rig cookies push [--site a.com,b.com | --all] [--skip c.com] [--from chrome] [-b box]
rig cookies sites [--from chrome]
rig cookies browsers
  Copies your sign-ins from a browser on this machine into cloud desktops, so they
  are signed in wherever you are. Run it again any time to bring the latest.
  rig cookies push            every site EXCEPT banking and payments (Google, GitHub,
                              email and the rest all go), into your default desktop
  rig cookies push --all      banking and payments too (asks you to confirm)
  rig cookies push --site github.com,linear.app    only those sites
  --skip a.com,b.com   leave more sites out      --from arc:Work   another browser or profile
  -b <box>             one box instead of your default desktop (a box that ran a
                       repo's code needs --force: that code could read the cookies)
  Browsers: Chrome, Edge, Brave, Arc, Comet, Chromium, Vivaldi, Opera, Firefox, Safari.
  `sites` and `browsers` list what is there without reading any cookie value.
  rig prints only site names and counts. For Chrome-family browsers macOS asks you
  to allow access each time: click Allow, not Always Allow.
```

### rig skill

```
rig skill install
  Links rig's Claude Code skill into ~/.claude/skills/rig, so agents use rig for dev
  servers, tests and browser checks instead of running them on your laptop.
```

### rig doctor

```
rig doctor
  Checks the E2B key, that E2B accepts it, the base image, the default desktop and
  your settings, and says how to fix anything missing. Prints no secrets.
```

## Every task

### rig init

```
rig init [--yes] [--copy .env.local] [--dev <cmd>] [--port <n>] [--setup <cmd>]
  Run once in a repo. Works out how it runs — package manager, setup command, dev
  command and port (from package.json and the framework), submodules — and asks
  about gitignored env files like .env.local: the box will not have them unless
  they are copied, and they usually hold secrets. Writes rig.json.
  --yes     accept what was detected; copy only files named with --copy (for agents)
  The first `rig up` in a repo runs this for you when you are at a terminal.
  Examples: rig init
            rig init --yes --copy .env.local
```

### rig up

```
rig up [--new] [--name <name>] [--from <saved desktop>] [--no-dev]
  Run inside a git repo. The first time, it settles the repo's settings (see
  `rig init`). Finds this repo + branch's box (or creates one from the
  default desktop), copies your working tree to it, installs packages if the
  lockfile changed, and starts the dev server. Prints the box id.
  --new     Always make a separate box (for parallel agents on one branch).
  --from    Start a new box from that saved desktop instead of the default.
  --no-dev  Do not start the dev server.
```

### rig sync

```
rig sync [box]
  Sends your local commits, uncommitted edits and untracked files to the box, with no
  push needed. Reinstalls and restarts the dev server only if the lockfile changed.
```

### rig exec

```
rig exec [box] [--timeout <sec>] [--cwd <dir>] -- <command>
  Runs a command in the box's repo folder. Output streams live; rig exits with the
  command's exit code. Default timeout 600s.
  Examples:  rig exec -- bun test src/foo.test.ts
             rig exec -- 'bunx tsc --noEmit && bun run lint'   (one quoted arg = shell line)
```

### rig browser

```
rig browser [box] -- <agent-browser args>
  Drives the box's Chrome, the same one you sign in to on the desktop.
  Examples:  rig browser -- open http://localhost:3000
             rig browser -- snapshot -i
             rig browser -- click @e3
             rig browser -- skills get core --full   (full agent-browser guide)
```

### rig shot

```
rig shot [out.png] [--url <url>] [-b box]
  Screenshots the box's Chrome to a local PNG and prints its path.
  Example:  rig shot --url http://localhost:3000/pricing
```

### rig port

```
rig port <port> [--local <port>] [-b box]
  Serves a box port on this machine at http://localhost:<port> (127.0.0.1 only).
  Stays open until Ctrl-C.
  Example:  rig port 3000
```

### rig logs

```
rig logs [box] [-n <lines>]
  Shows the last lines of the dev server's output (default 80).
```

### rig pull

```
rig pull <path in box> [local path] [-b box]
  Copies one file out of the box.
```

### rig guide

```
rig guide
  Prints the full workflow for agents: the edit → sync → test → check loop, how to
  drive Chrome, and when to hand the desktop to a human.
```

## Computer use

### rig screen

```
rig screen [out.png] [-b box]
  Screenshots the box's whole desktop (1440x900) and prints the saved file's path.
  Use it before clicking: coordinates are pixels in this image.
```

### rig click

```
rig click <x> <y> [--right | --middle] [--double | --triple] [-b box]
  Clicks at a point on the desktop. Take a `rig screen` first to find the point.
  Example:  rig click 640 88
```

### rig type

```
rig type "text" [-b box]
  Types text into whatever has focus on the desktop.
```

### rig key

```
rig key <keys> [-b box]
  Presses keys: Enter, Tab, Escape, ctrl+l, ctrl+shift+t, cmd+a (cmd is the Linux
  super key), F5, Up, PageDown. Several at once: rig key ctrl+a Delete
```

### rig scroll

```
rig scroll <x> <y> [up|down|left|right] [amount] [-b box]
  Moves the mouse to a point and scrolls there (default: down, 3 steps).
```

### rig move

```
rig move <x> <y> [-b box]
  Moves the mouse, for example to show a hover menu.
```

### rig drag

```
rig drag <x0> <y0> <x1> <y1> [-b box]
  Presses at the first point, moves to the second, and releases.
```

### rig zoom

```
rig zoom <x0> <y0> <x1> <y1> [out.png] [-b box]
  Saves an enlarged (2x) close-up of one region of the desktop, for small text.
```

### rig cursor

```
rig cursor [-b box]
  Prints where the mouse is: x y.
```

### rig mcp

```
rig mcp [-b box]
  Runs an MCP server on stdin/stdout so Claude Code, or any MCP client, can use a
  cloud desktop with native tools and see screenshots as images:
    computer   screenshot, click, type, key, scroll, drag, zoom (Claude's computer-use actions)
    browser    agent-browser commands in the signed-in Chrome
    shell      run a command in the box
    boxes      list your cloud desktops
  Add it to Claude Code once:   claude mcp add rig -- rig mcp
  Tools act on the box named in the call, else -b, else this repo + branch's box.
```

## Managing boxes

### rig status

```
rig status
  Shows your default desktop, how many boxes are running and paused, and this
  branch's box when you are in a repo.
```

### rig ls

```
rig ls [filters] [--limit 50] [--ids | --json]
  Lists your boxes, newest first, with state, repo, branch and when each was last used.
  Filters run on E2B's side, so thousands of boxes list quickly.
  Filters:  --state running|paused   --older-than 7d   --repo owner/name   --branch b
            --here (this repo)   --all
  Examples: rig ls --here
            rig ls --state paused --older-than 3d
            rig ls --ids --repo acme/web | xargs rig kill
```

### rig pause

```
rig pause [box…] | rig pause <filters>
  Pauses boxes now. A paused box keeps its memory and costs nothing; any rig command
  wakes it in about a second. Boxes also pause by themselves after RIG_IDLE_MIN
  (default 15) minutes without a rig command.
  Example:  rig pause --all
```

### rig kill

```
rig kill [box…] | rig kill <filters> [--yes]
  Deletes boxes. Cannot be undone. Naming boxes deletes them at once; a filter shows
  what it matches first and only deletes with --yes. Runs 8 at a time with retries.
  Examples: rig kill fix-cart-box
            rig kill --repo acme/web --state paused --yes
```

### rig prune

```
rig prune [--older-than 7d] [--merged] [--yes]
  The cleanup command. Finds paused boxes not used for 7 days (or --older-than), and
  with --merged, boxes of this repo whose branch no longer exists on origin. Shows
  the list first; --yes deletes. Running boxes are only pruned by --merged.
  Example:  rig prune --merged --yes
```

### rig snap

```
rig snap [box]
  Takes a one-off snapshot and prints its id. To keep a box as a starting point for
  new boxes, use `rig save`.
```
