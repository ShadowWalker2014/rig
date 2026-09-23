// End-to-end check against real E2B boxes. Costs a few cents; needs your E2B key.
// Run with `bun run e2e`. Creates boxes named e2e-*, and deletes them at the end.
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const RIG = join(import.meta.dir, '..', 'bin', 'rig')
const results: { step: string; ok: boolean; ms: number; note: string }[] = []

async function rig(args: string[], opts: { cwd?: string; env?: Record<string, string> } = {}) {
  const p = Bun.spawn([RIG, ...args], { cwd: opts.cwd, env: { ...process.env, ...opts.env }, stdout: 'pipe', stderr: 'pipe' })
  const [out, err] = [await new Response(p.stdout).text(), await new Response(p.stderr).text()]
  return { code: await p.exited, out: out.trim(), err: err.trim() }
}

async function step(name: string, fn: () => Promise<string | void>) {
  const t = Date.now()
  try {
    const note = (await fn()) ?? ''
    results.push({ step: name, ok: true, ms: Date.now() - t, note })
    console.log(`✓ ${name} (${((Date.now() - t) / 1000).toFixed(1)}s) ${note}`)
  } catch (e) {
    results.push({ step: name, ok: false, ms: Date.now() - t, note: (e as Error).message.slice(0, 300) })
    console.log(`✗ ${name}: ${(e as Error).message.slice(0, 300)}`)
  }
}

const must = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(msg)
}

// A local proxy started in the background; resolves once it prints its URL.
async function background(args: string[], cwd?: string) {
  const p = Bun.spawn([RIG, ...args], { cwd, stdout: 'pipe', stderr: 'pipe' })
  const reader = p.stdout.getReader()
  const { value } = await reader.read()
  return { url: new TextDecoder().decode(value).trim(), stop: () => p.kill('SIGTERM') }
}

const TOOLS = ['railway', 'aws', 'blink', 'fly', 'git', 'whisper', 'vercel', 'wrangler', 'bun', 'npm', 'pnpm', 'py', 'brew',
  'claude', 'codex', 'opencode', 'resend', 'gcloud', 'gh', 'stripe', 'e2b', 'node', 'playwright', 'agent-browser', 'ffmpeg',
  'psql', 'redis-cli', 'uv', 'jq', 'rg', 'git-lfs']

