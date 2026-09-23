# Bring your logins from your own browser

Sign in to anything in the browser you already use, then copy those sign-ins into your cloud desktops with one command. Run it again whenever you sign in to something new, so the latest logins are always there.

```bash
rig cookies push
```

That copies every site from Chrome **except** banking and payments — including your Google, GitHub and email logins — into your **default desktop**, so every new cloud desktop starts signed in.

## The options

| Command | What it copies |
|---|---|
| `rig cookies push` | Every site except banking and payments |
| `rig cookies push --all` | Every site, banking and payments too. You confirm at the terminal first. |
| `rig cookies push --site github.com,linear.app` | Only those sites. Naming a site is your consent for it. |
| `rig cookies push --skip vercel.com,notion.so` | The default set, minus the sites you list |

| Add | To |
|---|---|
| `--from arc` or `--from chrome:Work` | Use another browser or profile (the name the browser shows, or its folder like `"Profile 1"`) |
| `-b <box>` | Update one running cloud desktop instead of your default desktop |

See what is there first — neither command reads a cookie value or asks for access:

```bash
rig cookies browsers                 # browsers and profiles on this Mac
rig cookies sites --from chrome      # sites with cookie counts, and which ones are left out by default
```

## What is left out by default

Only **banking and payments**: banks, brokers, crypto exchanges and payment companies such as Chase, Stripe, PayPal, Brex, Ramp, Mercury, Wise and Coinbase. Everything else goes, including Google, Microsoft and Apple sign-ins, email, and GitHub.

Add `--all` to include banking and payments too, or name one with `--site`. Leave out anything else — such as your company's own sign-in page — with `--skip`.

## When a copied login doesn't work

Some sites refuse a session copied from another computer. **Google accounts do**: the account list appears, but each account shows "Signed out". For those, sign in once inside the cloud desktop and save it:

```bash
rig desktop <box>     # open the link and sign in to Google in that Chrome
rig save <box>        # every new cloud desktop now starts signed in
```

## Supported browsers

Google Chrome, Microsoft Edge, Brave, Arc, Comet, Chromium, Vivaldi, Opera, Firefox and Safari on macOS. Safari needs your terminal to have Full Disk Access (System Settings → Privacy & Security).

## How your cookies stay safe

- **rig never shows a cookie value.** It prints only site names and counts. Values are never logged, never put on a command line, and never written to disk on your laptop.
- **You approve Chrome-family imports.** macOS asks you to allow access to the browser's cookie key each time. Click **Allow**, not **Always Allow**: Always Allow lets any program on your Mac read that key without asking. Firefox and Safari have no such prompt.
- **Banking and payments need a person.** `--all` asks you to confirm at the terminal and refuses to run from an agent or script. An agent can push only the default set or sites it names.
- **The path is short.** Cookies are decrypted in memory, sent over E2B's authenticated, encrypted connection, and handed straight to the cloud desktop's Chrome through its local debugging port. Partitioned and Firefox-container cookies stay behind.
- **Boxes that ran a repo's code are refused** with `-b` unless you add `--force`, because that code could read the cookies.

**Once imported, a cookie belongs to that cloud desktop.** It is stored in its Chrome profile, and anything that can run commands in that cloud desktop can read it — including a coding agent you give it to, and the install scripts of repos you run there. Every box you start from your default desktop gets a copy. That is why banking and payment sessions stay out by default. Your Google and email sessions go by default, so treat a cloud desktop like a signed-in laptop.

## For AI agents

An agent that hits a login page can bring that one site into the box it is working in:

```bash
rig cookies push --site linear.app -b <box> --force
```

The agent sees only "Imported 12 cookies for 1 site". The user still approves the macOS prompt for Chrome-family browsers.
