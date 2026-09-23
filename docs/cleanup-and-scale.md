# Costs, cleanup and running many boxes

## What you pay for

| Box state | Cost on E2B |
|---|---|
| Running | About $0.33 an hour for 4 CPUs / 8 GB ([E2B pricing](https://e2b.dev/pricing)) |
| Paused | Nothing. Memory and disk are kept. |
| Deleted | Nothing. Gone for good. |

Boxes pause themselves after 15 minutes without a rig command, so an idle box costs at most 15 minutes of running time. Change the window with `RIG_IDLE_MIN` in `~/.config/rig/.env`.

## Cleaning up

Paused boxes are free, but they pile up. Clean up with one command:

```bash
rig prune                        # preview: paused boxes not used for 7 days
rig prune --yes                  # delete them
rig prune --older-than 2d --yes  # a shorter window
rig prune --merged --yes         # also boxes of this repo whose branch is gone from origin
```

`rig prune` never touches a running box, except with `--merged` when its branch is deleted.

A good habit: after merging a PR, run `rig prune --merged --yes` in that repo.

## Bulk actions

Every bulk command takes the same filters, applied on E2B's side:

| Filter | Matches |
|---|---|
| `--state running` or `--state paused` | Boxes in that state |
| `--older-than 7d` | Boxes not used for that long (`30m`, `12h`, `7d`) |
| `--repo owner/name` | Boxes for a repo |
| `--branch name` | Boxes for a branch |
| `--here` | Boxes for the repo you are in |
| `--all` | Every rig box |

```bash
rig ls --state running                       # what is costing money right now
rig pause --all                              # stop the meter on everything
rig kill --repo acme/web --state paused      # preview what would be deleted
rig kill --repo acme/web --state paused --yes
rig ls --ids --older-than 30d | xargs rig kill   # scripts: ids on stdout, one per line
```

`rig kill` with a filter always previews first and only deletes with `--yes`. Naming boxes (`rig kill abc123 def456`) deletes them at once.

## Thousands of boxes

- Listing asks E2B for 100 boxes per page and filters on E2B's side, so `rig ls --repo x` stays fast however many boxes you have. `rig ls` shows the 50 newest; use `--limit` or filters for more.
- Naming a box by its full id is one direct lookup, not a list.
- Bulk actions run 8 at a time. Rate-limit answers from E2B are retried with backoff. A box that fails never stops the rest, and rig reports how many failed.
- E2B limits how many boxes can run at once (100 on Pro). Paused boxes do not count.

## Snapshots

```bash
rig snaps                 # list snapshots, including your default desktop
rig snaps rm <id>         # delete one (your default desktop needs --force)
```

## Everything at once

```bash
rig kill --all --yes      # delete every rig box
```
