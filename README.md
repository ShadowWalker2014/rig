<p align="center"><img src="assets/hero.svg" alt="rig: Give every AI agent its own cloud desktop. Five agents, each with its own cloud desktop running the app. Three are running and two are paused, costing nothing." width="100%"></p>

<p align="center"><b>rig</b> gives each coding agent a Linux desktop in the cloud with your code, a running dev server, tests and a signed-in Chrome, so your laptop stays fast and you can run many agents at once.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@shadowwalker2014/rig"><img src="https://img.shields.io/npm/v/@shadowwalker2014/rig?style=flat-square&color=8b8dff&labelColor=0e1018&label=npm" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-8b8dff?style=flat-square&labelColor=0e1018" alt="MIT license"></a>
  <a href="https://github.com/ShadowWalker2014/rig/stargazers"><img src="https://img.shields.io/github/stars/ShadowWalker2014/rig?style=flat-square&color=8b8dff&labelColor=0e1018" alt="GitHub stars"></a>
</p>

<p align="center"><a href="https://youtu.be/n-CSBE_yFis"><img src="assets/demo.gif" alt="rig demo: five agents each get a cloud desktop. rig up starts the app, the agent checks its work with a screenshot, you step in through a browser tab, the agent clicks and types on the screen, and the desktop sleeps for free and wakes in about two seconds." width="100%"></a></p>
<p align="center"><a href="https://youtu.be/n-CSBE_yFis"><b>Watch the 45-second demo (with sound)</b></a></p>

<p align="center">
  <a href="#setup">Setup</a> ·
  <a href="#bring-your-logins-from-your-browser">Logins</a> ·
  <a href="#use-it-in-a-repo">Repos</a> ·
  <a href="#saved-desktops">Saved desktops</a> ·
  <a href="#computer-use">Computer use</a> ·
  <a href="#quick-start-for-your-agent">Quick start</a> ·
  <a href="#manage-and-clean-up">Manage</a> ·
  <a href="#security">Security</a> ·
  <a href="#faq">FAQ</a> ·
  <a href="#docs">Docs</a>
</p>

Claude Code, Cursor or Codex keeps editing code on your laptop. The heavy work runs in its cloud desktop, which sleeps when nobody uses it and wakes in about two seconds.

## Why rig

One coding agent barely uses your laptop. What freezes it is everything around the agent: a dev server per branch, a Chrome for checking the UI, and test runs. Two or three tasks in, a 16 to 24 GB laptop starts swapping.

rig moves that work into one cloud desktop per branch. Your laptop runs only the agents.

<p align="center"><img src="assets/before-after.svg" alt="Without rig, the laptop runs an agent, a dev server, Chrome and tests for every task, and its memory is full. With rig, the laptop runs only the agents, and each branch's dev server, Chrome and tests run in its own cloud desktop." width="100%"></p>

## What you get

| | |
|---|---|
| **Sleeps when idle** | A cloud desktop pauses after 15 quiet minutes with everything still running inside. It costs nothing while paused and wakes in about two seconds. |
| **Starts signed in** | One command copies your logins from Chrome, Arc, Edge, Brave, Firefox or Safari. Every new cloud desktop starts with them. |
| **Computer use and MCP** | Your agent can see the whole screen and click, type and press keys, like Claude's computer use. `rig mcp` gives Claude Code these as native tools that return screenshots. |
| **You can take over** | Open the desktop's screen in any browser tab to finish a login or type a 2FA code. It is the same Chrome the agent drives. |
| **No push needed** | `rig sync` sends your local edits, committed or not. |
| **Your whole toolbelt** | Node, Bun, Python, Playwright, Puppeteer, the Vercel, Cloudflare, Railway, Fly, AWS, Google Cloud, GitHub and Stripe CLIs, Claude Code, Codex and more. |
| **Private by default** | Ports are never public, your API key never touches the repo you work in, and cookie values are never printed. |
| **Built for many** | Filters and bulk actions work across thousands of cloud desktops, and one command cleans up the stale ones. |

## See it working

