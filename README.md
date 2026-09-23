# rig — cloud dev boxes for AI coding agents

[![npm](https://img.shields.io/npm/v/@shadowwalker2014/rig)](https://www.npmjs.com/package/@shadowwalker2014/rig)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**rig is an open-source command-line tool that runs your dev servers, tests and a logged-in Chrome in cloud sandboxes, while Claude Code, Cursor, Codex or any coding agent keeps editing code on your laptop.** Each git branch gets its own Linux box on [E2B](https://e2b.dev). A box pauses itself after 15 idle minutes, keeps its memory, and wakes in about a second. You can run many agents in parallel without your laptop running out of memory.

> Status: early preview (v0.1). Feedback and issues are welcome.

## Why rig exists

A coding agent is cheap to run locally. What freezes a laptop is everything around it: each worktree's dev server (a large Next.js app can take several GB once compiled), a Chrome for browser tests, and test runners. On a 16–24 GB laptop that caps you at two or three parallel tasks.

rig moves exactly that heavy work to the cloud and leaves the agent and your editor where they are.

| Stays on your laptop | Moves to the rig box |
|---|---|
| The coding agent (Claude Code, Cursor, Codex, Aider…) | The dev server (`bun run dev`, `next dev`, `vite`) |
| Your editor and git | Test suites, type-checks and builds |
| Your code (the source of truth) | A real, headful Chrome that is signed in to your accounts |

## How it works

```
 YOUR LAPTOP                                  E2B CLOUD
 coding agent                                 box: repo + dev server + Chrome   running
   edits code, runs `rig …`  ── API key ───►  box: …                            paused ($0)
 you ── private desktop link ─────────────┘       every box starts from your
                                                  golden snapshot: tools + logins
```

1. `rig up` creates a box for this repo and branch (or reuses it), copies your working tree into it, installs packages and starts the dev server.
2. The agent edits files locally, then runs `rig sync`. Committed, uncommitted and untracked changes all reach the box, with no `git push`.
3. The agent tests in the box with `rig exec -- bun test` and checks the UI with `rig browser -- open http://localhost:3000`.
4. When a page needs a human (a login, a 2FA code), `rig desktop` gives you a link to the box's screen. You take over in any browser tab.
5. `rig snap --promote` saves a box's logins as the **golden snapshot**, so every future box starts signed in to GitHub, Vercel and your test accounts.

## Quick start

Requires [Bun](https://bun.sh) 1.2+ and an [E2B account](https://e2b.dev) (the free Hobby plan works for trying rig with `RIG_BOX_CPU=2` and `RIG_BOX_MEMORY_MB=4096`; bigger boxes need Pro).

```bash
npm install -g @shadowwalker2014/rig     # or: bun add -g @shadowwalker2014/rig
rig login                                # macOS: stores your E2B API key in the Keychain
rig image build                          # once: Ubuntu 24.04, desktop, Chrome, bun, node, gh, vercel
rig skill install                        # once: teaches Claude Code to use rig
```

Not on macOS? Put your key in a private settings file instead of `rig login`:

```bash
mkdir -p ~/.config/rig && cp .env.example ~/.config/rig/.env && chmod 600 ~/.config/rig/.env
# then set RIG_E2B_API_KEY=... in ~/.config/rig/.env
```

### Sign in to your tools once

```bash
rig new                         # an empty box; prints its id
rig desktop <id>                # open the link; sign in to sites in Chrome, run `gh auth login` in the terminal
rig snap <id> --promote         # every new box now starts from this one
```

### Every task

```bash
cd my-repo
rig up                          # box for this repo + branch: sync, install, start the dev server
rig sync                        # after editing locally
rig exec -- bun test            # any command, in the box's copy of the repo
rig browser -- open http://localhost:3000
rig shot                        # screenshot of the box's Chrome, saved locally
rig port 3000                   # open the box's dev server at http://localhost:3000 on your laptop
rig desktop                     # watch or take over the box's screen
```

Every command has built-in help: `rig help <command>`. `rig guide` prints the full workflow for coding agents.

## Commands

| Command | What it does |
|---|---|
| `rig up [--new]` | Create or reuse this branch's box, sync code, install, start the dev server |
| `rig sync` | Send local changes (committed or not) to the box |
| `rig exec -- <cmd>` | Run a command in the box's repo folder; output streams, exit code is kept |
| `rig browser -- <args>` | Drive the box's signed-in Chrome with [agent-browser](https://github.com/vercel-labs/agent-browser) |
| `rig shot [file]` | Screenshot the box's Chrome to a local PNG |
| `rig port <port>` | Serve a box port on your laptop's `localhost` |
| `rig desktop` | Private link to watch or control the box's desktop |
| `rig logs` | Last lines of the dev server output |
| `rig snap [--promote]` | Snapshot a box; `--promote` makes it the starting point for new boxes |
| `rig new` | Empty box for signing in to things |
| `rig ls` · `rig pause` · `rig kill` | List, pause or delete boxes |

## Per-repo settings

Optional `rig.json` at the repo root. Everything has a default based on your lockfile and `package.json`:

```json
{ "setup": "bun install", "dev": "bun run dev", "port": 3000, "copy": [".env.local"], "submodules": true }
```

`copy` lists gitignored files (like `.env.local`) to send on every sync. rig only ever uploads files inside the repo.

## Security

- **Your E2B key never touches the repo you work in.** rig reads it from your shell, `~/.config/rig/.env` (must be `chmod 600`) or the macOS Keychain. It starts Bun with its own empty config, so a repo's `.env` files and `bunfig.toml` are never loaded, and it ignores `E2B_*` variables so it cannot be pointed at another account.
- **Box ports are never public.** Every box is created with `allowPublicTraffic: false`. `rig port` and `rig desktop` run a proxy on `127.0.0.1` that adds the box's access token. It refuses other hostnames (DNS rebinding) and requests started by other websites; `rig port` still lets plain links and redirects in, exactly like a local dev server. The desktop also asks for a one-time password.
- **Box output is cleaned before it reaches your terminal.** Escape sequences that could write your clipboard or control your terminal are removed; colours stay.
- **Uploads stay inside the repo.** rig resolves every symlink before uploading, so no path, `rig.json` entry or committed symlink can send a file from outside the repo. Git runs with the repo's fsmonitor and hooks switched off.
- **A repo's code runs next to your logins.** `rig up` runs the repo's install and dev scripts in a box that starts from your golden snapshot, which holds your GitHub, Vercel and browser sessions. Only run `rig up` on repos you would trust to run `npm install` on your laptop.
- **The golden snapshot copies every login in it into every new box.** Sign in only to what you are comfortable having in every box. Keep money-moving accounts and production write credentials out, and use scoped tokens (for example a GitHub token limited to specific repos). `rig snap --promote` refuses a box that has run a repo's code unless you add `--force`; promote a clean box made with `rig new`.
- **Your E2B API key and each box's access token are as powerful as your logins.** Anyone holding them can control your boxes and their signed-in browser. rig keeps the access token in memory only. Revoke the API key in the E2B dashboard if it leaks.

Found a vulnerability? Please open a private [security advisory](https://github.com/ShadowWalker2014/rig/security/advisories/new) rather than a public issue.

## FAQ

### What is rig?
rig is a CLI that gives each git branch its own cloud Linux box for running dev servers, tests and a browser, so AI coding agents can work in parallel without overloading your laptop. The agent still runs locally; rig moves only the heavy processes.

### Does rig work with Claude Code, Cursor, Codex and other agents?
Yes. Any agent that can run shell commands can use rig. `rig skill install` adds a Claude Code skill that tells the agent when to use it; other agents can read `rig guide`.

### How is rig different from Claude Code on the web, GitHub Codespaces or Daytona?
Claude Code on the web runs the whole agent in the cloud and starts every session without your logins. Codespaces loses running processes when it stops. rig keeps the agent on your laptop, keeps each box's memory while paused, starts every box already signed in through the golden snapshot, and gives you a desktop to take over the browser.

### How much does rig cost?
rig is free and MIT licensed. You pay E2B for running boxes: at E2B's [published rates](https://e2b.dev/pricing), a 4 vCPU / 8 GB box costs about $0.33 per running hour. Paused boxes cost nothing.

### Can I sign in to websites in the cloud browser?
Yes. `rig desktop` opens the box's screen in a browser tab. The Chrome you see is the same one the agent drives, so a login you finish there is immediately available to the agent.

### Does the dev server think it is running on localhost?
Yes. Requests reach the box's dev server with `Host: localhost:<port>`, so dev-origin checks and OAuth redirect callbacks behave as they do on a laptop. Providers that POST back to your app from their own site (for example Sign in with Apple's `form_post`) are blocked by rig's cross-site protection; finish those in the box's Chrome through `rig desktop`.

### Does rig work on Linux or Windows?
The CLI runs anywhere Bun runs. Use `~/.config/rig/.env` for your key on Linux; Windows is untested.

### Why E2B?
E2B is the sandbox provider that combines pausing with memory kept, auto-resume on traffic, snapshots of a running box that can start many new boxes, private ports, and a large enough box for a real dev server.

## Configuration

Set these in your shell or in `~/.config/rig/.env` (see [.env.example](.env.example)):

| Setting | Default | Meaning |
|---|---|---|
| `RIG_E2B_API_KEY` | Keychain, after `rig login` | Your E2B API key |
| `RIG_E2B_DOMAIN` | `e2b.app` | Only for self-hosted E2B |
| `RIG_IDLE_MIN` | `15` | Minutes without a rig command before a box pauses |
| `RIG_GOLDEN` | `rig-golden` | Name of the golden snapshot in your E2B team |
| `RIG_BASE_TEMPLATE` | `rig-base` | Name of the base image built by `rig image build` |
| `RIG_BOX_CPU` | `4` | CPUs per box, set when the image is built |
| `RIG_BOX_MEMORY_MB` | `8192` | Memory per box in MB, set when the image is built |

## License

[MIT](LICENSE)
