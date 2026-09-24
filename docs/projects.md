# Using rig in a repo

```bash
cd my-repo
rig up
```

That is all most repos need. This page explains what `rig up` does, how a repo's settings are chosen, and what to do when it stops.

## What `rig up` does

1. **Settles the repo's settings.** The first time, with you at a terminal, it runs `rig init` for you (see below) and saves `rig.json`. An agent, or a script, gets the detected settings and a note about anything it skipped.
2. **Finds or starts this branch's box.** One box per repo and branch, started from your [default desktop](../README.md#saved-desktops) — so it is already signed in.
3. **Checks the box can read the repo** before cloning, and stops with the exact fix if not (see [Private repos](#private-repos)).
4. **Copies your working tree over:** your commit, unpushed commits, uncommitted edits, untracked files, and the files `rig.json` lists under `copy`. No `git push` needed.
5. **Installs** (`bun install`, `pnpm install`…) — only when the lockfile changed since the last install.
6. **Starts the dev server** and waits for its port. If it exits, you see the last lines of its log.

After that, `rig sync` sends new edits, `rig exec` runs commands, `rig browser` drives its Chrome, and `rig port 3000` opens the app on your laptop.

## `rig init`: a repo's settings

```bash
rig init                           # detect, ask about env files, write rig.json
rig init --yes                     # accept what was detected (for agents and scripts)
rig init --yes --copy .env.local   # …and copy that env file
```

| Setting | Detected from | Override |
|---|---|---|
| `setup` | The lockfile: `bun.lock` → `bun install`, `pnpm-lock.yaml` → `pnpm install`, `yarn.lock`, `package-lock.json` | `--setup "<cmd>"` |
| `dev` | `scripts.dev` in `package.json` → `bun run dev` (with your package manager) | `--dev "<cmd>"` |
| `port` | `--port`, `-p` or `PORT=` in the dev script; else the framework: Next.js, Nuxt, Remix 3000 · Vite, SvelteKit 5173 · Astro 4321 · Angular 4200 · Gatsby 8000 · Expo 8081; else 3000 | `--port <n>` |
| `copy` | Nothing by default. `rig init` offers each gitignored env file it finds — `.env`, `.env.local`, `.env.development`, `.env.development.local`, `.dev.vars` | `--copy .env.local` |
| `submodules` | Whether `.gitmodules` exists | edit `rig.json` |

The result is a small `rig.json` at the repo root:

```json
{
  "setup": "bun install",
  "dev": "bun run dev",
  "port": 3000,
  "copy": [".env.local"],
  "submodules": true
}
```

Commit it to share the settings with your team, or add it to `.gitignore` to keep them to yourself. `rig status` inside a repo shows the settings in use and whether they come from `rig.json` or were detected.

## Env files and secrets

A box clones your repo, so it only has what git has. Gitignored files — usually `.env.local` with API keys — are not there unless `rig.json` lists them under `copy`. Copied files go from your laptop straight into the box on every `rig sync`, over E2B's encrypted connection.

`rig init` asks before copying each one, because it usually holds secrets. `--yes` never copies an env file you did not name. Only copy what the dev server needs, and prefer development keys over production ones.

## Private repos

The box clones with its own GitHub login, from your default desktop. If the box cannot read the repo, `rig up` stops before doing anything slow and tells you:

```
The box cannot read acme/web from GitHub. If it is private, sign GitHub in once on your default desktop:
  rig desktop logins        then, in its terminal: gh auth login  (answer Yes to "Authenticate Git")
  rig save logins           every new box then has your GitHub login
Then run `rig up` again.
```

The box it had just started is deleted, so the next `rig up` starts fresh from your updated default desktop.

## When the dev server needs more

- **The dev server keeps dying:** check `rig exec -- 'dmesg | grep -i oom'`. Every box has swap as large as its RAM, so an app that outgrows memory slows down first. If it is still killed, cap the app's own memory, such as Node's `--max-old-space-size` or Next.js's `turbopackMemoryLimit`.
- **More memory or CPU:** set `RIG_BOX_CPU` and `RIG_BOX_MEMORY_MB` and run `rig image build` ([the box image](image.md#box-size)). A production build that needs more than the box's RAM is too slow on swap; give it a bigger box.
- **Extra tools:** add them to `~/.config/rig/image.sh` and rebuild ([adding your own tools](image.md#adding-your-own-tools)).
- **Several services:** point `dev` at a script that starts them all, and use `rig port` for each port.
- **Parallel agents on one branch:** `rig up --new` gives each its own box; pass `-b <id>` to the other commands.
