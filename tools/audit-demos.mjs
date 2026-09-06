/**
 * Mount every demo in the gallery and report the ones that break.
 *
 * `count-demos.mjs` reconciles the REGISTRIES - it proves a demo is listed and
 * its file exists. It cannot tell you the demo throws on mount, and it was the
 * only demo guardrail there was. This one actually renders each of them.
 *
 * Runs against the BUILT gallery (vite preview), not the dev server: the dev
 * server compiles each demo on first request, which turns a 366-demo sweep into
 * a queue of transform timeouts that read as demo failures.
 *
 * A demo passes if, after mounting:
 *   - nothing threw (no pageerror),
 *   - it logged no console.error,
 *   - its pane rendered some text (the pane, not the app chrome - a demo that
 *     throws at mount leaves it at 0 characters, which is how this is verified).
 *
 * Build first, then run:
 *   pnpm --filter @svgrid/grid-example-gallery build
 *   pnpm demos:audit
 *   pnpm demos:audit --only 95-fill-handle     # one demo
 *   pnpm demos:audit --limit 20                # first N, for a quick check
 *
 * NOT in CI: it needs a gallery build plus a browser, ~3 minutes all in. It is
 * a pre-release sweep, and the thing to run after touching anything every demo
 * imports.
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'

// Same Windows drive-letter fix measure-size.mjs uses: a file:// pathname
// comes back as /C:/... and every fs call here needs C:/...
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const PORT = 4199

const args = process.argv.slice(2)
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null

// Demo ids, in registry order.
const reg = readFileSync(`${ROOT}/examples/src/shared/registry.ts`, 'utf8')
let ids = [...reg.matchAll(/demo\('([^']+)'/g)].map((m) => m[1])
if (only) ids = ids.filter((id) => id === only)
ids = ids.slice(0, limit)
console.log(`auditing ${ids.length} demos`)

// Refuse to run against a server this script did not start. A leftover
// preview from an earlier run serves a STALE build, and auditing against it
// reports failures that no longer exist in the source - which is exactly what
// happened while this tool was being written.
async function portInUse() {
  try {
    await fetch(`http://localhost:${PORT}/`)
    return true
  } catch {
    return false
  }
}
if (await portInUse()) {
  console.error(
    `Port ${PORT} is already serving something - probably a preview server\n` +
      `leaked by an earlier run. Auditing against it would test a stale build.\n` +
      `Kill it first, then re-run.`,
  )
  process.exit(1)
}

// No `shell: true`. On Windows that wraps vite in a cmd.exe the kill signal
// stops instead of the server, and the orphan keeps holding the port.
const viteBin = `${ROOT}/examples/node_modules/vite/bin/vite.js`
const server = spawn(
  process.execPath,
  [viteBin, 'preview', '--port', String(PORT), '--strictPort'],
  { cwd: `${ROOT}/examples`, stdio: 'ignore' },
)

let stopped = false
function stopServer() {
  if (stopped) return
  stopped = true
  if (process.platform === 'win32') {
    // Kill the whole tree: vite spawns workers that outlive a bare kill().
    try {
      spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
    } catch {}
  }
  server.kill()
}
process.on('exit', stopServer)
process.on('SIGINT', () => { stopServer(); process.exit(130) })

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    if (await portInUse()) return
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('preview server never came up')
}
await waitForServer()

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

let errors = []
let logs = []
page.on('pageerror', (e) => errors.push(String(e.message ?? e)))
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()) })

const broken = []
let checked = 0

// A route that matches no demo, so the loop's first hash set is a real
// change. Going straight to ids[0] meant the loop re-set the hash it was
// already on: no hashchange, no mount, and the first demo went UNCHECKED.
await page.goto(`http://localhost:${PORT}/#/__audit_none__`, { waitUntil: 'load' })
await page.waitForTimeout(200)

/** Mount one demo and report what went wrong, if anything. */
async function check(id, settleMs) {
  errors = []
  logs = []
  // Away from the demo first, so a retry genuinely re-mounts rather than
  // re-setting the hash it is already on (which fires no hashchange).
  await page.evaluate(() => { window.location.hash = '/__audit_none__' })
  await page.evaluate((i) => { window.location.hash = `/${i}` }, id)
  // Let the demo mount and settle: Svelte flush + any rAF work the grid does.
  await page.waitForTimeout(settleMs)

  let rendered = 0
  try {
    rendered = await page.evaluate(() => {
      const pane = document.querySelector('main') ?? document.body
      return (pane.textContent ?? '').trim().length
    })
  } catch (e) {
    errors.push(`evaluate failed: ${e.message}`)
  }

  const problems = []
  if (errors.length) problems.push(...errors.slice(0, 3).map((e) => `throw: ${e}`))
  if (logs.length) problems.push(...logs.slice(0, 3).map((e) => `console.error: ${e}`))
  if (rendered < 40) problems.push(`rendered almost nothing (${rendered} chars of text)`)
  return problems
}

const slow = []

for (const id of ids) {
  let problems = await check(id, 320)

  // A fixed settle makes a heavy demo's result depend on machine load, and a
  // sweep that cries wolf once in 367 gets ignored - which costs more than the
  // retry. So confirm a failure with a longer wait before reporting it. A real
  // break fails both times (verified by breaking a demo on purpose: it failed
  // 3 runs out of 3), while a slow mount passes and is reported separately.
  if (problems.length) {
    const retry = await check(id, 1500)
    if (retry.length === 0) {
      slow.push(id)
      problems = []
    } else {
      problems = retry
    }
  }

  checked += 1
  if (problems.length) {
    broken.push({ id, problems })
    console.log(`  BROKEN ${id}`)
    for (const p of problems) console.log(`         ${p.slice(0, 200)}`)
  }
  if (checked % 50 === 0) console.log(`  ...${checked}/${ids.length}`)
}

await browser.close()
stopServer()

console.log(`\n${ids.length - broken.length}/${ids.length} demos mounted clean`)
if (slow.length) {
  // Not a failure, but worth seeing: these needed more than 320ms to settle.
  console.log(`\n${slow.length} passed only on the slower retry: ${slow.join(', ')}`)
}
if (broken.length) {
  console.log(`\n${broken.length} with problems:`)
  for (const b of broken) console.log(`  ${b.id}`)
  process.exitCode = 1
}
