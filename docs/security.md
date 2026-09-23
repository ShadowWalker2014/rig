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

What a hostile repo **can** do is run its own install and dev scripts inside its box, next to the logins in your default desktop. Only run `rig up` on repos you would trust to run `npm install` on your laptop.

## Box ports

- Every box is created with `allowPublicTraffic: false`. E2B only forwards requests that carry the box's access token.
- `rig port` and `rig desktop` listen on `127.0.0.1` only. They refuse requests whose `Host` isn't `localhost`/`127.0.0.1` (DNS rebinding) and requests started by other websites. `rig port` still lets plain links and redirects in, like a local dev server, so OAuth callbacks work.
- The desktop also asks for a one-time password. It is written to the box as a file that x11vnc deletes on reading, and it sits in the link's `#fragment`, which browsers never send to a server.
- The access token reaches every port on the box, including Chrome's debugging port. It is as powerful as the logins in the box. rig keeps it in memory only.

## Copying cookies from your browser

`rig cookies push` decrypts cookies in memory on your laptop and sends them over E2B's encrypted connection straight into a cloud desktop's Chrome. rig never prints, logs or writes a value on your laptop. By default it leaves out banking and payment sites; `--all` includes them only after you confirm at a terminal. Email and sign-in sessions, such as your Google account, go by default. For Chrome-family browsers macOS asks you to approve access each time; click Allow, not Always Allow.

Once in a cloud desktop, cookies live in its Chrome profile on its disk (with a fixed, publicly known key, as Chrome uses on Linux without a keyring). Anything that can run commands there — a coding agent, a repo's install scripts — can read them. Details in [cookies.md](cookies.md).

## The default desktop

- If you sign in to 1Password in the desktop you save, every box started from it has your unlocked vault while 1Password stays unlocked — and so does any agent or repo code running there. Consider a separate vault or account with only the logins your cloud desktops need.

- It copies every login in it into every new box. Sign in only to what you are comfortable having everywhere. Keep bank, payment and production-write accounts out; use scoped tokens where you can.
- `rig save` refuses a box that ran a repo's code unless you add `--force`, and stops the desktop viewer first so no password or open session is copied.

## The image

Chrome, Node, gh, gcloud and stripe come from their vendors' signed apt repositories; npm tools, flyctl and uv are pinned. The Ubuntu base, Homebrew and the AWS CLI installers are fetched at build time without a pinned hash.

## Reporting a vulnerability

Please open a private [security advisory](https://github.com/ShadowWalker2014/rig/security/advisories/new) rather than a public issue.
