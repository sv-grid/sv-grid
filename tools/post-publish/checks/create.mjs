/**
 * `npm create @svgrid` the way a user runs it: every template and the Base
 * data/sample variants, scaffolded from the registry with stdin closed, then
 * installed, built, type-checked and opened in Chromium.
 *
 * Base regressions covered here: the browser variant names its IndexedDB per
 * project; supabase without .env shows the setup hint instead of a 500;
 * `--sample none` shows the empty-base hint; rows keep file order after an
 * edit and a new row lands last (browser, and postgres against PGlite served
 * over the wire); `db:setup` without DATABASE_URL fails with one line.
 *
 * SVGRID_PP_CREATE=base-browser,minimal limits the run to those scenarios.
 */
import { readdirSync, statSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { join, relative } from 'node:path'
import { browser, existsSync, freePort, kill, spawnShell, loadPage, readFileSync, readJson, registryDoc, semverFrom, serve, sleep, tail, writeFileSync } from '../lib.mjs'

export const name = 'create'
export const description = 'npm create @svgrid: every template and Base variant scaffolds, installs, builds, checks and renders'

const SCENARIOS = [
  { id: 'minimal', args: '-t minimal' },
  { id: 'sveltekit', args: '-t sveltekit', login: true },
  { id: 'headless', args: '-t headless', headless: true },
  { id: 'admin-dashboard', args: '-t admin-dashboard' },
  { id: 'pivot-dashboard', args: '-t pivot-dashboard' },
  { id: 'base-browser', args: '-t base --data browser', base: 'browser', order: true },
  { id: 'base-postgres', args: '-t base --data postgres', base: 'postgres', order: true },
  { id: 'base-supabase', args: '-t base --data supabase', base: 'supabase' },
  { id: 'base-none', args: '-t base --sample none', base: 'browser', empty: true },
  { id: 'base-crm', args: '-t base --sample sales-crm', base: 'browser' },
  { id: 'minimal-material', args: '-t minimal --theme material --dark', theme: 'material', dark: true },
]

// The one console line @svgrid/enterprise prints without a key (watermark.ts).
// It is a console.log, so it should never reach the error list; if it ever
// does, this exact text is the only enterprise line let through.
const ENTERPRISE_NOTICE = 'User is using a Commercial version which requires a license.'

const MARKERS = ['__project__', '<!-- svgrid-', '{{']
const TEXT_FILE = /\.(svelte|ts|js|mjs|cjs|json|css|html|md|sql|txt|yml|yaml|example|gitignore|npmrc)$|^\.env/

function* walk(dir) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.svelte-kit' || e === 'build' || e === 'dist' || e === '.git') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) yield* walk(p)
    else yield p
  }
}

/** Run fn without Node's one-off ExperimentalWarning on stderr. */
function quiet(fn) {
  const emit = process.emitWarning
  process.emitWarning = () => {}
  try {
    return fn()
  } finally {
    process.emitWarning = emit
  }
}

/** Errors a user would see in devtools, minus the enterprise notice. */
function pageProblems(r) {
  const errs = []
  if (r.status !== 200) errs.push(`HTTP ${r.status}`)
  for (const e of r.pageErrors) errs.push(`page error: ${e}`)
  for (const e of r.consoleErrors) if (!e.includes(ENTERPRISE_NOTICE)) errs.push(`console error: ${e}`)
  for (const f of r.failed) if (!f.startsWith('net::ERR_ABORTED')) errs.push(`request failed: ${f}`)
  return errs
}

/** Data rows the grid (or the headless <table>) rendered. */
function renderedRows(page, headless) {
  return page.evaluate((headless) => {
    if (headless) return document.querySelectorAll('table tbody tr').length
    const g = document.querySelector('[role=grid], [role=treegrid], .sv-grid')
    if (!g) return 0
    return [...g.querySelectorAll('[role=row]')].filter((r) => r.querySelector('[role=gridcell]') && !/No rows to display/.test(r.textContent)).length
  }, headless)
}

