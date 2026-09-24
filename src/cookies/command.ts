import type { SandboxInfo } from 'e2b'
import { str, type Args } from '../args'
import { createBox, killBox, openBox, resolveBox, snapshotBox } from '../box'
import { boxRef } from '../commands'
import { onInterrupt } from '../cleanup'
import { clean } from '../sanitize'
import { defaultName } from '../saved'
import { stopViewer } from '../services'
import { pushCookies } from './push'
import { findProfile, listProfiles, readCookies, type Cookie, type Profile } from './read'
import { chooseCookies, includes, listSites, siteOf, type Choice } from './sites'

const table = (rows: string[][]) => {
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => r[i]!.length)))
  for (const r of rows) console.log(r.map((c, i) => c.padEnd(widths[i]!)).join('  ').trimEnd())
}

export async function cookies(a: Args): Promise<void> {
  const sub = a.sub[0]
  if (sub === 'browsers') return browsers()
  if (sub === 'sites') return sites(a)
  if (sub === 'push') return push(a)
  throw new Error('Usage: rig cookies push [--site a.com,b.com | --all] [--skip c.com] [--from chrome] [-b box]. See `rig help cookies`.')
}

function browsers(): void {
  const profiles = listProfiles()
  if (profiles.length === 0) return void console.log('No supported browser profiles found on this machine.')
  table([['USE WITH --from', 'BROWSER', 'PROFILE'], ...profiles.map((p) => [clean(`${p.browser}:${p.profile}`), p.browserName, clean(p.profileName)])])
}

async function sites(a: Args): Promise<void> {
  const rows = await listSites(findProfile(str(a.flags.from) ?? 'chrome'))
  const limit = Number(str(a.flags.limit) ?? 100)
  table([['SITE', 'COOKIES', 'LEFT OUT BY DEFAULT'], ...rows.slice(0, limit).map((r) => [clean(r.site), String(r.cookies), r.sensitive ?? ''])])
  if (rows.length > limit) console.log(`… and ${rows.length - limit} more sites. Use --limit.`)
}

const csv = (v: string | true | undefined) => (str(v) ?? '').split(',').map((s) => s.trim()).filter(Boolean)

// Values travel from the browser's cookie store, through memory, over E2B's
// authenticated connection, into the box's Chrome. rig prints only site names and counts.
async function push(a: Args): Promise<void> {
  const choice: Choice = { sites: csv(a.flags.site), skip: csv(a.flags.skip), all: Boolean(a.flags.all || a.flags['include-sensitive']) }
  if (choice.sites.length && (choice.all || choice.skip.length)) throw new Error('--site names exactly what to copy, so it cannot be combined with --all or --skip.')
  // Banking and payment sessions only move with a person at the terminal.
  if (choice.all && !process.stdin.isTTY) {
    throw new Error('--all includes banking and payment sessions, so it needs a person at a terminal to confirm. Name sites with --site instead.')
  }
  const ref = boxRef({ ...a, sub: a.sub.slice(1) })
  const box = ref ? await pickBox(ref, a) : undefined
  const profile = findProfile(str(a.flags.from) ?? 'chrome')
  if (!(await confirm(profile, choice, a))) return void console.error('Nothing sent.')
  console.error(`Reading ${profile.browserName} (${clean(profile.profileName)}). If macOS asks for access, click Allow, not Always Allow.`)
  const { cookies: all, unreadable } = await readCookies(profile)
  const chosen = chooseCookies(all, choice)
  if (unreadable) console.error(`${unreadable} cookies could not be decrypted and were skipped.`)
  if (chosen.length === 0) throw new Error('None of the chosen sites have cookies in that profile. See `rig cookies sites`.')
  if (!box) return pushToDefault(chosen)
  report(await pushCookies(await openBox(box.sandboxId, 300_000), chosen), chosen, box.sandboxId)
}

// A box that ran a repo's install or dev scripts could read the cookies and send
// them anywhere, so it needs --force. Clean boxes from `rig new` do not.
async function pickBox(ref: string, a: Args): Promise<SandboxInfo> {
  const box = await resolveBox(ref)
  if (box.metadata.repo && !a.flags.force) {
    throw new Error(`Box ${box.sandboxId} has run code from ${box.metadata.repo}, which could read these cookies. Use a box from \`rig new\`, leave out -b to use your default desktop, or add --force if you trust that repo.`)
  }
  return box
}

// Shows exactly which sites will be sent, before any cookie is decrypted.
async function confirm(profile: Profile, choice: Choice, a: Args): Promise<boolean> {
  const rows = await listSites(profile)
  const going = rows.filter((r) => includes(r.site, choice))
  const held = rows.filter((r) => r.sensitive && !includes(r.site, choice))
  if (going.length === 0) throw new Error('None of the chosen sites have cookies in that profile. See `rig cookies sites`.')
  console.error(`From ${profile.browserName} (${clean(profile.profileName)}), rig will copy cookies for ${going.length} site${going.length === 1 ? '' : 's'}:`)
  console.error(`  ${going.slice(0, 12).map((r) => clean(r.site)).join(', ')}${going.length > 12 ? `, and ${going.length - 12} more` : ''}`)
  const risky = going.filter((r) => r.sensitive)
  if (risky.length) console.error(`  Including sensitive: ${risky.map((r) => `${clean(r.site)} (${r.sensitive})`).join(', ')}`)
  if (held.length) console.error(`  Left out: ${held.slice(0, 8).map((r) => clean(r.site)).join(', ')}${held.length > 8 ? ` and ${held.length - 8} more` : ''} (banking and payments). Add --all to include them.`)
  // Only a sensitive push waits for a typed yes; the everyday default just goes.
  if (!choice.all || a.flags.yes) return true
  process.stderr.write('Send them? [y/N] ')
  for await (const line of console) return /^y(es)?$/i.test(line.trim())
  return false
}

// Starts a box from the default desktop, adds the cookies, and saves it as the new
// default desktop. The temporary box is deleted even if you press Ctrl-C.
async function pushToDefault(chosen: Cookie[]): Promise<void> {
  const sbx = await createBox({ name: 'rig-cookie-refresh', purpose: 'cookie-refresh' })
  const cleanup = () => killBox(sbx.sandboxId).catch((e: Error) => console.error(`Could not delete ${sbx.sandboxId}: ${e.message}. Run \`rig kill ${sbx.sandboxId}\`.`))
  const forget = onInterrupt(cleanup)
  try {
    report(await pushCookies(sbx, chosen), chosen, sbx.sandboxId)
    await stopViewer(sbx)
    await snapshotBox(sbx.sandboxId, defaultName())
    console.error(`Saved as your default desktop "${defaultName()}". New boxes start with these logins.`)
  } finally {
    forget()
    await cleanup()
  }
}

function report(r: { imported: number; failed: number }, chosen: Cookie[], id: string): void {
  const sites = new Set(chosen.map((c) => siteOf(c.host))).size
  console.error(`Imported ${r.imported} cookies for ${sites} site${sites === 1 ? '' : 's'} into ${id}${r.failed ? `; Chrome refused ${r.failed}` : ''}.`)
}
