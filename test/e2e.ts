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
  await step('the box has swap as large as its RAM', async () => {
    const r = await rig(['exec', '-b', toolsBox, '--', "free -m | awk '/Mem:/ {m=$2} /Swap:/ {s=$2} END {print m, s}'"])
    const [mem, swap] = r.out.split(' ').map(Number)
    must(swap! >= Math.min(mem!, 1024), `RAM ${mem} MB, swap ${swap} MB`)
    return `${swap} MB`
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
  await step('cookies reach the box Chrome; values never appear in output', async () => {
    const { openBox } = await import('../src/box')
    const { pushCookies } = await import('../src/cookies/push')
    const secret = `e2e-${crypto.randomUUID()}`
    const r = await pushCookies(await openBox(toolsBox), [
      { host: '.rig-e2e.example', name: 'rig_e2e', value: secret, path: '/', secure: true, httpOnly: true },
      { host: 'app.rig-e2e.example', name: 'rig_e2e_host', value: secret, path: '/', secure: true, httpOnly: false },
    ])
    must(r.imported === 2 && !JSON.stringify(r).includes(secret), JSON.stringify(r))
    const hash = new Bun.CryptoHasher('sha256').update(secret).digest('hex')
    const check = `const v=await (await fetch('http://127.0.0.1:9222/json/version')).json();const ws=new WebSocket(v.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);ws.send(JSON.stringify({id:1,method:'Storage.getCookies'}));const m=await new Promise(r=>ws.onmessage=e=>r(JSON.parse(e.data)));const h=await import('node:crypto');console.log(m.result.cookies.filter(c=>c.name.startsWith('rig_e2e')&&h.createHash('sha256').update(c.value).digest('hex')==='${hash}').length);ws.close()`
    const out = await rig(['exec', '-b', toolsBox, '--', 'node', '--input-type=module', '-e', check])
    must(out.out.trim() === '2', `matching cookies in box: ${out.out} ${out.err}`)
    return '2 cookies verified by hash'
  })
  await step('computer use: screen, key, type, click, zoom, cursor', async () => {
    await rig(['browser', '-b', toolsBox, '--', 'open', 'https://example.com'])
    const shot = await rig(['screen', '-b', toolsBox, join(tmpdir(), 'rig-e2e-screen.png')])
    must(shot.code === 0 && shot.err.includes('1440x900'), shot.err)
    await rig(['key', '-b', toolsBox, 'ctrl+l'])
    await rig(['type', '-b', toolsBox, 'https://example.org'])
    await rig(['key', '-b', toolsBox, 'Enter'])
    await Bun.sleep(3000)
    must((await rig(['browser', '-b', toolsBox, '--', 'get', 'url'])).out.includes('example.org'), 'typing a URL did not navigate')
    await rig(['click', '-b', toolsBox, '328', '319'])
    await Bun.sleep(3000)
    must((await rig(['browser', '-b', toolsBox, '--', 'get', 'url'])).out.includes('iana.org'), 'clicking the link did not navigate')
    await rig(['move', '-b', toolsBox, '700', '450'])
    must((await rig(['cursor', '-b', toolsBox])).out === '700 450', 'cursor is not where it was moved')
    const zoomed = await rig(['zoom', '-b', toolsBox, '0', '60', '720', '120', join(tmpdir(), 'rig-e2e-zoom.png')])
    must(zoomed.code === 0, zoomed.err)
    return 'typed a URL, clicked a link, moved, zoomed'
  })
  await step('rig mcp: computer, browser and shell tools over stdio', async () => {
    const p = Bun.spawn([RIG, 'mcp', '-b', toolsBox], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
    const reader = p.stdout.getReader()
    let buf = ''
    const next = async () => {
      while (!buf.includes('\n')) buf += new TextDecoder().decode((await reader.read()).value)
      const i = buf.indexOf('\n'); const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); return m
    }
    let id = 0
    const call = async (method: string, params: object) => { p.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params })}\n`); return next() }
    try {
      await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } })
      const shot = await call('tools/call', { name: 'computer', arguments: { action: 'screenshot' } })
      must(shot.result.content[0].type === 'image' && shot.result.content[0].data.length > 10_000, 'no screenshot image')
      const nav = await call('tools/call', { name: 'browser', arguments: { args: ['get', 'title'] } })
      must(!nav.result.isError, JSON.stringify(nav.result))
      const sh = await call('tools/call', { name: 'shell', arguments: { command: 'echo rig-mcp-ok' } })
      must(sh.result.content[0].text.includes('rig-mcp-ok'), sh.result.content[0].text)
      const bad = await call('tools/call', { name: 'computer', arguments: { action: 'left_click' } })
      must(bad.result.isError === true, 'a bad call was not reported as an error')
      return 'screenshot image, browser, shell and error reporting'
    } finally {
      p.kill()
    }
  })
  await step('rig desktop: returns at once, link works, rebinding refused, --stop closes it', async () => {
    const d = await rig(['desktop', toolsBox])
    must(d.code === 0 && d.out.includes('/vnc.html'), d.err)
    const again = await rig(['desktop', toolsBox])
    must(again.out === d.out, 'a second call did not reuse the running link')
    try {
      const base = d.out.split('/vnc.html')[0]!
      must((await fetch(`${base}/vnc.html`)).status === 200, 'vnc.html did not load')
      const rebound = await fetch(`${base}/vnc.html`, { headers: { host: 'evil.example' } })
      must(rebound.status === 403, `rebound host got ${rebound.status}`)
      const host = new URL(base).host
      return `desktop at ${host}, reused on a second call`
    } finally {
      await rig(['desktop', toolsBox, '--stop'])
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
  await step('rig up -b picks the named box when a branch has two', async () => {
    const second = await rig(['up', '--new', '--no-dev', '--name', 'e2e-repo-par'], { cwd: repo })
    must(second.code === 0, second.err)
    const secondBox = second.out.split('\n').pop()!
    try {
      for (const want of [repoBox, secondBox, repoBox]) {
        const r = await rig(['up', '-b', want, '--no-dev'], { cwd: repo })
        must(r.code === 0 && r.out.split('\n').pop() === want && r.err.includes(`Reusing box ${want}`), `wanted ${want}: ${r.out} ${r.err}`)
      }
      const both = await rig(['up', '-b', repoBox, '--new'], { cwd: repo })
      must(both.code !== 0 && both.err.includes('not both'), both.err)
      const other = await rig(['up', '-b', toolsBox, '--no-dev'], { cwd: repo })
      must(other.code !== 0 && other.err.includes('is not a'), other.err)
    } finally {
      await rig(['kill', secondBox])
    }
    return `reused each named box; refused -b with --new and a box from outside the repo`
  })

  await step('rig init --yes detects settings and copies only named env files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-e2e-init-'))
    Bun.spawnSync(['git', 'clone', '-q', 'https://github.com/ShadowWalker2014/rig.git', dir])
    writeFileSync(join(dir, '.env.local'), 'SECRET=1')
    Bun.spawnSync(['sh', '-c', 'echo .env.local >> .git/info/exclude'], { cwd: dir })
    const plain = await rig(['init', '--yes'], { cwd: dir })
    must(plain.err.includes('Not copying .env.local'), plain.err)
    const withCopy = await rig(['init', '--yes', '--copy', '.env.local'], { cwd: dir })
    must(withCopy.code === 0, withCopy.err)
    const cfg = JSON.parse(await Bun.file(join(dir, 'rig.json')).text())
    must(cfg.setup === 'bun install' && cfg.copy.includes('.env.local'), JSON.stringify(cfg))
    return JSON.stringify(cfg)
  })
  await step('rig up stops early with the fix when the box cannot read the repo', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-e2e-private-'))
    Bun.spawnSync(['sh', '-c', 'git init -q && git commit -q --allow-empty -m x && git remote add origin https://github.com/ShadowWalker2014/rig-e2e-no-such-private-repo.git'], { cwd: dir })
    const r = await rig(['up'], { cwd: dir })
    must(r.code !== 0 && r.err.includes('gh auth login'), r.err)
    const left = await rig(['ls', '--repo', 'ShadowWalker2014/rig-e2e-no-such-private-repo', '--ids'])
    must(left.out.trim() === '', 'the useless box was left behind')
    return 'clear fix shown; no box left behind'
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
  await step('rig save makes a default desktop that new boxes start from', async () => {
    const env = { RIG_DEFAULT_DESKTOP: 'rig-default-e2e' }
    await rig(['exec', '-b', toolsBox, '--', 'echo from-default > ~/default-marker'])
    const s = await rig(['save', toolsBox], { env })
    must(s.code === 0, s.err)
    const child = await rig(['new', '--name', 'e2e-from-default'], { env })
    must(child.code === 0, child.err)
    const r = await rig(['exec', '-b', 'e2e-from-default', '--', 'cat ~/default-marker'])
    must(r.out.includes('from-default'), 'new box did not start from the default desktop')
    const list = await rig(['snaps'])
    must(list.out.includes('default-e2e'), list.out)
    const busy = await rig(['snaps', 'rm', 'rig-default-e2e', '--force'], { env })
    must(busy.code !== 0 && busy.err.includes('rig kill'), `in-use snapshot: ${busy.err}`)
    await rig(['kill', 'e2e-from-default'])
    const del = await rig(['snaps', 'rm', 'rig-default-e2e', '--force'], { env })
    must(del.code === 0, del.err)
    return 'new box started with the saved file'
  })
  await step('several saved desktops: save --as, list, start from one, switch, remove', async () => {
    const before = (await rig(['status'])).out.match(/Default desktop:\s+(\S+)/)?.[1]
    await rig(['exec', '-b', toolsBox, '--', 'echo alt > ~/alt-marker'])
    must((await rig(['save', toolsBox, '--as', 'e2e-alt'])).code === 0, 'save --as failed')
    const list = await rig(['saved'])
    must(list.out.includes('e2e-alt'), list.out)
    const box = await rig(['new', '--name', 'e2e-from-alt', '--from', 'e2e-alt'])
    must(box.code === 0, box.err)
    const marker = await rig(['exec', '-b', 'e2e-from-alt', '--', 'cat ~/alt-marker'])
    must(marker.out.includes('alt'), 'box did not start from e2e-alt')
    must((await rig(['saved', 'use', 'e2e-alt'])).code === 0, 'saved use failed')
    const switched = (await rig(['status'])).out
    if (before) await rig(['saved', 'use', before])
    must(switched.includes('e2e-alt'), switched)
    await rig(['kill', 'e2e-from-alt'])
    must((await rig(['saved', 'rm', 'e2e-alt'])).code === 0, 'saved rm failed')
    return `switched and restored the default (${before})`
  })
  await step('save refuses a box that ran repo code', async () => {
    const r = await rig(['save', repoBox], { env: { RIG_DEFAULT_DESKTOP: 'rig-default-e2e' } })
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
