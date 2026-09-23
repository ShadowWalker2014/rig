# Security

rig handles two valuable things: your E2B API key, and the logins inside your boxes. This page says how each is protected and what you still need to decide.

## Your E2B API key

- rig reads it from your shell (`RIG_E2B_API_KEY`), from `~/.config/rig/.env`, or from the macOS Keychain (`rig login`). It never reads a key from the repo you run it in.
- `rig login` lets the Keychain prompt for the key, so it never appears in your shell history or process list.
- `~/.config/rig/.env` must be readable only by you (`chmod 600`); rig refuses it otherwise.
- rig ignores every `E2B_*` variable, so a project that uses E2B for its own product cannot point rig at another account.
- Anyone with your key controls all your boxes. Revoke it in the E2B dashboard if it leaks.

## Running rig inside a repo you don't trust

rig runs on your laptop inside whatever repo you are in. A hostile repo cannot use that to run code on your laptop or read your files:

| Attack | Why it fails |
|---|---|
| A `bunfig.toml` that preloads a script | `bin/rig` starts Bun with rig's own empty config |
| A `.env` that sets rig's key or E2B address | `bin/rig` starts Bun with an empty env file |
| `.git/config` fsmonitor, hooks, clean filters, external diff, lazy fetch | rig runs git with all of them switched off |
| `rig.json` → `copy` pointing at `../..`, `/etc`, or through a committed folder symlink | Every path is resolved first; anything outside the repo, any symlink, and anything under `.git` is skipped |
| A token inside the remote URL | Stripped before the URL reaches the box |
| Box output with terminal escape codes | Everything but colours is removed before printing |

What a hostile repo **can** do is run its own install and dev scripts inside its box, next to your golden logins. Only run `rig up` on repos you would trust to run `npm install` on your laptop.

## Box ports

- Every box is created with `allowPublicTraffic: false`. E2B only forwards requests that carry the box's access token.
- `rig port` and `rig desktop` listen on `127.0.0.1` only. They refuse requests whose `Host` isn't `localhost`/`127.0.0.1` (DNS rebinding) and requests started by other websites. `rig port` still lets plain links and redirects in, like a local dev server, so OAuth callbacks work.
- The desktop also asks for a one-time password. It is written to the box as a file that x11vnc deletes on reading, and it sits in the link's `#fragment`, which browsers never send to a server.
- The access token reaches every port on the box, including Chrome's debugging port. It is as powerful as the logins in the box. rig keeps it in memory only.

## The golden snapshot

- It copies every login in it into every new box. Sign in only to what you are comfortable having everywhere. Keep bank, payment and production-write accounts out; use scoped tokens where you can.
- `rig snap --promote` refuses a box that ran a repo's code unless you add `--force`, and stops the desktop viewer first so no password or open session is copied.

## The image

Chrome, Node, gh, gcloud and stripe come from their vendors' signed apt repositories; npm tools, flyctl and uv are pinned. The Ubuntu base, Homebrew and the AWS CLI installers are fetched at build time without a pinned hash.

## Reporting a vulnerability

Please open a private [security advisory](https://github.com/ShadowWalker2014/rig/security/advisories/new) rather than a public issue.