/**
 * Start a non-HTTP process (a Postgres wire server) and wait for a line.
 * serve() polls with fetch, which never succeeds against a TCP server.
 */
function spawnUntil(cmd, ready, { cwd, env = {}, timeout = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnShell(cmd, { cwd, env })
    let log = ''
    const timer = setTimeout(() => {
      kill(child)
      reject(new Error(`\`${cmd}\` did not print ${ready} within ${timeout} ms:\n${tail(log)}`))
    }, timeout)
    const on = (d) => {
      log += d
      if (ready.test(log)) {
        clearTimeout(timer)
        resolve({ stop: () => kill(child), log: () => log })
      }
    }
    child.stdout.on('data', on)
    child.stderr.on('data', on)
    child.on('close', (code) => {
      clearTimeout(timer)
      reject(new Error(`\`${cmd}\` exited ${code}:\n${tail(log)}`))
    })
  })
}

export async function run(ctx) {
  const semver = semverFrom(ctx.work)
  const v = ctx.versions.create
  const only = process.env.SVGRID_PP_CREATE?.split(',').map((s) => s.trim()).filter(Boolean)
  const root = ctx.dir('create')

  for (const s of SCENARIOS) {
    if (only && !only.includes(s.id)) continue
    const dir = join(root, s.id)
    const L = (label) => `${s.id}: ${label}`

    const scaffolded = await ctx.step(L(`npm create @svgrid@${v} -- ${s.args}`), async () => {
      const r = await ctx.ok(`npm create @svgrid@${v} ${s.id} -- ${s.args}`, { cwd: root, input: '' })
      if (!existsSync(join(dir, 'package.json'))) throw new Error(`no package.json in ${dir}:\n${tail(r.out)}`)
    })
    if (!scaffolded) continue

    await ctx.step(L('package.json ranges resolve on npm'), async () => {
      const pkg = readJson(join(dir, 'package.json'))
      const problems = []
      for (const field of ['dependencies', 'devDependencies']) {
        for (const [dep, range] of Object.entries(pkg[field] ?? {})) {
          if (/^(workspace|file|link):/.test(range)) problems.push(`${dep}@${range} is a workspace/file range`)
          else if (range !== 'latest') {
            const doc = await registryDoc(dep)
            if (!doc) problems.push(`${dep} is not on npm`)
            else if (!semver.maxSatisfying(Object.keys(doc.versions), range)) problems.push(`${dep}@${range} matches no published version`)
          }
        }
      }
      if (problems.length) throw new Error(problems.join('\n'))
    })

    await ctx.step(L('no template markers left; vite.config parses'), async () => {
      const problems = []
      for (const f of walk(dir)) {
        const rel = relative(dir, f).replace(/\\/g, '/')
        const base = rel.split('/').pop()
        if (!TEXT_FILE.test(base)) continue
        const text = readFileSync(f, 'utf8')
        for (const m of MARKERS) if (text.includes(m)) problems.push(`${rel}: contains ${m}`)
      }
      for (const cfg of ['vite.config.ts', 'vite.config.js']) {
        const f = join(dir, cfg)
        if (!existsSync(f)) continue
        const src = readFileSync(f, 'utf8')
        // The corruption a String.replace with "\\" once wrote: an unterminated regex.
        if (src.includes('split(/[/\\]/)')) problems.push(`${cfg}: split(/[/\\]/) lost a backslash`)
        const js = cfg.endsWith('.ts') ? quiet(() => stripTypeScriptTypes(src)) : src
        const tmp = join(root, `.${s.id}.${cfg}.check.mjs`)
        writeFileSync(tmp, js)
        const r = await ctx.sh(`node --check "${tmp}"`)
        if (r.code !== 0) problems.push(`${cfg} does not parse:\n${tail(r.out, 8)}`)
      }
      if (problems.length) throw new Error(problems.join('\n'))
    })

    if (s.theme || s.dark) {
      await ctx.step(L(`--theme ${s.theme} lands in src/app.css`), async () => {
        const css = readFileSync(join(dir, 'src', 'app.css'), 'utf8')
        if (!css.includes(`@svgrid/grid/themes/${s.theme}.css`)) throw new Error(`src/app.css does not import themes/${s.theme}.css`)
      })
    }

    if (s.base === 'browser') {
      await ctx.step(L('IndexedDB named after the project'), async () => {
        const db = readFileSync(join(dir, 'src', 'lib', 'db.ts'), 'utf8')
        const want = `idb://svgrid-base-${s.id}`
        if (!db.includes(`'${want}'`)) throw new Error(`src/lib/db.ts does not open ${want}:\n${db.match(/idb:\/\/[^'"]*/)?.[0] ?? '(no idb:// name)'}`)
      })
    }

    const installed = await ctx.step(L('npm install'), async () => {
      const r = await ctx.ok('npm install', { cwd: dir })
      const peer = r.out.split('\n').filter((l) => /ERESOLVE|conflicting peer|unmet peer|peer dep|Could not resolve dependency/i.test(l))
      if (peer.length) throw new Error(`peer dependency warnings:\n${peer.slice(0, 15).join('\n')}`)
      const deprecated = r.out.split('\n').filter((l) => /npm warn deprecated/i.test(l)).length
      return deprecated ? `${deprecated} deprecation warning(s)` : ''
    })
    if (!installed) continue

    if (s.base === 'postgres') {
      await ctx.step(L('db:setup without DATABASE_URL: one friendly line, no stack'), async () => {
        const r = await ctx.sh('npm run db:setup', { cwd: dir, env: { DATABASE_URL: '' } })
        if (r.code === 0) throw new Error(`exited 0:\n${tail(r.out)}`)
        if (!/Set DATABASE_URL/.test(r.out)) throw new Error(`no "Set DATABASE_URL" message:\n${tail(r.out)}`)
        if (/^\s+at .+[:(]\d+/m.test(r.out)) throw new Error(`printed a stack trace:\n${tail(r.out)}`)
      })
    }

    const built = await ctx.step(L('npm run build'), async () => {
      await ctx.ok('npm run build', { cwd: dir })
    })

    const pkg = readJson(join(dir, 'package.json'))
    if (pkg.scripts?.check) {
      await ctx.step(L('npm run check'), async () => {
        const r = await ctx.sh('npm run check', { cwd: dir })
        // svelte-check prints a sentence on a TTY and a COMPLETED line otherwise.
        const m = r.out.match(/found (\d+) errors? and (\d+) warnings?/) ?? r.out.match(/(\d+) ERRORS (\d+) WARNINGS/)
        if (r.code !== 0 || !m || m[1] !== '0') throw new Error(`exit ${r.code}:\n${tail(r.out)}`)
        return `${m[2]} warning(s)`
      })
    }
    if (!built) continue

    if (s.base === 'postgres') {
      await postgresRuntime(ctx, s, dir, L)
      continue
    }

    await ctx.step(L('preview renders'), async () => {
      const port = await freePort()
      const url = `http://127.0.0.1:${port}`
      const srv = await serve(`npm run preview -- --port ${port} --strictPort --host 127.0.0.1`, { cwd: dir, url, env: ctx.env })
      let page
      try {
        const shot = join(dir, 'post-publish.png')
        const r = await loadPage(s.login ? `${url}/login` : `${url}/`, { screenshot: shot, waitFor: s.headless ? 'table tbody tr' : s.base === 'supabase' ? 'p' : '[role=grid]' })
        page = r.page
        const notes = []
        if (s.login) {
          await page.fill('#email', 'admin@example.com')
          await page.fill('#password', 'password')
          await Promise.all([page.waitForURL(/\/people/, { timeout: 20_000 }), page.click('button[type=submit]')])
          await page.waitForSelector('[role=grid] [role=gridcell]', { timeout: 20_000 }).catch(() => {})
          await sleep(1000)
          await page.screenshot({ path: shot })
          notes.push('signed in as admin')
        }
        const problems = pageProblems(r)
        const text = await page.evaluate(() => document.body.innerText)
        if (s.base === 'supabase') {
          if (!text.includes('Copy .env.example to .env')) problems.push(`no "Copy .env.example to .env" hint; page says:\n${text.slice(0, 400)}`)
        } else if (s.empty) {
          if (!text.includes('No tables yet')) problems.push(`no "No tables yet" hint; page says:\n${text.slice(0, 400)}`)
          const add = await page.getByRole('button', { name: 'Add table' }).count()
          if (!add) problems.push('no "Add table" control')
        } else {
          const rows = await renderedRows(page, s.headless)
          if (!rows) problems.push(`no ${s.headless ? '<table> rows' : 'grid rows'} rendered; page says:\n${text.slice(0, 400)}`)
          else notes.push(`${rows} rows`)
        }
        if (s.dark) {
          const theme = await page.evaluate(() => document.documentElement.dataset.theme)
          if (theme !== 'dark') problems.push(`--dark: <html data-theme="${theme}"> in a light-scheme browser`)
        }
        if (problems.length) throw new Error(`${problems.join('\n')}\nscreenshot: ${shot}`)
        return notes.join(', ')
      } finally {
        await page?.close()
        srv.stop()
      }
    })

    if (s.order && s.base === 'browser') {
      await ctx.step(L('rows keep file order after edit + add + reload'), async () => {
        const port = await freePort()
        const url = `http://127.0.0.1:${port}/`
        const srv = await serve(`npm run preview -- --port ${port} --strictPort --host 127.0.0.1`, { cwd: dir, url, env: ctx.env })
        try {
          return await orderCheck(url, readFileSync(join(dir, 'db', 'schema.sql'), 'utf8'), join(dir, 'post-publish-order.png'))
        } finally {
          srv.stop()
        }
      })
    }
  }
}

/** db:setup against PGlite served over the Postgres wire, then the page. */
async function postgresRuntime(ctx, s, dir, L) {
  let pg
  const pgPort = await freePort()
  const DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${pgPort}/postgres`
  const up = await ctx.step(L('db:setup against a Postgres server (PGlite over the wire)'), async () => {
    pg = await spawnUntil(
      `npx -y -p @electric-sql/pglite-socket@0.2 -p @electric-sql/pglite@0.5 pglite-server --port=${pgPort} --max-connections=10`,
      /listening/i,
      { cwd: dir, env: ctx.env },
    )
    const r = await ctx.ok('npm run db:setup', { cwd: dir, env: { DATABASE_URL } })
    if (!/Tables created/.test(r.out)) throw new Error(`no "Tables created":\n${tail(r.out)}`)
  })
  try {
    if (!up) return
    const port = await freePort()
    const url = `http://127.0.0.1:${port}/`
    const env = { ...ctx.env, DATABASE_URL }
    const srv = await serve(`npm run preview -- --port ${port} --strictPort --host 127.0.0.1`, { cwd: dir, url, env })
    try {
      await ctx.step(L('preview renders'), async () => {
        const shot = join(dir, 'post-publish.png')
        const r = await loadPage(url, { screenshot: shot, waitFor: '[role=grid] [role=gridcell]' })
        try {
          const problems = pageProblems(r)
          const rows = await renderedRows(r.page, false)
          if (!rows) problems.push(`no grid rows; page says:\n${(await r.page.evaluate(() => document.body.innerText)).slice(0, 400)}`)
          if (problems.length) throw new Error(`${problems.join('\n')}\nscreenshot: ${shot}\nserver:\n${tail(srv.log(), 10)}`)
          return `${rows} rows`
        } finally {
          await r.page.close()
        }
      })
      await ctx.step(L('rows keep file order after edit + add + reload'), () =>
        orderCheck(url, readFileSync(join(dir, 'db', 'schema.sql'), 'utf8'), join(dir, 'post-publish-order.png')),
      )
    } finally {
      srv.stop()
    }
  } finally {
    pg?.stop()
  }
}

