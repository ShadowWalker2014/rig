# First-time setup

About 20 minutes, most of it waiting for the image to build. At the end, every new cloud desktop starts with your tools installed and your accounts signed in.

## 1. Install rig

You need [Bun](https://bun.sh) 1.2+ and an [E2B](https://e2b.dev) account.

```bash
bun add -g github:ShadowWalker2014/rig
```

## 2. Add your E2B key

Create a key in the [E2B dashboard](https://e2b.dev/dashboard?tab=keys). Use a new key just for rig.

```bash
rig login     # macOS: the Keychain asks for the key, so it never shows on screen
```

On Linux, copy [.env.example](../.env.example) to `~/.config/rig/.env`, run `chmod 600 ~/.config/rig/.env`, and set `RIG_E2B_API_KEY` in it.

## 3. Build the image

```bash
rig image build    # once, about 10 minutes
```

This builds the Linux image every cloud desktop starts from: a desktop, Chrome, and the usual CLIs ([full list](image.md)). To add your own tools, put a script at `~/.config/rig/image.sh` first ([how](image.md#adding-your-own-tools)).

## 4. Sign in to your tools, once

```bash
rig new                  # starts an empty cloud desktop and prints its id
rig desktop <id>         # prints a private link; open it in any browser tab
```

You now see the cloud desktop's screen. Sign in to the things every task will need.

**In its Chrome:** GitHub, Vercel, Google, and your app's test accounts.

**In its terminal** (Applications → Terminal), run the ones you use:

```bash
gh auth login
vercel login
railway login
fly auth login
wrangler login
gcloud auth login
aws configure sso
stripe login
claude
codex login
```

A CLI login that needs a browser opens a Chrome window on the same screen; finish it there.

**Keep these out:** your bank and card accounts, live payment dashboards, and production database write access. Every future cloud desktop gets a copy of whatever you sign in to here. Use scoped tokens where you can, like a GitHub token limited to specific repos.

## 5. Save it as your golden snapshot

Close the desktop link (Ctrl-C in the terminal running `rig desktop`), then:

```bash
rig snap <id> --promote
```

Every new cloud desktop now starts from this one, already signed in. To add a login later, repeat steps 4 and 5 on a fresh `rig new`.

## 6. Teach your coding agent

```bash
rig skill install     # Claude Code: links the rig skill into ~/.claude/skills/rig
```

The skill ships inside rig, so it always matches your rig version. For other agents (Codex, Cursor, opencode), paste the output of `rig guide` into their instructions file, such as `AGENTS.md`.

## 7. Check everything

```bash
rig doctor
```

Every line should start with ✓. Then try a real repo:

```bash
cd my-repo
rig up
rig port 3000       # open http://localhost:3000
```

If the dev server needs gitignored files like `.env.local`, add a `rig.json` to the repo: `{ "copy": [".env.local"] }`.

## Next

- [Command reference](commands.md)
- [Costs, cleanup and running many boxes](cleanup-and-scale.md)
- [Security](security.md)
