import { expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { CommandExitError, type Sandbox } from 'e2b'
import type { Repo } from '../src/repo'
import { syncRepo } from '../src/sync'

// A "box" that is just a local folder: commands run in bash, files land on disk.
function fakeBox(): Sandbox {
  const run = async (cmd: string, opts?: { cwd?: string }) => {
    const r = Bun.spawnSync(['bash', '-c', cmd], { cwd: opts?.cwd })
    const result = { exitCode: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() }
    if (r.exitCode !== 0) throw new CommandExitError(result)
    return result
  }
  const write = async (pathOrEntries: string | { path: string; data: Blob }[], data?: Blob) => {
    const entries = typeof pathOrEntries === 'string' ? [{ path: pathOrEntries, data: data! }] : pathOrEntries
    for (const e of entries) {
      mkdirSync(dirname(e.path), { recursive: true })
      writeFileSync(e.path, new Uint8Array(await e.data.arrayBuffer()))
    }
  }
  return { commands: { run }, files: { write } } as unknown as Sandbox
}

const sh = (cwd: string, cmd: string) => {
  const r = Bun.spawnSync(['bash', '-c', cmd], { cwd })
  if (r.exitCode !== 0) throw new Error(r.stderr.toString())
  return r.stdout.toString().trim()
}

function fixture(): Repo {
  const tmp = mkdtempSync(join(tmpdir(), 'rig-sync-'))
  const origin = join(tmp, 'origin.git')
  const local = join(tmp, 'local')
  sh(tmp, `git init -q --bare ${origin} && git clone -q ${origin} ${local}`)
  sh(local, 'git config user.email t@t && git config user.name t')
  sh(local, 'echo v1 > a.txt && echo keep > b.txt && git add a.txt b.txt && git commit -qm one && git push -q origin HEAD:main')
  // An unpushed commit on a new branch, then uncommitted and untracked changes.
  sh(local, 'git checkout -qb feat && echo v2 > a.txt && git add a.txt && git commit -qm two')
  sh(local, 'echo dirty > b.txt && echo new > c.txt && echo .env.local > .gitignore && echo SECRET=1 > .env.local')
  writeFileSync(join(local, 'rig.json'), JSON.stringify({ copy: ['.env.local'], setup: 'echo installed > .installed' }))
  const head = sh(local, 'git rev-parse HEAD')
  return { root: local, origin, slug: 't/local', name: 'local', branch: 'feat', head, boxDir: join(tmp, 'box', 'local') }
}

test('box ends up with unpushed commits, uncommitted edits and untracked files', async () => {
  const repo = fixture()
  const box = fakeBox()
  const read = (f: string) => readFileSync(join(repo.boxDir, f), 'utf8').trim()

  const first = await syncRepo(box, repo)
  expect(read('a.txt')).toBe('v2')
  expect(read('b.txt')).toBe('dirty')
  expect(read('c.txt')).toBe('new')
  expect(read('.env.local')).toBe('SECRET=1')
  expect(sh(repo.boxDir, 'git rev-parse HEAD')).toBe(repo.head)
  expect(sh(repo.boxDir, 'git branch --show-current')).toBe('feat')
  expect(first.installed).toBe(true)

  // A second sync removes a deleted file, reverts an undone edit, and skips setup.
  sh(repo.root, 'rm c.txt && git checkout -q b.txt')
  const second = await syncRepo(box, repo)
  expect(existsSync(join(repo.boxDir, 'c.txt'))).toBe(false)
  expect(read('b.txt')).toBe('keep')
  expect(second.installed).toBe(false)
})

test('never uploads files outside the repo, even through rig.json or a symlink', async () => {
  const repo = fixture()
  const outside = join(repo.root, '..', 'secret.txt')
  writeFileSync(outside, 'ssh-key')
  sh(repo.root, `ln -s ${outside} link.txt`)
  writeFileSync(join(repo.root, 'rig.json'), JSON.stringify({ copy: ['../secret.txt', '/etc/hosts'] }))
  await syncRepo(fakeBox(), repo)
  expect(existsSync(join(repo.boxDir, 'link.txt'))).toBe(false)
  expect(existsSync(join(repo.boxDir, '..', 'secret.txt'))).toBe(false)
})

test('never uploads through a committed folder symlink that points outside the repo', async () => {
  const repo = fixture()
  const outside = join(repo.root, '..', 'home')
  mkdirSync(join(outside, '.ssh'), { recursive: true })
  writeFileSync(join(outside, '.ssh', 'id_ed25519'), 'PRIVATE KEY')
  sh(repo.root, `ln -s ${outside} h`)
  writeFileSync(join(repo.root, 'rig.json'), JSON.stringify({ copy: ['h/.ssh/id_ed25519'] }))
  await syncRepo(fakeBox(), repo)
  expect(existsSync(join(repo.boxDir, 'h', '.ssh', 'id_ed25519'))).toBe(false)
})

test("a repo's own git config cannot run a program on this machine", async () => {
  const repo = fixture()
  const marker = join(repo.root, '..', 'pwned')
  sh(repo.root, `git config filter.evil.clean 'touch ${marker}; cat' && echo 'b.txt filter=evil' > .git/info/attributes`)
  await syncRepo(fakeBox(), repo)
  expect(existsSync(marker)).toBe(false)
})

test('never uploads .git internals listed in rig.json', async () => {
  const repo = fixture()
  writeFileSync(join(repo.root, 'rig.json'), JSON.stringify({ copy: ['.git/config'] }))
  await syncRepo(fakeBox(), repo)
  expect(readFileSync(join(repo.boxDir, '.git', 'config'), 'utf8')).not.toContain(repo.root)
})
