# The box image

`rig image build` builds one Ubuntu 24.04 image that every box starts from. It has no logins; those come from your default desktop.

## What is installed

| Area | Tools |
|---|---|
| JavaScript | Node 24, npm, bun, pnpm |
| Deploy and cloud | vercel, wrangler (Cloudflare), railway, fly, aws, gcloud, gh, stripe, e2b |
| AI coding agents | claude (Claude Code), codex, opencode |
| Email | resend |
| Browsers and testing | Google Chrome, Playwright with its Chromium, Puppeteer (uses the system Chrome), agent-browser |
| Passwords | 1Password CLI (`op`) from 1Password's signed apt repo, and the 1Password Chrome extension, installed by Chrome policy from the Chrome Web Store |
| Python and media | python / py, pip, pipx, uv, whisper (CPU), ffmpeg, ImageMagick, Pillow, fontTools |
| Databases | psql, redis-cli, sqlite3 |
| Everyday | git, git-lfs, jq, ripgrep, fd, tmux, vim, htop, curl, wget, zip, rsync |
| Packages | Homebrew (`brew`) |
| Desktop | Xfce, x11vnc, noVNC, emoji and CJK fonts |

Chrome, Node, gh, gcloud and stripe come from their vendors' signed apt repositories. npm tools, flyctl and uv are pinned to exact versions in `src/image.ts`.

Links opened by command-line tools (`gh auth login`, `vercel login`, `gcloud auth login`) and by the desktop open as a tab in the box's one signed-in Chrome, not a second empty one. Copy and paste work through `xclip`, `xsel` and `autocutsel`. Chrome renders WebGL in software, so sites that need it work.

In a box, `PLAYWRIGHT_BROWSERS_PATH` and `PUPPETEER_EXECUTABLE_PATH` are already set, so `npx playwright test` and Puppeteer scripts work without downloading browsers.

## Adding your own tools

Put a script at `~/.config/rig/image.sh`. It runs as root at the end of every `rig image build`, and never enters the rig repo:

```bash
#!/bin/bash
set -e
npm install -g @your-company/cli@1.2.3
apt-get update && apt-get install -y some-package
```

## Box size

Size is fixed when the image is built. The defaults are 4 CPUs and 8 GB. Change them in `~/.config/rig/.env`, then rebuild:

```bash
RIG_BOX_CPU=8
RIG_BOX_MEMORY_MB=8192
```

E2B's free plan allows 2 CPUs and 4 GB; Pro allows 8 and 8 GB by default, and more on request.

## After rebuilding

New boxes from your default desktop keep using the image the snapshot was taken from. To move your logins onto a new image: `rig new`, sign in again with `rig desktop`, then `rig save <id>`.
