#!/usr/bin/env node
/**
 * Prove a generated app actually works.
 *
 *   node tools/verify-generated-app.mjs [sample-id] [--keep]
 *
 * Emits a real app from a sample project, installs it against the LOCAL
 * packages, and runs the app's own `svelte-check`. Unit tests assert what the
 * emitter *writes*; only this says the result compiles.
 *
 * Why local matters: a generated app depends on a published `@svgrid/*`. Left to
 * resolve from npm, this script would type-check today's codegen against
 * yesterday's runtime, and any feature that has not shipped yet would look like a
 * bug in the app. Testing the pair that actually ship together surfaces a
 * mismatch here rather than in a user's project.
 *
 * It installs packed tarballs rather than linking the workspace folders.
 * A `file:` link resolves its own `svelte` from the monorepo root, so the app
 * ends up with two copies and every Snippet type mismatches ("Two different types
 * with this name exist"). A tarball installs as an ordinary dependency - one
 * `svelte`, node_modules skipped by svelte-check - which is also exactly what a
 * user gets. `pnpm pack` (never `npm pack`) rewrites the `workspace:^` ranges.
 *
 * Exit code is 0 only when svelte-check reports zero errors.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENTERPRISE = join(ROOT, 'packages', 'enterprise')
const GRID = join(ROOT, 'packages', 'grid')

const args = process.argv.slice(2)
const keep = args.includes('--keep')
// --kit 3 emits the opt-in SvelteKit 3 shape instead of the default v2 one.
const kitAt = args.indexOf('--kit')
const kit = kitAt >= 0 ? Number(args[kitAt + 1]) : 2
if (kit !== 2 && kit !== 3) {
  console.error(`verify-generated-app: --kit must be 2 or 3, got "${args[kitAt + 1]}"`)
  process.exit(1)
}
// --build also runs `vite build`. svelte-check passing is not proof an app
// builds, and a SvelteKit major changes the build pipeline itself.
// --run also serves the built app and loads every screen in a browser (see the
// end of this file). It implies --build.
const runApp = args.includes('--run')
const build = runApp || args.includes('--build')
// --dataset <id> builds the app `svgrid-studio init --dataset <id>` builds
// (crudAppFromSchemas, with its SSR defaults) instead of a curated sample.
const datasetAt = args.indexOf('--dataset')
const datasetId = datasetAt >= 0 ? args[datasetAt + 1] : undefined
const valueFlags = new Set(['--kit', '--deploy', '--dataset'])
const sampleId = args.find((a, i) => !a.startsWith('-') && !valueFlags.has(args[i - 1])) ?? 'crm'

const run = (cmd, cmdArgs, cwd) =>
  execFileSync(cmd, cmdArgs, { cwd, encoding: 'utf8', shell: process.platform === 'win32', stdio: 'pipe' })

console.log(`verify-generated-app: building ${datasetId ? `the "${datasetId}" dataset app` : `the "${sampleId}" sample`}`)

// The Node bundle is what the CLI and MCP server use; rebuild so this checks the
// current source rather than a stale copy.
run('node', ['./scripts/build-node.mjs'], ENTERPRISE)
const studio = await import(pathToFileURL(join(ENTERPRISE, 'dist', 'node', 'studio.js')).href)

let project
if (datasetId) {
  const dataset = studio.getStarterDataset(datasetId)
  if (!dataset) {
    console.error(`verify-generated-app: no dataset "${datasetId}". Try: ${studio.starterDatasets.map((d) => d.id).join(', ')}`)
    process.exit(1)
  }
  const { entities, seed } = dataset.build()
  project = studio.crudAppFromSchemas(entities, { title: dataset.name, seed, overviewDashboard: true })
} else {
  const sample = studio.getSampleApp(sampleId)
  if (!sample) {
    console.error(`verify-generated-app: no sample "${sampleId}". Try: ${studio.sampleApps.map((s) => s.id).join(', ')}`)
    process.exit(1)
  }
  project = sample.build()
}

// --all-paths switches on what no sample app reaches. Every one of the 18
// samples uses adapter-auto, the in-memory or default source and SPA screens,
// so a generator change to the server-sorted list (goto options), the cron
// route (json helper), Drizzle (process.env vs $env) or a real adapter was
// never compiled by this script. Found while porting to SvelteKit 3, where
// all four of those change.
// --deploy <target> picks the adapter it builds against (default: node).
if (args.includes('--all-paths')) {
  const deployAt = args.indexOf('--deploy')
  const deploy = deployAt >= 0 ? args[deployAt + 1] : 'node'
  project = studio.setDataSource(project, 'sql')
  // Samples pin each entity to its own source, which wins over the project
  // default - so setDataSource alone left every entity in memory, Drizzle saw
  // no SQL entity, and emitted nothing. Point each entity at SQL explicitly.
  for (const e of project.entities) project = studio.setEntityDataSource(project, e.name, { kind: 'sql', table: e.name })
  project = studio.setDataLayer(project, true)
  project = studio.setDeployTarget(project, deploy)
  project = studio.setJob(project, 'nightly', { name: 'Nightly', cron: '0 2 * * *', kind: 'code', code: '' })
  // The server-sorted list (and its goto options) exists only in the CRUD-grid
  // shape. Ask the generator's own rule which screens have it, rather than
  // taking the first screen that contains a grid - that picked a dashboard.
  // The CRM sample has none: its lists all carry a record panel, a master-detail
  // or a scheduler grid. An entity's default screen is the plain [filter, grid]
  // list, so add one through the Studio's own API when the sample lacks it.
  let ssr = project.screens.find((s) => studio.ssrScreenShape(project, s) === 'grid')
  if (!ssr) {
    project = studio.addScreen(project, project.entities[0].name)
    ssr = project.screens.find((s) => studio.ssrScreenShape(project, s) === 'grid')
  }
  if (!ssr) throw new Error('verify-generated-app: --all-paths could not produce a screen with the SSR grid shape')
  project = studio.setScreenRenderMode(project, ssr.id, 'ssr')
  console.log(`verify-generated-app: all paths on - sql + drizzle, adapter-${deploy}, a cron job, SSR grid "${ssr.title}"`)
}
if (kit === 3) project = studio.setKitVersion(project, 3)
console.log(`verify-generated-app: targeting SvelteKit ${kit}`)
const blocking = studio.validateProject(project).filter((i) => i.level === 'error')
if (blocking.length) {
  console.error('verify-generated-app: the project itself is invalid:')
  for (const i of blocking) console.error(`  - ${i.message}`)
  process.exit(1)
}

const dir = mkdtempSync(join(tmpdir(), 'svgrid-verify-'))
const bundle = studio.emitStudioAppBundle(project)

// --all-paths must prove it reached the paths, not just that what it did reach
// compiles. The first version passed while emitting no Drizzle layer and no
// server-sorted list, because the setters it called did not take effect.
if (args.includes('--all-paths')) {
  const has = (p) => bundle.some((f) => f.path === p)
  const anyContains = (s) => bundle.some((f) => f.contents.includes(s))
  const listNav = kit === 3 ? 'reset: false' : 'keepFocus: true'
  const missing = [
    ['drizzle.config.ts', has('drizzle.config.ts')],
    ['the cron route', has('src/routes/api/cron/+server.ts')],
    [`a server-sorted list (${listNav})`, anyContains(listNav)],
  ].filter(([, ok]) => !ok).map(([what]) => what)
  if (missing.length) {
    console.error(`verify-generated-app: --all-paths did not emit: ${missing.join(', ')}`)
    process.exit(1)
  }
  console.log('verify-generated-app: emitted drizzle.config.ts, the cron route and a server-sorted list')
}

for (const file of bundle) {
  const path = join(dir, file.path)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, file.contents)
}

// Pack the workspace packages and point the app at those tarballs. `overrides`
// as well as `dependencies`, so enterprise's own dependency on grid resolves to
// the local build too instead of quietly fetching the published one.
console.log('verify-generated-app: packing the local packages')
const packed = {}
for (const [name, path] of [['@svgrid/grid', GRID], ['@svgrid/enterprise', ENTERPRISE]]) {
  const out = run('pnpm', ['pack', '--pack-destination', dir], path).trim()
  const tarball = out.split('\n').pop().trim()
  packed[name] = `file:${resolve(dir, tarball)}`
}

const pkgPath = join(dir, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
for (const [name, spec] of Object.entries(packed)) {
  if (pkg.dependencies?.[name]) pkg.dependencies[name] = spec
}
pkg.overrides = { ...pkg.overrides, ...packed }
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

console.log(`verify-generated-app: installing in ${dir}`)
try {
  run('npm', ['install', '--no-audit', '--no-fund'], dir)
} catch (err) {
  console.error('verify-generated-app: install failed\n' + (err.stdout ?? '') + (err.stderr ?? ''))
  process.exit(1)
}

console.log('verify-generated-app: type-checking the app')
let output = ''
try {
  output = run('npm', ['run', 'check'], dir)
} catch (err) {
  output = `${err.stdout ?? ''}${err.stderr ?? ''}`
}

// svelte-check's machine format ends with: <ts> COMPLETED <n> FILES <n> ERRORS ...
const summary = output.match(/COMPLETED (\d+) FILES (\d+) ERRORS (\d+) WARNINGS/)
const errors = summary ? Number(summary[2]) : NaN
if (!summary) {
  console.error('verify-generated-app: could not read a svelte-check summary\n' + output.slice(-3000))
  process.exit(1)
}

if (errors > 0) {
  console.error(`verify-generated-app: ${errors} error(s) in the generated app:\n`)
  for (const line of output.split('\n').filter((l) => l.includes(' ERROR '))) console.error('  ' + line.trim())
  console.error(`\nThe app is in ${dir}`)
  process.exit(1)
}

console.log(`verify-generated-app: type-check OK - ${summary[1]} files, 0 errors, ${summary[3]} warnings`)

if (build) {
  console.log('verify-generated-app: building the app')
  try {
    run('npm', ['run', 'build'], dir)
  } catch (err) {
    console.error('verify-generated-app: the generated app did not build:\n' + String(err.stdout ?? err.message).slice(-3000))
    console.error(`\nThe app is in ${dir}`)
    process.exit(1)
  }
  console.log('verify-generated-app: build OK')
}

if (runApp) {
  const problems = await runAndLoadEveryScreen(dir, project, bundle)
  if (problems.length) {
    console.error(`verify-generated-app: ${problems.length} runtime problem(s):`)
    for (const p of problems) console.error('  - ' + p)
    console.error(`\nThe app is in ${dir}`)
    process.exit(1)
  }
  console.log('verify-generated-app: run OK - every screen loaded with no errors')
}

console.log(`verify-generated-app: OK (SvelteKit ${kit}${runApp ? ', type-check + build + run' : build ? ', type-check + build' : ', type-check'})`)
if (keep) console.log(`verify-generated-app: kept ${dir}`)
else rmSync(dir, { recursive: true, force: true })

/**
 * --run: serve the built app with `vite preview` and load every screen in
 * Chromium. svelte-check and `vite build` say the app compiles; neither says a
 * server load can reach its data, or that a page renders without throwing.
 *
 * Fails on: a page error, a console error, any 5xx response, a server-rendered
 * grid screen whose HTML carries no rows, and an in-memory /api route that does
 * not hand out a fresh id (a create with no id, or with one already taken).
 */
