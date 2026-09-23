# Working on rig

Guide for contributors and coding agents. Users should start at [README.md](README.md).

## Commands

```bash
bun install
bun test              # all tests; no E2B account needed
bun run typecheck
bun run docs          # regenerate docs/commands.md after editing src/help.ts
bun link              # put your working copy on PATH as `rig`
```

## Where things live

The code map is in [docs/how-it-works.md](docs/how-it-works.md#code-map). Everything a user runs goes through `bin/rig` → `src/cli.ts`.

## Rules that keep rig safe

Break one of these and a hostile repo or website can reach the user's laptop or logins. Each has a test.

1. **Never run `src/cli.ts` directly in shipped code.** `bin/rig` must start Bun with `config/bunfig.toml` and `config/empty.env`, or a repo's `bunfig.toml` and `.env` load into rig.
2. **Read settings only through `setting()` in `src/key.ts`.** Never read `process.env.E2B_*`; rig deletes those at startup.
3. **Run local git only through `git()` / `gitBytes()` in `src/repo.ts`.** They switch off the repo's own hooks, fsmonitor, filters and lazy fetch.
4. **Upload files only through `uploadFiles()` in `src/sync.ts`.** It resolves symlinks and refuses anything outside the repo or under `.git`.
5. **Quote every value that goes into a box command with `q()`**, and print box output only through `src/sanitize.ts`.
6. **Create boxes only through `createBox()`**, which sets `allowPublicTraffic: false`.
7. **The local proxy binds to `127.0.0.1` and keeps its Host/Origin checks.**

## Conventions

- Bun and TypeScript, no build step. Keep functions short and give each file one job.
- Comments explain why, in one or two lines.
- User-facing text is plain English in full sentences. Errors say what to do next.
- Adding a command: add it to `COMMANDS` in `src/cli.ts`, to the top-level help, and to `COMMAND_HELP` in `src/help.ts`; then `bun run docs`.
- Changing the image: edit `src/image.ts`, pin versions, and update [docs/image.md](docs/image.md).
