# Computer use: let Claude use the whole desktop

A cloud desktop is a real Linux screen. Besides driving its Chrome, an agent can see the whole screen and use the mouse and keyboard — the same actions as Claude's computer-use tool — for anything outside the browser: a terminal window, a dialog, a native app, a browser extension.

<p align="center"><img src="../assets/computer-use.svg" alt="The computer-use loop: the agent takes a screenshot of the cloud desktop, decides where to click or what to type, acts, and takes another screenshot to check." width="100%"></p>

There are two ways to use it: **commands**, which any agent or person can run, and an **MCP server**, which gives Claude Code native tools that return screenshots as images.

## Commands

| Command | Does |
|---|---|
| `rig screen [out.png]` | Screenshot the whole desktop (1440×900) and print the file path |
| `rig click <x> <y>` | Click; add `--right`, `--middle`, `--double` or `--triple` |
| `rig type "text"` | Type into whatever has focus |
| `rig key <keys>` | Press keys: `Enter`, `Tab`, `Escape`, `ctrl+l`, `ctrl+shift+t`, `cmd+a`, `F5`, `PageDown` |
| `rig scroll <x> <y> [up\|down\|left\|right] [n]` | Scroll at a point (default down, 3) |
| `rig move <x> <y>` | Move the mouse, e.g. to open a hover menu |
| `rig drag <x0> <y0> <x1> <y1>` | Press, move, release |
| `rig zoom <x0> <y0> <x1> <y1> [out.png]` | Enlarged (2×) close-up of one region, for small text |
| `rig cursor` | Where the mouse is |

Each acts on this repo + branch's box, or `-b <box>`. Coordinates are pixels in the `rig screen` image.

The loop is always the same: **look, act, look again.**

```bash
rig screen                       # prints /tmp/rig-screen-….png — read it
rig click 640 88                 # act on what you saw
rig key ctrl+l
rig type "http://localhost:3000"
rig key Enter
rig screen                       # check it worked
```

## The MCP server, for Claude Code

```bash
claude mcp add rig -- rig mcp
```

Claude Code then has four tools, and sees screenshots directly as images:

| Tool | What it does |
|---|---|
| `computer` | Claude's computer-use actions on the desktop: `screenshot`, `left_click`, `right_click`, `double_click`, `triple_click`, `mouse_move`, `left_click_drag`, `scroll`, `type`, `key`, `zoom`, `cursor_position`, `wait`. Every action returns a fresh screenshot. |
| `browser` | [agent-browser](https://github.com/vercel-labs/agent-browser) commands in the signed-in Chrome, e.g. `["open", "http://localhost:3000"]`, `["snapshot", "-i"]`, `["click", "@e3"]`. `["screenshot"]` returns the page as an image. |
| `shell` | Run a command in the box, in the repo's folder by default |
| `boxes` | List your cloud desktops |

Tools act on the box named in the call, else the one `rig mcp -b <box>` was started for, else the box for the repo and branch Claude Code was started in. The server speaks the Model Context Protocol over stdio, so any MCP client can use it.

## Browser or computer use?

| Use | For |
|---|---|
| `rig browser` (or the `browser` tool) | Anything inside a web page. It reads the page's structure, so it is faster and more reliable than clicking pixels. |
| `rig screen` + `rig click` (or the `computer` tool) | Everything else: terminal windows, system dialogs, browser extensions such as 1Password, file pickers, native apps — or a page that fights automation. |

## Good to know

- The screen is 1440×900. Screenshots are PNG, about 150 KB.
- `rig key` names follow Claude's computer-use tool: `Enter`, `Escape`, `ctrl+l`, `cmd+…` (the Linux super key).
- Actions keep the box awake like any rig command. When a person should take over instead, use [`rig desktop`](../README.md#take-over-the-desktop).
- Anything that can use the desktop can use its signed-in Chrome and apps. Keep the same care as with the [default desktop](security.md#the-default-desktop).