async function runAndLoadEveryScreen(appDir, project, files) {
  const { spawn } = await import('node:child_process')
  const { createServer } = await import('node:net')
  const { chromium } = await import('playwright')

  const port = await new Promise((done) => {
    const srv = createServer().listen(0, () => {
      const p = srv.address().port
      srv.close(() => done(p))
    })
  })
  const origin = `http://localhost:${port}`
  console.log(`verify-generated-app: serving the build on ${origin}`)
  const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    cwd: appDir,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let serverLog = ''
  server.stdout.on('data', (d) => (serverLog += d))
  server.stderr.on('data', (d) => (serverLog += d))
  const stopServer = () => {
    if (process.platform === 'win32') {
      try { execFileSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { /* already gone */ }
    } else server.kill('SIGTERM')
  }

  const problems = []
  let browser
  try {
    const deadline = Date.now() + 60_000
    for (;;) {
      try {
        await fetch(origin + '/')
        break
      } catch {
        if (Date.now() > deadline) throw new Error('the preview server did not start:\n' + serverLog.slice(-2000))
        await new Promise((r) => setTimeout(r, 500))
      }
    }

    browser = await chromium.launch()
    const context = await browser.newContext()
    const page = await context.newPage()
    let current = '(start)'
    page.on('pageerror', (e) => problems.push(`${current}: page error: ${e.message}`))
    page.on('console', (m) => {
      if (m.type() !== 'error') return
      // A missing favicon is the browser's business, not the app's.
      if (/Failed to load resource.*404/.test(m.text())) return
      problems.push(`${current}: console error: ${m.text()}`)
    })
    page.on('response', (r) => {
      if (r.status() >= 500 && r.url().startsWith(origin)) problems.push(`${current}: ${r.status()} from ${r.url().slice(origin.length)}`)
    })

    if (project.auth?.enabled) {
      // The demo account with the widest role, so every screen is reachable.
      const users = studio.seedUsers(project)
      const wide = project.access?.roles?.find((r) => r.screens === '*')?.role
      const user = users.find((u) => u.role === wide) ?? users[0]
      current = '/login'
      await page.goto(origin + '/login')
      await page.fill('input[name="email"]', user.email)
      await page.fill('input[name="password"]', user.password)
      await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 }), page.click('button[type="submit"]')])
      console.log(`verify-generated-app: signed in as ${user.email}`)
    }

    for (const screen of project.screens) {
      if (!screen.route) continue
      current = '/' + screen.route
      await page.goto(origin + current, { waitUntil: 'networkidle', timeout: 45_000 })
      const rows = await page.locator('[data-svgrid-row]').count()
      let note = `${rows} grid row element(s)`
      if (screen.renderMode === 'ssr' && studio.ssrEligible(project, screen)) {
        // What the server sent, before any script ran.
        const html = await (await context.request.get(origin + current)).text()
        const ssrRows = new Set([...html.matchAll(/data-svgrid-row="(\d+)"/g)].map((m) => m[1])).size
        note += `, server HTML ${ssrRows} row(s)`
        if (studio.ssrScreenShape(project, screen) === 'grid') {
          if (ssrRows === 0) problems.push(`${current}: renders on the server, but its HTML has no grid rows`)
          // The page lives in the URL. Hydrating must not navigate away from it
          // (the grid reports its sort and filters on mount), and the pager must
          // be there to reach the other pages at all.
          await page.goto(origin + current + '?page=1', { waitUntil: 'networkidle', timeout: 45_000 })
          if (!page.url().includes('page=1')) problems.push(`${current}?page=1: hydrating navigated to ${page.url().slice(origin.length)}`)
          if ((await page.locator('.sv-grid-pagination').count()) === 0) problems.push(`${current}: server-paged grid has no pager`)
        }
      }
      console.log(`verify-generated-app:   ${current} - ${note}`)
    }

    // Every in-memory entity's route: the server owns the ids. ($lib on SvelteKit 2,
    // #lib/...js on 3.)
    const memoryRoutes = files
      .filter((f) => /^src\/routes\/api\/[^/]+\/\+server\.ts$/.test(f.path) && /from '(\$lib|#lib)\/server\/store(\.js)?'/.test(f.contents))
      .map((f) => f.path.split('/')[3])
    const post = async (route, body) => {
      const res = await context.request.post(`${origin}/api/${route}`, { data: body })
      return { status: res.status(), json: await res.json().catch(() => null) }
    }
    const query = { startRow: 0, endRow: 1, pageIndex: 0, pageSize: 1, sortModel: [], filterModel: {} }
    for (const route of memoryRoutes) {
      current = `/api/${route}`
      const first = await post(route, { kind: 'query', request: query })
      const row = first.json?.rows?.[0]
      if (first.status !== 200 || !row) {
        problems.push(`${current}: query returned ${first.status} with no row`)
        continue
      }
      // The route imports `<entity>Store as source`; match it back to the entity.
      const routeFile = files.find((f) => f.path === `src/routes/api/${route}/+server.ts`).contents
      const storeName = (routeFile.match(/\{ (\w+)Store as source \}/)?.[1] ?? '').toLowerCase()
      const entity = project.entities.find((e) => e.name.replace(/[^a-z0-9]/gi, '').toLowerCase() === storeName)
      const idField = entity?.idField ?? entity?.fields.find((f) => f.primaryKey)?.field ?? 'id'
      const { [idField]: takenId, ...values } = row
      const fresh = await post(route, { kind: 'mutate', op: 'create', input: values })
      const clash = await post(route, { kind: 'mutate', op: 'create', input: { ...values, [idField]: takenId } })
      const freshId = fresh.json?.[idField]
      const clashId = clash.json?.[idField]
      if (fresh.status !== 200 || freshId == null || freshId === '') problems.push(`${current}: a create with no id returned ${fresh.status} ${JSON.stringify(fresh.json)}`)
      else if (clash.status !== 200 || clashId === takenId || clashId === freshId) problems.push(`${current}: a create with taken id ${JSON.stringify(takenId)} kept it (${JSON.stringify(clashId)})`)
      else console.log(`verify-generated-app:   ${current} - new ids ${JSON.stringify(freshId)}, ${JSON.stringify(clashId)} (asked for ${JSON.stringify(takenId)})`)
      for (const id of [freshId, clashId]) if (id != null) await post(route, { kind: 'mutate', op: 'delete', id: String(id) })
    }
  } catch (err) {
    problems.push(String(err?.message ?? err))
  } finally {
    await browser?.close()
    stopServer()
  }
  if (problems.length && /error/i.test(serverLog)) problems.push('server log:\n' + serverLog.slice(-3000))
  return problems
}