/**
 * The first table's primary-field column, top to bottom, must follow the
 * insert order in db/schema.sql; editing row 1 must not move it; a row added
 * through "Add row" must come back last after a reload.
 */
async function orderCheck(url, schemaSql, shot) {
  const b = await browser()
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(`page error: ${e?.message ?? e}`))
  page.on('console', (m) => m.type() === 'error' && !m.text().includes(ENTERPRISE_NOTICE) && errors.push(`console error: ${m.text()}`))
  const primary = async () => {
    await page.waitForSelector('[role=grid] [role=gridcell][data-svgrid-col="0"]', { timeout: 60_000 })
    await sleep(1000)
    return page.$$eval('[role=grid] [role=gridcell][data-svgrid-col="0"]', (cells) =>
      cells.map((c) => [Number(c.getAttribute('data-svgrid-row')), c.textContent.trim()]).sort((a, z) => a[0] - z[0]).map((x) => x[1]),
    )
  }
  const cell = (row) => page.locator(`[role=grid] [role=gridcell][data-svgrid-row="${row}"][data-svgrid-col="0"]`)
  const typeInto = async (row, text) => {
    await cell(row).dblclick()
    await page.waitForSelector('[role=grid] input:not([type=checkbox]), [role=grid] textarea', { timeout: 10_000 })
    // Cmd+A on macOS: Control+A there moves the caret, and the text was appended.
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
    await sleep(1500)
  }
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
    const first = await primary()
    const at = first.map((t) => schemaSql.indexOf(`'${t.replace(/'/g, "''")}'`))
    const missing = first.filter((_, i) => at[i] < 0)
    if (missing.length) throw new Error(`rows not found in db/schema.sql: ${JSON.stringify(missing)}`)
    if (at.some((p, i) => i > 0 && p <= at[i - 1])) throw new Error(`rows are not in file order:\n${first.join('\n')}`)

    const edited = 'Post-publish edited'
    await typeInto(0, edited)
    if ((await cell(0).textContent()).trim() !== edited) throw new Error(`the edit did not stick; row 1 reads "${(await cell(0).textContent()).trim()}"`)
    await page.reload({ waitUntil: 'networkidle' })
    const afterEdit = await primary()
    if (afterEdit[0] !== edited) throw new Error(`after edit + reload row 1 is "${afterEdit[0]}"; "${edited}" is at ${afterEdit.indexOf(edited) + 1}:\n${afterEdit.join('\n')}`)

    await page.getByRole('button', { name: 'Add row' }).click()
    await sleep(1500)
    const grown = await primary()
    if (grown.length !== first.length + 1) throw new Error(`"Add row" left ${grown.length} rows (had ${first.length})`)
    const added = 'Post-publish added'
    await typeInto(grown.length - 1, added)
    await page.reload({ waitUntil: 'networkidle' })
    const after = await primary()
    await page.screenshot({ path: shot })
    if (after.length !== first.length + 1) throw new Error(`after reload ${after.length} rows (expected ${first.length + 1}):\n${after.join('\n')}`)
    if (after.at(-1) !== added) throw new Error(`the added row is not last after reload:\n${after.join('\n')}`)
    if (after[0] !== edited) throw new Error(`row 1 moved after the add + reload:\n${after.join('\n')}`)
    if (errors.length) throw new Error(errors.join('\n'))
    return `${first.length} rows in file order; edit stayed first; new row last`
  } catch (e) {
    await page.screenshot({ path: shot }).catch(() => {})
    throw new Error(`${e instanceof Error ? e.message : e}\nscreenshot: ${shot}`)
  } finally {
    await page.close()
  }
}