async function main() {
  let toolsBox = ''
  await step('doctor', async () => {
    const r = await rig(['doctor'])
    must(r.out.includes('✓ E2B accepts the key') && r.out.includes('✓ base image'), r.out)
  })
  await step('new box (desktop + Chrome ready)', async () => {
    const r = await rig(['new', '--name', 'e2e-tools'])
    must(r.code === 0, r.err)
    toolsBox = r.out.split('\n').pop()!
    return toolsBox
  })
  await step(`${TOOLS.length} CLIs installed`, async () => {
    const script = TOOLS.map((t) => `command -v ${t} >/dev/null || echo MISSING:${t}`).join('; ')
    const r = await rig(['exec', '-b', toolsBox, '--', script])
    must(!r.out.includes('MISSING'), r.out)
    const v = await rig(['exec', '-b', toolsBox, '--', 'node -v; bun -v; python --version; brew --version | head -1; whisper --help >/dev/null && echo whisper-ok'])
    must(v.out.includes('whisper-ok'), v.out + v.err)
    return v.out.replace(/\n/g, ' · ')
  })
  await step('Playwright and Puppeteer launch a browser', async () => {
    const js = [
      "const { chromium } = require('playwright'); const puppeteer = require('puppeteer');",
      "(async () => { const b = await chromium.launch(); const p = await b.newPage(); await p.goto('https://example.com');",
      "console.log('playwright:', await p.title()); await b.close();",
      "const c = await puppeteer.launch({ headless: true }); const q = await c.newPage(); await q.goto('https://example.com');",
      "console.log('puppeteer:', await q.title()); await c.close(); })().catch(e => { console.error(e); process.exit(1) })",
    ].join(' ')
    const r = await rig(['exec', '-b', toolsBox, '--', 'bash', '-lc', `cd /tmp && NODE_PATH=$(npm root -g) node -e "$0"`, js])
    must(r.out.includes('playwright: Example Domain') && r.out.includes('puppeteer: Example Domain'), r.out + r.err)
    return r.out.replace(/\n/g, ' · ')
  })
  await step('rig browser + rig shot', async () => {
    const r = await rig(['browser', '-b', toolsBox, '--', 'open', 'https://example.com'])
    must(r.code === 0, r.err)
    const s = await rig(['shot', '-b', toolsBox, join(tmpdir(), 'rig-e2e-shot.png')])
    must(s.code === 0 && s.out.endsWith('.png'), s.err)
    return s.out
  })
  await step('rig desktop: private link works, rebinding refused', async () => {
    const d = await background(['desktop', toolsBox])
    try {
      const base = d.url.split('/vnc.html')[0]!
      must((await fetch(`${base}/vnc.html`)).status === 200, 'vnc.html did not load')
      const rebound = await fetch(`${base}/vnc.html`, { headers: { host: 'evil.example' } })
      must(rebound.status === 403, `rebound host got ${rebound.status}`)
      const host = new URL(base).host
      return `desktop at ${host}`
    } finally {
      d.stop()
    }
  })

  // A real repo: a clone of rig itself, served by a tiny dev server.
  const work = mkdtempSync(join(tmpdir(), 'rig-e2e-'))
  const repo = join(work, 'rig')
  Bun.spawnSync(['git', 'clone', '-q', 'https://github.com/ShadowWalker2014/rig.git', repo])
  Bun.spawnSync(['git', 'checkout', '-qb', `e2e-${Date.now()}`], { cwd: repo })
  writeFileSync(join(repo, 'rig.json'), JSON.stringify({ setup: 'true', dev: 'python3 -m http.server 3000 --directory assets' }))
  let repoBox = ''
  await step('rig up on a real repo (clone, setup, dev server)', async () => {
    const r = await rig(['up', '--name', 'e2e-repo'], { cwd: repo })
    must(r.code === 0, r.err)
    repoBox = r.out.split('\n').pop()!
    return repoBox
  })
  await step('rig port serves the dev server on localhost', async () => {
    const p = await background(['port', '3000', '--local', '43000'], repo)
    try {
      const res = await fetch('http://localhost:43000/hero.svg')
      must(res.status === 200 && (await res.text()).includes('<svg'), `got ${res.status}`)
    } finally {
      p.stop()
    }
  })
  await step('rig sync carries an uncommitted file and an unpushed commit', async () => {
    writeFileSync(join(repo, 'assets', 'e2e.txt'), 'synced-from-laptop')
    writeFileSync(join(repo, 'e2e-commit.txt'), 'x')
    Bun.spawnSync(['git', 'add', 'e2e-commit.txt'], { cwd: repo })
    Bun.spawnSync(['git', '-c', 'user.email=e2e@rig', '-c', 'user.name=e2e', 'commit', '-qm', 'e2e'], { cwd: repo })
    const s = await rig(['sync'], { cwd: repo })
    must(s.code === 0, s.err)
    const head = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: repo }).stdout.toString().trim()
    const r = await rig(['exec', '--', 'git rev-parse HEAD; curl -s localhost:3000/e2e.txt'], { cwd: repo })
    must(r.out.includes(head) && r.out.includes('synced-from-laptop'), r.out + r.err)
  })
  await step('pause keeps memory; the next command wakes it', async () => {
    must((await rig(['pause'], { cwd: repo })).code === 0, 'pause failed')
    const ls = await rig(['ls', '--here', '--state', 'paused', '--ids'], { cwd: repo })
    must(ls.out.includes(repoBox), 'box not listed as paused')
    const t = Date.now()
    const r = await rig(['exec', '--', 'curl -s localhost:3000/e2e.txt'], { cwd: repo })
    must(r.out.includes('synced-from-laptop'), 'dev server did not survive the pause')
    return `woke and answered in ${((Date.now() - t) / 1000).toFixed(1)}s`
  })
  await step('rig logs shows the dev server output', async () => {
    const r = await rig(['logs', '-n', '5'], { cwd: repo })
    must(r.out.includes('GET'), r.out)
  })

  await step('bulk: filters preview, then --yes deletes', async () => {
    const names = ['e2e-bulk-1', 'e2e-bulk-2', 'e2e-bulk-3']
    await Promise.all(names.map((n) => rig(['new', '--name', n])))
    await Promise.all(names.map((n) => rig(['pause', n])))
    const preview = await rig(['kill', '--state', 'paused'])
    must(preview.err.includes('--yes'), 'a filtered kill did not preview first')
    const still = await rig(['ls', '--json'])
    must(names.every((n) => still.out.includes(n)), 'the preview deleted boxes')
    const kill = await rig(['kill', ...names])
    must(kill.code === 0, kill.err)
    const left = await rig(['ls', '--ids'])
    must(!names.some((n) => left.out.includes(n)), 'boxes still listed')
    return `${names.length} boxes created, paused and deleted`
  })
  await step('snapshot, list, delete; promote to a test golden', async () => {
    const env = { RIG_GOLDEN: 'rig-golden-e2e' }
    await rig(['exec', '-b', toolsBox, '--', 'echo from-golden > ~/golden-marker'])
    const s = await rig(['snap', toolsBox, '--promote'], { env })
    must(s.code === 0, s.err)
    const child = await rig(['new', '--name', 'e2e-from-golden'], { env })
    must(child.code === 0, child.err)
    const r = await rig(['exec', '-b', 'e2e-from-golden', '--', 'cat ~/golden-marker'])
    must(r.out.includes('from-golden'), 'new box did not start from the golden snapshot')
    const list = await rig(['snaps'])
    must(list.out.includes('rig-golden-e2e'), list.out)
    const busy = await rig(['snaps', 'rm', 'rig-golden-e2e', '--force'], { env })
    must(busy.code !== 0 && busy.err.includes('rig kill'), `in-use snapshot: ${busy.err}`)
    await rig(['kill', 'e2e-from-golden'])
    const del = await rig(['snaps', 'rm', 'rig-golden-e2e', '--force'], { env })
    must(del.code === 0, del.err)
    return 'new box started with the promoted file'
  })
  await step('promote refuses a box that ran repo code', async () => {
    const r = await rig(['snap', repoBox, '--promote'], { env: { RIG_GOLDEN: 'rig-golden-e2e' } })
    must(r.code !== 0 && r.err.includes('--force'), r.err)
  })
  await step('prune previews without deleting', async () => {
    const r = await rig(['prune', '--older-than', '1m'])
    must(r.code === 0, r.err)
  })
  await step('cleanup: delete every e2e box', async () => {
    const all = await rig(['ls', '--json'])
    const e2e = (JSON.parse(all.out || '[]') as { sandboxId: string; metadata: { name?: string } }[])
      .filter((b) => b.metadata.name?.startsWith('e2e-')).map((b) => b.sandboxId)
    if (e2e.length) must((await rig(['kill', ...e2e])).code === 0, 'cleanup failed')
    return `${e2e.length} deleted`
  })

  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} steps passed.`)
  writeFileSync(join(tmpdir(), 'rig-e2e-report.json'), JSON.stringify(results, null, 2))
  process.exit(failed ? 1 : 0)
}

await main()
