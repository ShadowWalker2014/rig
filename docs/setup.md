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

There are two ways, and you can use both.

**The fast way: bring the logins you already have.** Sign in to sites in your normal browser, then copy them over ([details](cookies.md)):

```bash
rig cookies sites --from chrome                                     # see what is there
rig cookies push                                    # every site except banking and payments
```

macOS asks you to allow access to Chrome's cookie key: click **Allow**, not Always Allow. The cookies go into your default desktop, so every new box starts with them. Run it again whenever you sign in to something new. Add `--all` to include banking and payment sites too, or `--site a.com,b.com` for just some.

**The hands-on way: sign in inside the cloud desktop.** Needed for command-line tools, whose logins live in files rather than browser cookies.

```bash
rig new                  # starts an empty cloud desktop and prints its id
rig desktop <id>         # prints a private link; open it in any browser tab
```

You now see the cloud desktop's screen. Sign in to the things every task will need.

**In its Chrome:** GitHub, Vercel, Google, and your app's test accounts.

**1Password** is already installed (the Chrome extension and the `op` CLI). Sign in to it only for a single session, and sign out before `rig save` — see [security](security.md#the-default-desktop).

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

## 5. Save it as your default desktop

When you close the desktop link, rig reminds you with the exact command.

Close the desktop link (Ctrl-C in the terminal running `rig desktop`), then:

```bash
rig save <id>
```

Every new cloud desktop now starts from this one, already signed in. To add a login later, repeat steps 4 and 5 on a fresh `rig new`.

Keep several setups — for example one per client — with `rig save <id> --as client-a`. `rig saved` lists them, `rig saved use client-a` switches the default, and `rig new --from client-a` starts one box from it.

## 6. Teach your coding agent

rig ships with an agent skill: instructions that tell your coding agent to run dev servers, tests and browser checks in its cloud desktop, and how to hand the desktop to you for a login.

```bash
rig skill install                      # Claude Code: links the skill into ~/.claude/skills/rig
npx skills add ShadowWalker2014/rig    # or install it for Claude Code, Cursor, Codex, opencode and more
```

`rig skill install` keeps the skill in step with your rig version. For an agent without skill support, paste the output of `rig guide` into its instructions file, such as `AGENTS.md`.

## 7. Check everything

```bash
rig doctor
```

Every line should start with ✓. Then try a real repo:

```bash
cd my-repo
rig up              # the first time, it asks how the repo runs and which env files to copy
rig port 3000       # open http://localhost:3000
```

More in [using rig in a repo](projects.md).

## Next

- [Command reference](commands.md)
- [Costs, cleanup and running many boxes](cleanup-and-scale.md)
- [Security](security.md)