Stills from the [demo video](https://youtu.be/n-CSBE_yFis). Every command in it ran for real on a real cloud desktop.

<table>
  <tr>
    <td width="33%"><img src="assets/stills/parallel-agents.png" alt="Five agents, each with its own cloud desktop running the same app on a different branch."><br><sub><b>Every agent gets its own desktop.</b> Five branches run side by side.</sub></td>
    <td width="33%"><img src="assets/stills/one-command.png" alt="A terminal running rig up: it creates a box, installs packages, starts the dev server and prints Box is ready."><br><sub><b>One command starts the app.</b> <code>rig up</code> copies the code, installs and runs it.</sub></td>
    <td width="33%"><img src="assets/stills/checks-its-work.png" alt="The agent runs rig browser and rig shot, and the screenshot of the app appears next to the terminal."><br><sub><b>The agent checks its own work.</b> <code>rig shot</code> saves a screenshot to your laptop.</sub></td>
  </tr>
  <tr>
    <td width="33%"><img src="assets/stills/step-in.png" alt="The cloud desktop's screen in a browser tab, showing a two-step verification form with a code being typed."><br><sub><b>You can step in.</b> <code>rig desktop</code> opens the screen for a 2FA code.</sub></td>
    <td width="33%"><img src="assets/stills/uses-the-screen.png" alt="Claude Code, through rig mcp, takes a screenshot and clicks and types in the app on the cloud desktop."><br><sub><b>It uses the whole screen.</b> Claude Code clicks and types through <code>rig mcp</code>.</sub></td>
    <td width="33%"><img src="assets/stills/sleeps-costs-0.png" alt="rig pause, then five minutes later rig exec wakes the box in 1.9 seconds with the same dev server process still running."><br><sub><b>It sleeps for free.</b> It woke in 1.9 seconds with the same dev server still running.</sub></td>
  </tr>
</table>

Two real screenshots, taken with rig:

<table>
  <tr>
    <td width="50%"><img src="assets/screenshot-desktop.png" alt="A rig cloud desktop: Ubuntu with Chrome open on the rig GitHub repository, and a terminal listing the installed tools, including node 24, bun, pnpm, python, Claude Code, Codex, opencode, gh, vercel, wrangler, railway, fly, aws, gcloud, stripe, Playwright, ffmpeg and Homebrew."><br><sub><b>The cloud desktop's screen</b>, as you see it in a browser tab with <code>rig desktop</code>: Chrome, and the tools every cloud desktop comes with.</sub></td>
    <td width="50%"><img src="assets/screenshot-agent-view.png" alt="A screenshot taken with rig shot: the cloud desktop's Chrome showing the rig documentation page on GitHub."><br><sub><b>What your agent sees</b> with <code>rig shot</code>: the cloud desktop's Chrome, saved to your laptop. This fresh desktop is not signed in yet.</sub></td>
  </tr>
</table>

## How it works

<p align="center"><img src="assets/how-it-works.svg" alt="The rig loop in five commands: rig up, rig sync, rig exec and rig browser, rig desktop, rig save. After every edit, run rig sync and test again." width="100%"></p>

1. **`rig up`** gives this branch a cloud desktop. It copies your code in, installs packages and starts the dev server.
2. **`rig sync`** sends your local edits to it.
3. **`rig exec`** runs tests there, and **`rig browser`** drives its signed-in Chrome.
4. **`rig desktop`** lets you see and control its screen.
5. **`rig save`** makes a signed-in cloud desktop your default desktop, so every new one starts as a copy of it.

In the CLI, a cloud desktop is called a **box**.

## Setup

Setup takes about 20 minutes, most of it waiting for the image to build. You need [Bun](https://bun.sh) 1.2+ and an [E2B](https://e2b.dev) account. The full walkthrough is in the [setup guide](docs/setup.md).

**1. Install rig**

```bash
npm install -g @shadowwalker2014/rig     # or: bun add -g @shadowwalker2014/rig
rig help                                 # every command; `rig help <command>` for one
```

**2. Add your E2B key**

```bash
rig login     # macOS: the Keychain asks for the key, so it never shows on screen
```

Not on a Mac? Copy [.env.example](.env.example) to `~/.config/rig/.env`, run `chmod 600` on it, and set `RIG_E2B_API_KEY`.

**3. Build the image** (once, about 10 minutes)

```bash
rig image build
```

**4. Sign in to your tools**

```bash
rig cookies push             # your browser's logins, except banking and payments
```

For command-line tools, sign in inside a cloud desktop, then save it:

```bash
rig new                      # an empty cloud desktop; prints its id
rig desktop <id>             # open the link; sign in to Google, `gh auth login`, `vercel login`…
rig save <id>                # every new cloud desktop now starts signed in
rig saved                    # your saved desktops; * is the one new boxes start from
```

Keep 1Password signed out in a desktop you save. A saved desktop is stored with E2B, and a signed-in 1Password in it would put your vault session there too.

**5. Teach your coding agent**

```bash
rig skill install            # Claude Code
```

**6. Check everything**

```bash
rig doctor                   # every line should start with ✓
```

## Bring your logins from your browser

Sign in to anything in the browser you already use, then copy those logins into your cloud desktops. Run it again whenever you sign in to something new.

| Command | What it copies |
|---|---|
| `rig cookies push` | Every site **except** banking and payments. Google, GitHub, email and everything else go. |
| `rig cookies push --all` | Every site, banking and payments too. You confirm at the terminal first. |
| `rig cookies push --site github.com,linear.app` | Only those sites |
| `rig cookies push --skip notion.so` | The default set, minus the sites you list |

| Add | To |
|---|---|
| `--from arc` or `--from chrome:Work` | Use another browser or profile |
| `-b <box>` | Update one cloud desktop instead of your default desktop |

See what is there first. Neither command reads a cookie value or asks for access:

```bash
rig cookies browsers             # Chrome, Edge, Brave, Arc, Comet, Chromium, Vivaldi, Opera, Firefox, Safari
rig cookies sites --from chrome  # each site's cookie count, and which ones stay out by default
```

**How it stays safe:**

- rig prints only site names and counts, never a value.
- Cookies are decrypted in memory and sent over E2B's encrypted connection straight into the cloud desktop's Chrome.
- For Chrome-family browsers, macOS asks you to approve access each time. Click **Allow**, not Always Allow.
- `--all` refuses to run from an agent or script. Banking and payment sessions stay on your laptop unless you ask for them.

Some sites refuse a login copied from another computer, and Google accounts do. For those, sign in once inside the cloud desktop with `rig desktop`, then run `rig save`. Details are in [docs/cookies.md](docs/cookies.md).

## Use it in a repo

```bash
cd my-repo
rig up          # the first time, it works out how the repo runs and asks about env files
```

The first `rig up` in a repo runs `rig init`. It detects the package manager, the dev command and its port, and asks before copying gitignored env files like `.env.local` into the box. The answers go in a small `rig.json`, and `rig status` shows the settings in use. If the box can't read a private repo, `rig up` stops before anything slow and prints the exact fix. Details are in [using rig in a repo](docs/projects.md).

```json
{ "setup": "bun install", "dev": "bun run dev", "port": 3000, "copy": [".env.local"], "submodules": true }
```

### Every task

<p align="center"><img src="assets/terminal.svg" alt="A terminal session: rig up creates a box, clones the repo, runs setup and starts the dev server. rig exec -- bun test runs the tests in the box. rig ls lists one running box and one paused box." width="100%"></p>

```bash
cd my-repo
rig up                                       # this branch's cloud desktop, with the dev server running
rig sync                                     # after editing locally
rig exec -- bun test                         # any command, in its copy of the repo
rig exec -- 'bunx tsc --noEmit && bun run lint'
rig browser -- open http://localhost:3000    # drive its signed-in Chrome
rig browser -- snapshot -i                   # the page's buttons and fields, for an agent
rig shot                                     # screenshot to a local file
rig port 3000                                # open its app at http://localhost:3000 on your laptop
rig logs                                     # the dev server's output
```

Running parallel agents on one branch? `rig up --new` gives each its own cloud desktop. Pass `-b <id>` to the other commands.

## Take over the desktop

```bash
rig desktop <box>       # or just `rig desktop` inside a repo
```

rig prints a private link. Open it in any browser tab to see and control the cloud desktop's screen: finish a login, type a 2FA code, or watch the agent work.

- **It stays awake while you use it.** The cloud desktop does not sleep while the tab is open, and sleeps 15 minutes after you close it.
- **The link keeps working** after the terminal or agent that opened it has gone. `rig desktop` again prints the same link, and `rig desktop --stop` closes it.
- **Copy and paste** go through the clipboard panel on the left edge of the view.
- **It is private.** The link works only on your machine, and asks for a one-time password it already carries.

## Saved desktops

Set up a cloud desktop once, sign in and install what you need, then save it. Every new cloud desktop starts as a copy of your **default** saved desktop: its files, its logins and its already-running Chrome.

| Command | Does |
|---|---|
| `rig save <box>` | Save this box as your default desktop, or update it |
| `rig save <box> --as work` | Save it under another name; add `--use` to make it the default |
| `rig saved` | List saved desktops; `*` marks the default |
| `rig saved use work` | New boxes now start from `work` |
| `rig new --from work` | Start one box from `work` without changing the default |
| `rig saved rm work` | Delete a saved desktop |
| `rig status` | The default, running and paused boxes, and this branch's box |

rig reminds you to save. Closing `rig desktop` on a clean box prints the `rig save` command, and `rig doctor` flags a missing default.

Save a clean cloud desktop made with `rig new`. rig refuses to save one that ran a repo's code, because that code could have planted something that would spread to every cloud desktop started from it.

## Computer use

Your agent can use the whole cloud desktop, not only its Chrome. It can take a screenshot, click, type, press keys, scroll and drag. These are the same actions as Claude's computer-use tool, for things outside a web page: a terminal window, a system dialog, a browser extension or a file picker.

<p align="center"><img src="assets/computer-use.svg" alt="Computer use: Claude Code on your laptop runs rig screen to look, rig click, rig type and rig key to act, and rig screen again to check. On the cloud desktop, the click lands on a checkbox in the app." width="100%"></p>

```bash
rig screen                     # screenshot the desktop; prints the file path
rig click 640 88               # click at a point in that screenshot
rig type "hello"               # type into whatever has focus
rig key ctrl+l                 # press keys: Enter, Tab, ctrl+shift+t, cmd+a…
rig zoom 0 0 400 200           # a 2x close-up, for small text
```

For Claude Code, add rig as an MCP server. Claude then gets `computer`, `browser`, `shell` and `boxes` tools and sees screenshots directly as images:

```bash
claude mcp add rig -- rig mcp
```

Use `rig browser` for anything inside a web page. It reads the page's structure, so it is faster and more reliable than clicking pixels. More in [computer use](docs/computer-use.md).

## Use it with your coding agent

rig ships with an agent skill. It tells your coding agent to run dev servers, tests and browser checks in its cloud desktop instead of on your laptop, and how to hand the screen to you for a login.

```bash
rig skill install                        # Claude Code
npx skills add ShadowWalker2014/rig      # Claude Code, Cursor, Codex, opencode and more
rig guide                                # the same instructions, for any other agent's AGENTS.md
```

Every command also explains itself: `rig help <command>`.

## Quick start for your agent

Paste this into a fresh Claude Code (or any agent) session, inside the repo you want to work on:

```text
Use rig (https://github.com/ShadowWalker2014/rig) to run this repo in a cloud desktop
instead of on my laptop. Keep editing code locally; run the heavy work in the cloud.

1. Run `rig guide` and follow it. Run `rig help <command>` whenever you are unsure.
2. Start this branch's cloud desktop with `rig up`. The first time in this repo it runs
   `rig init`. Ask me before copying any env file.
3. After every edit, run `rig sync`. Run tests with `rig exec -- <command>`.
4. Check the UI with `rig browser -- open http://localhost:<port>`, `rig browser -- snapshot -i`
   and `rig shot`. Read logs with `rig logs`.
5. If a site needs a login or a 2FA code, run `rig desktop` and give me the link.
   If a site rejects the cloud login, ask me to sign in to Chrome on my laptop,
   then run `rig cookies push --site <site>`.
6. For anything outside a web page, use `rig screen`, `rig click`, `rig type` and `rig key`.
7. Never run `rig save`, `rig kill` or `rig cookies push --all` without asking me first.
8. When you finish, run `rig pause`.
```

The same instructions ship with rig: `rig skill install` adds them as a Claude Code skill, and `rig guide` prints them.

## Manage and clean up

```bash
rig ls                                   # every cloud desktop: state, repo, branch, last used
rig ls --state running                   # what is costing money right now
rig pause --all                          # stop the meter on everything
rig prune                                # preview: paused cloud desktops unused for 7 days
rig prune --merged --yes                 # delete those, plus ones whose branch is gone
rig kill --repo acme/web --state paused --yes
rig doctor                               # key, image, default desktop and settings
```

- **Clean-up is automatic.** Once a day, `rig up` and `rig new` delete rig's own boxes that have been paused and unused for 7 days. Set `RIG_AUTO_PRUNE_DAYS` to change that, or `0` to turn it off.
- **Filters stay fast.** `--state`, `--older-than 7d`, `--repo`, `--branch`, `--here` and `--all` run on E2B's side, so they stay fast with thousands of cloud desktops. A filtered delete previews first and only deletes with `--yes`.
- **rig is free.** You pay E2B for running time: about $0.33 an hour for 4 CPUs / 8 GB at [E2B's rates](https://e2b.dev/pricing). Paused cloud desktops cost nothing. More in [cleanup and scale](docs/cleanup-and-scale.md).

## What's inside a cloud desktop

Ubuntu 24.04 with an Xfce desktop and Google Chrome, plus:

| Area | Tools |
|---|---|
| JavaScript | Node 24, npm, bun, pnpm |
| Deploy and cloud | vercel, wrangler, railway, fly, aws, gcloud, gh, stripe, e2b |
| AI coding agents | claude, codex, opencode |
| Browsers and testing | Chrome with the 1Password extension, Playwright with Chromium, Puppeteer, agent-browser |
| Passwords | 1Password CLI (`op`) and Chrome extension. Sign in through `rig desktop` when a task needs it, and don't save a signed-in 1Password. |
| Python and media | python, pip, uv, whisper, ffmpeg, ImageMagick |
| Databases and everyday | psql, redis-cli, sqlite3, git, git-lfs, jq, ripgrep, tmux, Homebrew |

Add your own tools with a script at `~/.config/rig/image.sh`. See [the box image](docs/image.md).

## Settings

Set these in your shell or in `~/.config/rig/.env` (see [.env.example](.env.example)):

| Setting | Default | Meaning |
|---|---|---|
| `RIG_E2B_API_KEY` | Keychain, after `rig login` | Your E2B API key |
| `RIG_E2B_DOMAIN` | `e2b.app` | Only for self-hosted E2B |
| `RIG_IDLE_MIN` | `15` | Minutes without a rig command before a cloud desktop pauses |
| `RIG_AUTO_PRUNE_DAYS` | `7` | Days a paused box may sit unused before `rig up` or `rig new` deletes it; `0` turns it off |
| `RIG_BOX_CPU` / `RIG_BOX_MEMORY_MB` | `4` / `8192` | Size, set when the image is built |
| `RIG_DEFAULT_DESKTOP` / `RIG_BASE_TEMPLATE` | `rig-default` / `rig-base` | Names of your default desktop and image in E2B |

## Security

- **Your E2B key never touches the repo you work in.** rig reads it from your shell, a private settings file or the Keychain, and starts with its own empty settings, so a repo's `.env` or `bunfig.toml` never loads.
- **A hostile repo cannot reach your laptop through rig.** Its git settings cannot run programs, and no path, symlink or `rig.json` entry can upload a file from outside the repo.
- **Ports are private.** `rig port` and `rig desktop` serve them on your laptop's `127.0.0.1` only and refuse requests started by other websites. The desktop also has a one-time password.
- **Cookie values are never printed,** and banking and payment sessions stay out unless you ask.
- **Your default desktop is shared by every new cloud desktop.** Keep money-moving and production-write accounts out of it.

Full details are in [docs/security.md](docs/security.md). Found a vulnerability? Please open a private [security advisory](https://github.com/ShadowWalker2014/rig/security/advisories/new).

## FAQ

<details>
<summary><b>What is rig?</b></summary>

rig is open-source cloud desktops for AI agents. Each git branch gets a Linux desktop in the cloud with a dev server, tests and a signed-in Chrome, so AI agents can work in parallel without overloading your laptop. The agent still runs locally; rig moves only the heavy processes.
</details>

<details>
<summary><b>Does rig work with Claude Code, Cursor, Codex and other agents?</b></summary>

Yes. Any agent that can run shell commands can use rig. `rig skill install` adds a Claude Code skill, `npx skills add ShadowWalker2014/rig` installs it for other agents, and `rig guide` prints the instructions for anything else.
</details>

<details>
<summary><b>How do I get my existing logins into a cloud desktop?</b></summary>

Run `rig cookies push`. It copies your browser's logins, except banking and payment sites, into your default desktop, so every new cloud desktop starts signed in. Use `--site` to pick sites or `--all` to include everything.
</details>

<details>
<summary><b>How is rig different from Claude Code on the web, GitHub Codespaces or Daytona?</b></summary>

Claude Code on the web runs the whole agent in the cloud and starts every session without your logins. Codespaces loses running processes when it stops. rig keeps the agent on your laptop, keeps each cloud desktop's memory while paused, starts every one already signed in, and lets you take over the browser.
</details>

<details>
<summary><b>How much does it cost?</b></summary>

rig is free and MIT licensed. You pay E2B for running time: about $0.33 an hour for a 4 CPU / 8 GB cloud desktop at E2B's [published rates](https://e2b.dev/pricing). Paused ones cost nothing.
</details>

<details>
<summary><b>Does the dev server think it is running on localhost?</b></summary>

Yes. It sees `Host: localhost:<port>`, so dev-origin checks and OAuth redirect callbacks behave as on a laptop. Providers that POST back from their own site (like Sign in with Apple's `form_post`) are blocked by rig's cross-site protection; finish those through `rig desktop`.
</details>

<details>
<summary><b>Does rig work on Linux or Windows?</b></summary>

The CLI runs anywhere Bun runs; use `~/.config/rig/.env` for your key on Linux. Copying browser logins works on macOS. Windows is untested.
</details>

<details>
<summary><b>Why E2B?</b></summary>

E2B combines what rig needs: pausing with memory kept, waking on traffic, snapshots of a running machine that start many new ones, private ports, and machines big enough for a real dev server.
</details>

## Docs

| Read | For |
|---|---|
| [Setup guide](docs/setup.md) | First-time setup, step by step |
| [Using rig in a repo](docs/projects.md) | `rig up`, `rig init`, `rig.json`, env files, private repos |
| [Bring your logins](docs/cookies.md) | Copying sign-ins from your browser, and how it stays safe |
| [Command reference](docs/commands.md) | Every command, flag and example |
| [Computer use](docs/computer-use.md) | `rig screen`, `click`, `type`, `key` and the `rig mcp` server for Claude Code |
| [How it works](docs/how-it-works.md) | Lifecycle, syncing, the default desktop, the proxy, the code map |
| [Cleanup and scale](docs/cleanup-and-scale.md) | Costs, auto-pause, `prune`, bulk actions |
| [The box image](docs/image.md) | Installed tools, adding your own, size |
| [Security](docs/security.md) | How your key, logins and laptop are protected |
| [Contributing](AGENTS.md) | Code map, tests and safety rules |

## License

[MIT](LICENSE)
