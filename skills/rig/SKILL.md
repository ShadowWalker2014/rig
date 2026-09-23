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
6. When the task is done, leave the box: it pauses by itself after 15 idle minutes
   and costs nothing paused. `rig kill` only if the branch is finished for good.

## Signing in to a site

If a page in the box needs a login the user already has in their own browser, bring just that site:

```bash
rig cookies push --site linear.app -b <box> --force   # --force: the box ran the repo's code
```

Use `--force` only for the user's own repos. macOS asks the user to approve access to their browser's cookies; tell them to click **Allow**. You only ever see a count — never try to read cookie values in the box. Never name banking, payments, email or sign-in sites unless the user asks for exactly that; `--all` is for the user to run themselves.

To refresh the logins every new box starts with, the user runs `rig cookies push` (it goes into their default desktop).

## Handing over to the user

If a page needs a human (a login, a CAPTCHA, a 2FA prompt), run `rig desktop` in the
background and give the user the printed `http://127.0.0.1:…/vnc.html…` link. It
shows the same Chrome you drive. Wait for them to say they're done.

If every future box should have a new login, tell the user to sign in on a clean
box (`rig new`, then `rig desktop <id>`) and save that one with `rig save <id>`.
Never save a box that has run a repo's code, and only run `rig save` when the user
asks, because it copies every login in the box into every future box.

## Rules

- Never start a dev server, Playwright, Chrome or a full test suite on the laptop when a box is available.
- Always `rig sync` before `rig exec` or `rig browser` after editing, or you will test stale code.
- `rig port 3000` (in the background) serves the box's port on the laptop's localhost if the user wants to open the app themselves.
- Parallel work on the same branch: `rig up --new` gives you a separate box; pass `-b <id>` to every command after that.
- If `rig` says there is no E2B key, ask the user to run `rig login`. Never ask for the key itself.
