# rig — run more coding agents without freezing your laptop

**Your laptop runs the agents. The cloud runs everything else.**

rig moves the heavy part of AI coding — dev servers, test runs and a real browser — into cloud boxes that sleep when you're not using them. Claude Code, Cursor or Codex keeps editing code on your laptop, and you can run many tasks side by side.

[![npm](https://img.shields.io/npm/v/@shadowwalker2014/rig)](https://www.npmjs.com/package/@shadowwalker2014/rig)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

<p align="center"><img src="assets/hero.svg" alt="rig: coding agents on your laptop, dev servers and a signed-in Chrome in pause-when-idle E2B cloud boxes, one per git branch" width="100%"></p>

## Why it matters

One coding agent barely uses your laptop. What freezes it is everything around the agent: a dev server per branch, a Chrome for checking the UI, and test runs. Two or three tasks in, a 16–24 GB laptop starts swapping.

rig gives every branch its own Linux box in the cloud for that work:

- **Sleeps when idle, wakes in a second.** A box pauses after 15 quiet minutes with everything still running inside, and costs nothing while paused.
- **Starts signed in.** Sign in to GitHub, Vercel and your test accounts once; every new box starts with those logins.
- **You can take over.** Open the box's screen in any browser tab to finish a login or a 2FA code.
- **Private by default.** Box ports are never public, and your API key never touches the repo you work in.

<p align="center"><img src="assets/before-after.svg" alt="Without rig, the laptop runs an agent, dev server, Chrome and tests for every task and runs out of memory. With rig, the laptop runs only the agents and each branch's dev server, Chrome and tests run in its own cloud box." width="100%"></p>

## How it works

<p align="center"><img src="assets/how-it-works.svg" alt="The rig loop: rig up, rig sync, rig exec and rig browser, rig desktop, rig snap --promote" width="100%"></p>

1. **`rig up`** gives this branch a box: your code is copied in, packages are installed and the dev server starts.
2. **`rig sync`** sends your local edits to the box — committed or not, no `git push` needed.
3. **`rig exec`** runs tests in the box; **`rig browser`** drives its signed-in Chrome.
4. **`rig desktop`** lets you take over the box's screen.
5. **`rig snap --promote`** saves a clean box's logins so every new box starts with them.

## Quick start

You need [Bun](https://bun.sh) 1.2+ and an [E2B](https://e2b.dev) account.

```bash
bun add -g github:ShadowWalker2014/rig   # npm release coming: npm install -g @shadowwalker2014/rig
rig login           # stores your E2B API key in the macOS Keychain
rig image build     # once, about 10 minutes: desktop, Chrome and the usual dev CLIs
rig skill install   # once: teaches Claude Code to use rig
rig doctor          # checks everything is set up
```

Not on a Mac? Copy [.env.example](.env.example) to `~/.config/rig/.env`, run `chmod 600` on it, and put your key in it.

### Sign in to your tools once

```bash
rig new                      # an empty box; prints its id
rig desktop <id>             # open the link, sign in to sites in Chrome, run `gh auth login` in the terminal
rig snap <id> --promote      # every new box now starts signed in
```

### Every task

<p align="center"><img src="assets/terminal.svg" alt="Example terminal session running rig up, rig exec and rig ls" width="100%"></p>

```bash
cd my-repo
rig up                                       # this branch's box, with the dev server running
rig sync                                     # after editing
rig exec -- bun test                         # any command, in the box's copy of the repo
rig browser -- open http://localhost:3000    # the agent drives the box's Chrome
rig shot                                     # screenshot to a local file
rig port 3000                                # open the box's app at http://localhost:3000
```

### Clean up

```bash
rig ls                       # every box, with state and when it was last used
rig prune --merged --yes     # delete idle boxes and boxes whose branch is gone
```

Filters and bulk actions scale to thousands of boxes: see [cleanup and scale](docs/cleanup-and-scale.md).

## Docs

| Read | For |
|---|---|
| [Command reference](docs/commands.md) | Every command, flag and example (also `rig help <command>`) |
| [How it works](docs/how-it-works.md) | Box lifecycle, syncing, the golden snapshot, the proxy, the code map |
| [Cleanup and scale](docs/cleanup-and-scale.md) | Costs, auto-pause, `prune`, bulk actions, thousands of boxes |
| [The box image](docs/image.md) | Installed tools, adding your own, box size |
| [Security](docs/security.md) | How your key, logins and laptop are protected |
| [Contributing](AGENTS.md) | Code map, tests and safety rules |

## Per-repo settings

An optional `rig.json` at the repo root. Everything has a default based on your lockfile and `package.json`:

```json
{ "setup": "bun install", "dev": "bun run dev", "port": 3000, "copy": [".env.local"], "submodules": true }
```

`copy` lists gitignored files (like `.env.local`) to send on every sync.

## Settings

Set these in your shell or in `~/.config/rig/.env` (see [.env.example](.env.example)):

| Setting | Default | Meaning |
|---|---|---|
| `RIG_E2B_API_KEY` | Keychain, after `rig login` | Your E2B API key |
| `RIG_E2B_DOMAIN` | `e2b.app` | Only for self-hosted E2B |
| `RIG_IDLE_MIN` | `15` | Minutes without a rig command before a box pauses |
| `RIG_BOX_CPU` / `RIG_BOX_MEMORY_MB` | `4` / `8192` | Box size, set when the image is built |
| `RIG_GOLDEN` / `RIG_BASE_TEMPLATE` | `rig-golden` / `rig-base` | Names of your snapshot and image in E2B |

## Security in one minute

- Your E2B key is read from your shell, a private settings file or the Keychain — never from the repo you are in.
- Box ports are private; `rig port` and `rig desktop` serve them on your laptop's `127.0.0.1` only.
- A hostile repo cannot run code on your laptop or upload your files through rig.
- The golden snapshot copies its logins into every box, so keep money-moving and production-write accounts out of it.

Details in [docs/security.md](docs/security.md).

## FAQ

### What is rig?
rig is an open-source CLI that gives each git branch its own cloud Linux box for dev servers, tests and a browser, so AI coding agents can work in parallel without overloading your laptop. The agent still runs locally; rig moves only the heavy processes.

### Does rig work with Claude Code, Cursor, Codex and other agents?
Yes. Any agent that can run shell commands can use rig. `rig skill install` adds a Claude Code skill; other agents can read `rig guide`.

### How is rig different from Claude Code on the web, GitHub Codespaces or Daytona?
Claude Code on the web runs the whole agent in the cloud and starts every session without your logins. Codespaces loses running processes when it stops. rig keeps the agent on your laptop, keeps each box's memory while paused, starts every box already signed in, and lets you take over the browser.

### How much does it cost?
rig is free and MIT licensed. You pay E2B for running boxes: about $0.33 an hour for a 4 CPU / 8 GB box at E2B's [published rates](https://e2b.dev/pricing). Paused boxes cost nothing.

### Can I sign in to websites in the cloud browser?
Yes. `rig desktop` opens the box's screen in a browser tab. It is the same Chrome the agent drives, so a login you finish there is ready for the agent at once.

### Does the dev server think it is running on localhost?
Yes. It sees `Host: localhost:<port>`, so dev-origin checks and OAuth redirect callbacks behave as on a laptop. Providers that POST back from their own site (like Sign in with Apple's `form_post`) are blocked by rig's cross-site protection; finish those through `rig desktop`.

### Does rig work on Linux or Windows?
The CLI runs anywhere Bun runs. Use `~/.config/rig/.env` for your key on Linux; Windows is untested.

### Why E2B?
E2B combines what rig needs: pausing with memory kept, waking on traffic, snapshots of a running box that start many new boxes, private ports, and boxes big enough for a real dev server.

## License

[MIT](LICENSE)
