# Bring your logins from your own browser

Sign in to anything in the browser you already use, then copy those sign-ins into your cloud desktops with one command. Run it again whenever you sign in to something new, so the latest logins are always there.

```bash
rig cookies push
```

That copies every site from Chrome **except** banking and payments, email, and sign-in and password managers, into your **default desktop** — so every new cloud desktop starts signed in.

## The options

| Command | What it copies |
|---|---|
| `rig cookies push` | Every site except banking and payments, email, and sign-in and password managers |
| `rig cookies push --all` | Every site, the sensitive ones too. You confirm at the terminal first. |
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

## What "sensitive" means

Left out unless you add `--all` or name them with `--site`:

- **Banking and payments:** banks, brokers, crypto exchanges and payment companies such as Chase, Stripe, PayPal, Brex, Ramp, Mercury, Wise and Coinbase.
- **Email:** Gmail, Outlook, Yahoo Mail, Proton Mail, iCloud and similar.
- **Sign-in and passwords:** Google and Microsoft account pages, Apple ID, Okta, Auth0, and password managers such as 1Password and Bitwarden.

rig cannot recognise your company's own sign-in or email domains; leave those out with `--skip`.

A Google session on `google.com` itself still signs a browser in to Google services. It goes with the default set, like in blink-code's importer. Add `--skip google.com` if a cloud desktop should not have it.

## Supported browsers

Google Chrome, Microsoft Edge, Brave, Arc, Comet, Chromium, Vivaldi, Opera, Firefox and Safari on macOS. Safari needs your terminal to have Full Disk Access (System Settings → Privacy & Security).

## How your cookies stay safe

- **rig never shows a cookie value.** It prints only site names and counts. Values are never logged, never put on a command line, and never written to disk on your laptop.
- **You approve Chrome-family imports.** macOS asks you to allow access to the browser's cookie key each time. Click **Allow**, not **Always Allow**: Always Allow lets any program on your Mac read that key without asking. Firefox and Safari have no such prompt.
- **Sensitive sites need a person.** `--all` asks you to confirm at the terminal and refuses to run from an agent or script. An agent can push only the default set or sites it names.
- **The path is short.** Cookies are decrypted in memory, sent over E2B's authenticated, encrypted connection, and handed straight to the cloud desktop's Chrome through its local debugging port. Partitioned and Firefox-container cookies stay behind.
- **Boxes that ran a repo's code are refused** with `-b` unless you add `--force`, because that code could read the cookies.

**Once imported, a cookie belongs to that cloud desktop.** It is stored in its Chrome profile, and anything that can run commands in that cloud desktop can read it — including a coding agent you give it to, and the install scripts of repos you run there. Every box you start from your default desktop gets a copy. That is why banking, email and sign-in sessions stay out by default.

## For AI agents

An agent that hits a login page can bring that one site into the box it is working in:

```bash
rig cookies push --site linear.app -b <box> --force
```

The agent sees only "Imported 12 cookies for 1 site". The user still approves the macOS prompt for Chrome-family browsers.
