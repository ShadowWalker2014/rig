import { getDomain } from 'tldts'
import { withCopy, type Cookie, type Profile } from './read'
import { readSafariCookies } from './safari'

// Banking and payment sites are left out unless you add --all or name them with
// --site. Everything else, including email and sign-in pages, goes by default.
const TLD = '\\.[a-z]{2,6}(\\.[a-z]{2})?$'
const names = (list: string) => new RegExp(`(^|\\.)(${list})${TLD}`, 'i')

const SENSITIVE: { test: RegExp; category: string }[] = [
  {
    category: 'banking and payments',
    test: names('chase|wellsfargo|bankofamerica|citi|citibank|capitalone|americanexpress|amex|jpmorgan|hsbc|barclays|schwab|fidelity|vanguard|coinbase|robinhood|stripe|paypal|venmo|wise|revolut|mercury|brex|ramp|square|squareup|plaid|monzo|n26|santander|lloyds|natwest|rbc|td|bmo|scotiabank|ing|bnpparibas|ubs|kraken|binance|gemini|klarna|affirm|cash|zelle|wealthfront|betterment|etrade|interactivebrokers|sofi|chime|ally|discover|usbank|pnc|truist'),
  },
]

const bare = (host: string) => host.replace(/^\./, '').toLowerCase()

export const sensitiveCategory = (host: string) => SENSITIVE.find((s) => s.test.test(bare(host)))?.category

// The site a host belongs to, by the public suffix list: google.com for
// .www.google.com, alice.github.io (not github.io) for alice.github.io.
export function registrable(host: string): string {
  return getDomain(bare(host), { allowPrivateDomains: true }) ?? bare(host)
}

// How a cookie's host is shown and chosen: by site, so accounts.google.com and
// mail.google.com both belong to google.com.
export const siteOf = (host: string): string => registrable(host)

export type Choice = { sites: string[]; skip: string[]; all: boolean }

// --site: exactly those sites (naming one is consent). Otherwise every site,
// minus --skip, minus the sensitive ones unless --all.
export function includes(host: string, choice: Choice): boolean {
  const site = siteOf(host)
  const named = (list: string[]) => list.some((s) => siteOf(s) === site)
  if (choice.sites.length > 0) return named(choice.sites)
  if (named(choice.skip)) return false
  return choice.all || !sensitiveCategory(host)
}

export function chooseCookies(cookies: Cookie[], choice: Choice): Cookie[] {
  const now = Date.now() / 1000
  return cookies.filter((c) => c.value && (c.expires === undefined || c.expires > now) && includes(c.host, choice))
}

export type SiteRow = { site: string; cookies: number; sensitive?: string }

// Counts cookies per site from host names alone, so listing never decrypts a
// value and never asks for Keychain access.
export async function listSites(p: Profile): Promise<SiteRow[]> {
  const all = p.browser === 'safari' ? readSafariCookies(p.cookiesPath).map((c) => c.host) : await sqliteHosts(p)
  const rows = new Map<string, SiteRow>()
  for (const host of all) {
    const site = siteOf(host)
    const row = rows.get(site) ?? { site, cookies: 0, sensitive: sensitiveCategory(host) }
    row.cookies++
    rows.set(site, row)
  }
  return [...rows.values()].sort((a, b) => b.cookies - a.cookies)
}

function sqliteHosts(p: Profile): Promise<string[]> {
  const sql = p.browser === 'firefox' ? 'select host from moz_cookies' : 'select host_key as host from cookies'
  return withCopy(p, (db) => (db.query(sql).all() as { host: string }[]).map((r) => r.host))
}
