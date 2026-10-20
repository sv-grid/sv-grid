#!/usr/bin/env node
/**
 * Post-publish checks: install what is on npm and use it the way a user does.
 *
 * CI tests the source tree. A user gets the registry: tarball contents, the
 * version ranges templates write, packages resolved together, a cold `npx`.
 * @svgrid/create 3.0.5 passed CI and failed `npm install` for every Base app;
 * a check of every package the same day found seven more first-run failures.
 * Run this after every publish.
 *
 *   node tools/post-publish/run.mjs                 every check, latest versions
 *   node tools/post-publish/run.mjs --only mcp,create
 *   node tools/post-publish/run.mjs --list
 *   node tools/post-publish/run.mjs --keep          keep the work dir for a look
 *   node tools/post-publish/run.mjs --dir <path>    work dir (default: OS temp)
 *
 * Each check module in ./checks exports { name, description, run(ctx) }. It
 * calls ctx.step(label, fn) for each thing it verifies; a step that throws is
 * a failure, and the run exits 1 if any step failed. Every install uses an
 * empty npm cache, so "works on my machine" from a warm cache cannot hide a
 * broken tarball.
 */
import { readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PACKAGES, REPO, closeBrowser, freshDir, registryDoc, sh, tail, writeFileSync } from './lib.mjs'

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const value = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const checksDir = join(REPO, 'tools', 'post-publish', 'checks')
const modules = []
for (const file of readdirSync(checksDir).filter((f) => f.endsWith('.mjs')).sort()) {
  const mod = await import(pathToFileURL(join(checksDir, file)).href)
  modules.push(mod)
}

if (flag('--list')) {
  for (const m of modules) console.log(`${m.name.padEnd(14)} ${m.description}`)
  process.exit(0)
}

const only = value('--only')?.split(',').map((s) => s.trim()).filter(Boolean)
const unknown = only?.filter((n) => !modules.some((m) => m.name === n)) ?? []
if (unknown.length) {
  console.error(`Unknown check(s): ${unknown.join(', ')}. --list shows them.`)
  process.exit(2)
}
const selected = only ? modules.filter((m) => only.includes(m.name)) : modules

const work = freshDir(value('--dir') ?? join(tmpdir(), `svgrid-post-publish-${Date.now()}`))
const npmCache = join(work, '.npm-cache')
const env = { npm_config_cache: npmCache, npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false' }

// The runner's own helper (semver) lives in the work dir: the repo root has none.
const boot = await sh('npm init -y && npm i semver@7 --silent', { cwd: work, env })
if (boot.code !== 0) {
  console.error(`Could not prepare ${work}:\n${tail(boot.out)}`)
  process.exit(2)
}

// The versions under test: `latest` on the registry right now.
const versions = {}
for (const p of PACKAGES) versions[p] = (await registryDoc(`@svgrid/${p}`))?.['dist-tags']?.latest
console.log(`post-publish: work dir ${work}`)
console.log(`versions: ${PACKAGES.map((p) => `${p}@${versions[p]}`).join(' ')}\n`)

const results = []
const ctx = {
  work,
  env,
  versions,
  /** A fresh, empty directory for one scenario. */
  dir: (name) => freshDir(join(work, name)),
  /** Run a command with the isolated npm cache. */
  sh: (cmd, opts = {}) => sh(cmd, { ...opts, env: { ...env, ...(opts.env ?? {}) } }),
  /** Run a command and throw with its output tail unless it exits 0. */
  async ok(cmd, opts = {}) {
    const r = await sh(cmd, { ...opts, env: { ...env, ...(opts.env ?? {}) } })
    if (r.code !== 0) throw new Error(`\`${cmd}\` exited ${r.code}:\n${tail(r.out)}`)
    return r
  },
  current: '',
  async step(label, fn) {
    const t0 = Date.now()
    process.stdout.write(`  ${label} ... `)
    try {
      const note = await fn()
      const ms = Date.now() - t0
      results.push({ check: ctx.current, label, ok: true, ms, note: note ?? '' })
      console.log(`ok (${(ms / 1000).toFixed(1)} s)${note ? ` - ${note}` : ''}`)
      return true
    } catch (e) {
      const ms = Date.now() - t0
      const message = e instanceof Error ? e.message : String(e)
      results.push({ check: ctx.current, label, ok: false, ms, error: message })
      console.log(`FAIL (${(ms / 1000).toFixed(1)} s)\n${message.replace(/^/gm, '      ')}`)
      return false
    }
  },
}

for (const m of selected) {
  ctx.current = m.name
  console.log(`[${m.name}] ${m.description}`)
  try {
    await m.run(ctx)
  } catch (e) {
    results.push({ check: m.name, label: '(check crashed)', ok: false, ms: 0, error: String(e?.stack ?? e) })
    console.log(`  CRASHED: ${e?.stack ?? e}`)
  }
  console.log('')
}
await closeBrowser()

const failed = results.filter((r) => !r.ok)
writeFileSync(join(work, 'report.json'), JSON.stringify({ versions, results }, null, 2))
console.log(`${results.length - failed.length}/${results.length} steps passed. Report: ${join(work, 'report.json')}`)
for (const f of failed) console.log(`  FAILED [${f.check}] ${f.label}`)
if (!flag('--keep') && !failed.length) rmSync(work, { recursive: true, force: true })
process.exit(failed.length ? 1 : 0)
