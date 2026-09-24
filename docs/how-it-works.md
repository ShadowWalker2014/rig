# How rig works

rig gives AI agents cloud desktops. Each one is an E2B sandbox with a Linux desktop, called a **box** in the CLI. rig itself is a small Bun CLI on your laptop that talks to E2B's API with your key; it never runs a server of its own.

## A box's life

| Moment | What happens |
|---|---|
| `rig up` in a repo | rig looks for a box tagged with this repo and branch. If there is none, it creates one from your default desktop (or from the base image if you have not saved one yet). |
| Every rig command | Connecting wakes a paused box and pushes its idle deadline 15 minutes out (`RIG_IDLE_MIN`). A long command gets its own deadline plus 15 minutes. |
| 15 minutes without a rig command | E2B pauses the box with its memory kept. The dev server, Chrome and your open tabs are frozen, not stopped. |
| A request to a paused box | E2B wakes it (auto-resume), in about a second. |
| A `rig desktop` tab open | A background helper renews the deadline every minute while a viewer is connected, so the box never sleeps under you. It stops when you close the tab, and exits after 30 minutes without a viewer. |
| `rig port` running | rig renews the deadline every minute while the command runs. |
| `rig kill` or `rig prune` | The box is deleted. |

E2B counts only API calls as activity, not traffic, which is why rig renews the deadline itself while you use a box. A paused box costs nothing. A running 4 CPU / 8 GB box costs about $0.33 an hour on E2B.

## Syncing code without a push

`rig sync` (and `rig up`) makes the box's checkout match your working tree:

1. If the box has no clone yet, it clones `origin` using the box's own `gh` login.
2. Commits the box cannot fetch (unpushed ones) travel as a git bundle.
3. The box checks out your exact commit and removes stray files (`git checkout -f`, `git clean -fd`). Ignored folders like `node_modules` stay.
4. Your uncommitted changes travel as a binary patch; untracked files are uploaded.
5. Files listed in `rig.json` → `copy` (like `.env.local`) are uploaded.
6. If the lockfile changed since the last install, the setup command runs (`bun install` by default).

The dev server keeps running and hot-reloads the changed files.

## Saved desktops and the default

`rig save <box> [--as name]` saves a box — disk and memory — as a named E2B snapshot (`rig-<name>`, `rig-default` by default). Which saved desktop new boxes start from is kept in `~/.config/rig/state.json` (`rig saved use <name>`), unless `RIG_DEFAULT_DESKTOP` is set. Each save adds a new build to that template, and every new box starts from the latest one. That is how new boxes start signed in to GitHub, Vercel and your browser accounts, with the desktop and Chrome already running.

Save a clean box made with `rig new`. rig refuses to save a box that ran a repo's code, because that code could have planted something that would then copy into every future box.

## Reaching a box

A box's ports are private: E2B only forwards a request that carries the box's access token. rig gets that token when it connects and keeps it in memory.

- `rig port 3000` runs a small proxy on `127.0.0.1:3000` of your laptop. It adds the token and forwards to the box. The dev server sees `Host: localhost:3000`, so it behaves exactly as it would on your laptop.
- `rig desktop` does the same for the box's screen (noVNC on port 6080), plus a one-time password.
- `rig exec` and `rig browser` use E2B's command API, not ports.

## Inside a box

- An Xfce desktop on display `:0`, served by x11vnc (box-local only) and noVNC.
- One Google Chrome with a persistent profile (`~/.config/rig-chrome`) and its debugging port on the box's `localhost:9222`. You sign in to it on the desktop; the agent drives it with `agent-browser --cdp 9222` (`rig browser`).
- Your repos under `~/work/<repo>`. The dev server runs in its own process group, logging to `/tmp/rig-dev.log`.

The full tool list is in [image.md](image.md).

## Code map

| File | Owns |
|---|---|
| `bin/rig` | Starts Bun with rig's own empty config, so a repo's `bunfig.toml` and `.env` are never loaded |
| `src/cli.ts` | Command table and top-level help |
| `src/args.ts` | Argument parsing |
| `src/help.ts` | Per-command help; `docs/commands.md` is generated from it |
| `src/key.ts` | Settings and the API key: shell, `~/.config/rig/.env`, Keychain |
| `src/config.ts` | Names, paths and defaults |
| `src/box.ts` | E2B calls: create, connect, list, pause, delete, snapshots |
| `src/select.ts` | Filters, ages and bulk actions |
| `src/commands.ts` | Per-box commands: up, sync, exec, browser, shot, port, desktop, snap, new |
| `src/manage.ts` | Many-box commands: status, ls, pause, kill, prune, saved, doctor |
| `src/saved.ts` | Saved-desktop names and which one is the default |
| `src/repo.ts` | Local git, run safely |
| `src/project.ts` | A repo's settings: detection and `rig.json` |
| `src/init.ts` | `rig init`, and the first-run questions in `rig up` |
| `src/sync.ts` | Making the box match your working tree |
| `src/services.ts` | Dev server, desktop and viewer inside the box |
| `src/proxy.ts` | The local port proxy |
| `src/viewer.ts` | The background helper behind `rig desktop`, and its keep-awake |
| `src/computer.ts` | Computer use in the box: screenshot, click, type, key, scroll, drag, zoom (xdotool, ImageMagick) |
| `src/computer-commands.ts` | `rig screen`, `click`, `type`, `key` and the other computer-use commands |
| `src/mcp.ts` | `rig mcp`: the MCP server over stdio with the computer, browser, shell and boxes tools |
| `src/sanitize.ts` | Cleaning box output before it reaches your terminal |
| `src/cookies/` | Reading browser cookies on your laptop and handing them to the box's Chrome |
| `src/image.ts` | The box image definition |
| `image/` | Scripts copied into the image |
| `skills/rig/SKILL.md` | The Claude Code skill; `rig guide` prints it |
