---
name: rig
description: Run dev servers, tests, builds and browser checks in a cloud desktop instead of on the user's laptop. Use whenever you would start a dev server (`bun run dev`, `next dev`, `vite`), run a heavy test suite or build, or drive a browser against the app — the `rig` CLI moves that work to a pause-when-idle E2B box with a logged-in Chrome, so the laptop keeps its memory.
---

# rig — do the heavy work in a cloud desktop

You still read and edit code locally. Anything that runs the app — the dev server,
tests, type-checks, builds, and the browser — runs in the box for this repo and
branch. Every `rig` command below, run from inside the repo, targets that box.

## The loop

1. `rig up` — creates (or reuses) this branch's box, copies your local tree to it,
   installs packages if the lockfile changed, and starts the dev server. It prints
   the box id on stdout. Takes seconds when reusing a box.
   - **If it stops, do what it says.** Its errors end with the exact fix — for
     example signing GitHub in once for a private repo, which is the user's step.
   - In a repo without `rig.json`, run `rig init --yes` first. If the dev server
     needs a gitignored file like `.env.local`, ask the user before adding
     `--copy .env.local`: it usually holds secrets.
   - `rig status` shows the repo's settings and its box.
2. Edit files locally as usual.
3. `rig sync` — sends your edits (committed or not) to the box. The dev server
   hot-reloads. Run it after every batch of edits, before testing.
4. Test in the box:
   - `rig exec -- bun test src/foo.test.ts` — any command, in the repo folder, output streamed, exit code kept.
   - `rig exec -- 'bunx tsc --noEmit && bun run lint'` — one quoted argument runs as a shell line.
   - `rig logs` — the dev server's recent output, for compile and runtime errors.
5. Check the UI with the box's Chrome (already signed in to the user's accounts):
   - `rig browser -- open http://localhost:3000`
   - `rig browser -- snapshot -i` — interactive elements with refs (`@e3`)
   - `rig browser -- click @e3` / `fill @e5 "text"` / `console` / `errors`
   - `rig shot` — screenshot to a local PNG; the path is printed, so Read it to see the page.
   - `rig browser -- skills get core --full` prints the full agent-browser guide.
6. When the task is done, run `rig pause` (or leave it: it pauses by itself after 15
   idle minutes) — a paused box costs nothing. `rig kill` only if the branch is finished for good.

## Computer use: the whole screen

For anything outside a web page — a terminal window, a system dialog, a browser
extension such as 1Password, a file picker — use the whole desktop. Always look, act,
then look again:

- `rig screen` — screenshot the desktop (1440×900); Read the printed PNG path.
- `rig click <x> <y>` (`--right`, `--double`, `--triple`), `rig move <x> <y>`, `rig drag <x0> <y0> <x1> <y1>`.
- `rig type "text"` types into whatever has focus; `rig key Enter` / `ctrl+l` / `ctrl+shift+t`.
- `rig scroll <x> <y> down 5`; `rig zoom <x0> <y0> <x1> <y1>` for a 2× close-up of small text.

Coordinates are pixels in the latest `rig screen` image. Prefer `rig browser` inside a
web page: it reads the page's structure and is more reliable than clicking pixels.

If the user added rig as an MCP server (`claude mcp add rig -- rig mcp`), the
`computer`, `browser`, `shell` and `boxes` tools do the same things and return
screenshots as images.

## When a site needs a login

Any time a page in the box asks for a login, shows a sign-in wall, loops back to a
login page, or an API returns 401/403 because the session is missing or expired,
follow these steps in order. Do not try to type passwords, and do not guess.

1. **Ask the user to sign in on their own computer.** Say which site, for example:
   "linear.app needs a login in the cloud desktop. Please sign in to linear.app in
   your Chrome on this Mac, then tell me when you're done."
2. **Copy that login over, securely.** When they say they're done:

   ```bash
   rig cookies push --site linear.app -b <box> --force   # --force: this box ran the repo's code
   ```

   Tell them first: "macOS will ask for access to Chrome Safe Storage — please click
   **Allow**." You only ever see a count, never a cookie value; never try to read
   cookie values in the box. Use `--force` only for the user's own repos. Add
   `--from arc` (or their browser) if they don't use Chrome.
3. **Reload and check.** `rig browser -- reload`, then `rig shot` or `snapshot -i`
   to confirm you are signed in.
4. **If the site still refuses** — Google accounts do this, because they will not
   accept a session copied from another computer — hand over the screen: run
   `rig desktop` (it returns at once) and give the user the printed
   `http://127.0.0.1:…/vnc.html…` link so they can sign in inside the box
   themselves. The box stays awake while their tab is open. Wait for them to say they're done.
5. **Offer to keep it for next time.** Tell the user they can run
   `rig cookies push` to refresh the logins every new box starts with.

Never name banking or payment sites unless the user asks for exactly that;
`rig cookies push --all` is for the user to run themselves.

## Handing over to the user

For anything else only a person can do (a CAPTCHA, a 2FA code, a consent screen),
run `rig desktop` (it returns at once) and give the user the printed link. The box stays
awake while their tab is open; `rig desktop --stop` closes the link. It shows
the same Chrome you drive. Wait for them to say they're done.

## Saving a setup

When the user has finished setting up a clean box (signed in on `rig desktop`, pushed
cookies, installed tools), ask them: "Save this as your default desktop, so every new
box starts this way?" If they say yes, run `rig save <box>`. Never save without asking,
and never save a box that ran a repo's code — it copies everything in the box into
every future box.

Saved desktops work like contexts:
- `rig saved` lists them (`*` is the default); `rig status` shows the default and boxes.
- `rig save <box> --as <name>` keeps another setup; `rig saved use <name>` switches the default.
- `rig new --from <name>` / `rig up --from <name>` starts one box from a specific setup.

1Password (the Chrome extension and the `op` CLI) is installed in every box. If the
user needs a password filled, ask them to use the 1Password extension on `rig desktop`;
never ask for passwords yourself. Never save a box while 1Password is signed in: ask
the user to sign out of it first, or every future box would carry their vault session.

## Rules

- Never start a dev server, Playwright, Chrome or a full test suite on the laptop when a box is available.
- Always `rig sync` before `rig exec` or `rig browser` after editing, or you will test stale code.
- `rig port 3000` (in the background) serves the box's port on the laptop's localhost if the user wants to open the app themselves.
- Parallel work on the same branch: `rig up --new` gives you a separate box; pass `-b <id>` to every command after that.
- If `rig` says there is no E2B key, ask the user to run `rig login`. Never ask for the key itself.
