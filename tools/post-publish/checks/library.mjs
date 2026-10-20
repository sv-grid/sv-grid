/**
 * @svgrid/grid and @svgrid/enterprise from npm in the apps a user builds: a
 * SvelteKit app on adapter-node with one route per feature (SSR HTML, then
 * Chromium), every JS subpath imported by plain Node, and a plain Vite + Svelte
 * app. The SvelteKit toolchain versions come from the published
 * `@svgrid/create` sveltekit template, so this tests what `npm create` gives.
 */
import { cpSync, mkdirSync } from 'node:fs'
import { REPO, existsSync, freePort, join, loadPage, readJson, registryDoc, request, semverFrom, serve, tail, writeFileSync } from '../lib.mjs'

export const name = 'library'
export const description = 'grid + enterprise in SvelteKit (SSR, adapter-node), Node imports, plain Vite + Svelte'

const FIXTURES = join(REPO, 'tools', 'post-publish', 'fixtures', 'library')

// Console errors a user sees with no license key, matched exactly. Empty: the
// unlicensed notice is console.info / console.log, not an error.
const KNOWN_CONSOLE_ERRORS = new Set([])

// Subpaths that are browser bundles by design (docs/help/web-components/*,
// the cdn builds); plain Node is not their audience.
const BROWSER_ONLY = {
  grid: ['./cdn', './cdn/svelte-external'],
  enterprise: ['./wc', './wc/react', './wc/vue', './cdn/svelte-external'],
}

/** devDependencies of the published sveltekit template, read from the tarball. */
async function templateDevDeps(ctx) {
  const dir = ctx.dir('library-create-template')
  const tgz = (await ctx.ok(`npm pack @svgrid/create@${ctx.versions.create} --silent`, { cwd: dir })).out.trim().split(/\r?\n/).pop()
  await ctx.ok(`tar xzf ${tgz}`, { cwd: dir })
  const file = join(dir, 'package', 'templates', 'sveltekit', '_package.json')
  if (!existsSync(file)) throw new Error(`@svgrid/create@${ctx.versions.create} has no templates/sveltekit/_package.json`)
  return readJson(file).devDependencies
}

/** What a page did wrong, as lines; empty when it loaded clean. */
function pageProblems(r) {
  const out = []
  if (r.status !== 200) out.push(`HTTP ${r.status}`)
  for (const e of r.pageErrors) out.push(`page error: ${e}`)
  for (const e of r.consoleErrors) if (!KNOWN_CONSOLE_ERRORS.has(e)) out.push(`console error: ${e}`)
  for (const f of r.failed) if (!/ERR_ABORTED/.test(f)) out.push(`request failed: ${f}`)
  return out
}

/** Fail with what went wrong, else return. */
function expect(cond, message) {
  if (!cond) throw new Error(message)
}

// Per-route: what must be on screen once it settled. Runs in the page and
// returns a problem string or null, plus a short note.
const ROUTES = {
  grid: {
    waitFor: '[role="gridcell"]',
    async assert(page) {
      const names = await page.$$eval('[role="gridcell"]', (els) => els.map((e) => e.textContent?.trim() ?? ''))
      expect(names.includes('Person 01'), `no "Person 01" cell; cells: ${names.slice(0, 8).join(', ')}`)
      const firstName = () => page.$$eval('[role="gridcell"]', (els) => els.map((e) => e.textContent?.trim()).find((t) => /^Person \d+$/.test(t ?? '')))
      // sort: two header clicks on Name -> descending -> Person 40 first
      const header = page.getByRole('columnheader', { name: /Name/ }).first()
      await header.click()
      await page.waitForTimeout(300)
      await header.click()
      await page.waitForTimeout(500)
      const sorting = await page.evaluate(() => window.__check?.sorting)
      expect(Array.isArray(sorting) && sorting.length === 1, `onSortingChange did not report a sort: ${JSON.stringify(sorting)}`)
      const top = await firstName()
      expect(top === 'Person 40', `after sorting Name descending the first row is ${top}`)
      // filter: the header carries a filter affordance
      const filterButtons = await page.locator('[aria-label^="Filter"], [aria-label*="filter" i]').count()
      expect(filterButtons > 0, 'filterable is set but no filter control is in the header')
      // selection: the first row checkbox selects one row
      const boxes = page.locator('tbody [role="row"] [role="checkbox"]')
      expect((await boxes.count()) > 0, 'showRowSelection is set but no row checkbox rendered')
      await boxes.first().click()
      await page.waitForTimeout(300)
      const selected = await page.evaluate(() => window.__check?.selected)
      expect(Array.isArray(selected) && selected.length === 1, `onRowSelectionChange reported ${JSON.stringify(selected)}`)
      // edit: double-click a Name cell, type, Enter
      const cell = page.locator('[role="gridcell"]', { hasText: 'Person 39' }).first()
      await cell.dblclick()
      await page.waitForTimeout(300)
      await page.keyboard.press('ControlOrMeta+a')
      await page.keyboard.type('Edited')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(400)
      const edit = await page.evaluate(() => window.__check?.edit)
      expect(edit?.newValue === 'Edited', `onCellValueChange reported ${JSON.stringify(edit)}`)
      return `${names.length} cells; sort, filter control, row select, edit ok`
    },
  },
  chart: {
    waitFor: '.sv-grid-chart svg',
    async assert(page) {
      const r = await page.evaluate(() => {
        const svg = document.querySelector('.sv-grid-chart svg')
        if (!svg) return { svg: false }
        const marks = [...svg.querySelectorAll('rect, path')].filter((el) => {
          const fill = getComputedStyle(el).fill
          const box = el.getBoundingClientRect()
          return fill && fill !== 'none' && box.width > 4 && box.height > 4
        })
        const black = marks.filter((el) => getComputedStyle(el).fill === 'rgb(0, 0, 0)').length
        return { svg: true, marks: marks.length, black }
      })
      expect(r.svg, 'no <svg> inside .sv-grid-chart')
      expect(r.marks >= 4, `expected >= 4 filled marks (4 bars), found ${r.marks}`)
      expect(r.black === 0, `${r.black} filled marks are solid black (unstyled)`)
      return `${r.marks} filled marks`
    },
  },
  export: {
    waitFor: '#run-exports:not([disabled])',
    async assert(page) {
      await page.click('#run-exports')
      await page.waitForFunction(() => window.__check?.exports, null, { timeout: 60_000 })
      await page.waitForTimeout(800) // let the upgrade card animate in, if any
      const ex = await page.evaluate(() => window.__check.exports)
      const problems = []
      for (const f of ['csv', 'xlsx', 'pdf']) if (ex[f]?.error) problems.push(`${f}: ${ex[f].error}`)
      if (!(ex.csv?.size > 0)) problems.push(`csv size ${ex.csv?.size}`)
      if (!String(ex.xlsx?.magic ?? '').startsWith('PK')) problems.push(`xlsx does not start with PK: ${JSON.stringify(ex.xlsx?.magic)}`)
      if (!String(ex.pdf?.magic ?? '').startsWith('%PDF')) problems.push(`pdf does not start with %PDF: ${JSON.stringify(ex.pdf?.magic)}`)
      const text = await page.evaluate(() => document.body.innerText)
      if (/Spreadsheet/.test(text)) problems.push(`an export-only page shows "Spreadsheet": ${text.match(/.{0,60}Spreadsheet.{0,60}/s)?.[0]}`)
      expect(!problems.length, problems.join('\n'))
      const card = await page.evaluate(() => document.querySelector('[data-svgrid-enterprise-upgrade]')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 60))
      return `csv ${ex.csv.size} B, xlsx ${ex.xlsx.size} B, pdf ${ex.pdf.size} B${card ? `; card: "${card}"` : ''}`
    },
  },
  pivot: {
    waitFor: '[role="gridcell"]',
    async assert(page) {
      const text = await page.evaluate(() => document.querySelector('main')?.innerText ?? '')
      for (const want of ['EMEA', 'APAC', 'Americas', 'Q1', 'Q4', '$7,800']) expect(text.includes(want), `pivot is missing "${want}"`)
      return 'regions x quarters, grand total $7,800'
    },
  },
  kanban: {
    waitFor: '.sv-board-card',
    async assert(page) {
      const lanes = await page.locator('.sv-board-lane').count()
      const cards = await page.locator('.sv-board-card').count()
      expect(lanes === 3 && cards === 4, `expected 3 lanes and 4 cards, found ${lanes} and ${cards}`)
      return `${lanes} lanes, ${cards} cards`
    },
  },
  scheduler: {
    waitFor: '.sv-sched-colhead',
    async assert(page) {
      const cols = await page.locator('.sv-sched-col').count()
      const heads = await page.locator('.sv-sched-colhead').count()
      expect(cols === 7, `Week view with no events in range has ${cols} day columns (want 7), ${heads} column heads`)
      return `${cols} day columns, ${heads} heads`
    },
  },
  gantt: {
    waitFor: '.sv-gantt-bar',
    async assert(page) {
      const bars = await page.locator('.sv-gantt-bar').count()
      expect(bars >= 3, `expected >= 3 gantt bars, found ${bars}`)
      return `${bars} bars`
    },
  },
  sheet: {
    waitFor: '.sv-sheet [role="gridcell"]',
    async assert(page) {
      const cells = await page.$$eval('.sv-sheet [role="gridcell"]', (els) => els.map((e) => e.textContent?.trim() ?? ''))
      expect(cells.includes('Rent'), `no "Rent" cell; ${cells.length} cells`)
      expect(cells.some((c) => /^7,?200(\.00)?$/.test(c)), `=SUM(B2:D2) did not show 7200; cells: ${cells.filter(Boolean).slice(0, 25).join(' | ')}`)
      return `${cells.length} cells, formulas computed`
    },
  },
  base: {
    waitFor: '[role="tab"]',
    async assert(page) {
      const tabs = await page.$$eval('[role="tablist"] [role="tab"]', (els) => els.map((e) => e.textContent?.trim() ?? ''))
      expect(tabs.some((t) => t.includes('Posts')) && tabs.some((t) => t.includes('Authors')), `table tabs: ${JSON.stringify(tabs)}`)
      const text = await page.evaluate(() => document.querySelector('main')?.innerText ?? '')
      expect(text.includes('Keyboard shortcuts'), 'the Posts table rows did not render')
      return `tabs: ${tabs.join(', ')}`
    },
  },
  ssrm: {
    waitFor: '[role="gridcell"]',
    async assert(page) {
      await page.waitForFunction(() => /Rep \d+/.test(document.querySelector('main')?.innerText ?? ''), null, { timeout: 15_000 }).catch(() => {})
      const text = await page.evaluate(() => document.querySelector('main')?.innerText ?? '')
      for (const want of ['Americas', 'EMEA', 'APAC']) expect(text.includes(want), `no "${want}" group row`)
      expect(/Rep \d+/.test(text), 'APAC is open by default but no leaf row loaded')
      return 'group rows + leaves of the open group'
    },
  },
}

export async function run(ctx) {
  const shots = join(ctx.work, 'screenshots')
  mkdirSync(shots, { recursive: true })
  const { grid: gv, enterprise: ev } = ctx.versions

  // ---- SvelteKit app ----------------------------------------------------------
  const kit = ctx.dir('library-kit')
  let devDeps
  const scaffolded = await ctx.step('kit: project from the @svgrid/create sveltekit template', async () => {
    devDeps = await templateDevDeps(ctx)
    const kitMajor = Number(String(devDeps['@sveltejs/kit'] ?? '').match(/\d+/)?.[0])
    const dev = { ...devDeps }
    delete dev['@sveltejs/adapter-auto']
    dev['@sveltejs/adapter-node'] = kitMajor >= 3 ? '^6.0.0' : '^5.5.0'
    const peers = (await registryDoc('@svgrid/enterprise')).versions[ev].peerDependencies
    cpSync(join(FIXTURES, 'kit'), kit, { recursive: true })
    writeFileSync(
      join(kit, 'package.json'),
      JSON.stringify(
        {
          name: 'post-publish-library-kit',
          private: true,
          version: '0.0.1',
          type: 'module',
          scripts: {
            build: 'vite build',
            prepare: "svelte-kit sync || echo ''",
            check: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json',
          },
          devDependencies: dev,
          // The two optional peers the export docs tell you to add, at the ranges enterprise declares.
          dependencies: { '@svgrid/grid': gv, '@svgrid/enterprise': ev, jszip: peers.jszip, pdfmake: peers.pdfmake },
        },
        null,
        2,
      ),
    )
    return `kit ${devDeps['@sveltejs/kit']}, svelte ${devDeps.svelte}, vite ${devDeps.vite}, adapter-node ${dev['@sveltejs/adapter-node']}`
  })
  if (!scaffolded) return

  const installed = await ctx.step('kit: npm install (no ERESOLVE)', async () => {
    const r = await ctx.ok('npm install', { cwd: kit })
    expect(!/ERESOLVE/.test(r.out), `npm install warned ERESOLVE:\n${tail(r.out)}`)
    const got = readJson(join(kit, 'node_modules', '@svgrid', 'enterprise', 'package.json')).version
    expect(got === ev, `installed enterprise ${got}, wanted ${ev}`)
    return `${(r.ms / 1000).toFixed(0)} s`
  })
  if (!installed) return

  await ctx.step('kit: svelte-check 0 errors', async () => {
    const r = await ctx.sh('npm run check', { cwd: kit })
    // Human output on a TTY, machine output ("COMPLETED n FILES e ERRORS w WARNINGS") on a pipe.
    const m = r.out.match(/svelte-check found (\d+) errors? and (\d+) warnings?/) ?? r.out.match(/(\d+) ERRORS (\d+) WARNINGS/)
    expect(r.code === 0 && m && m[1] === '0', `exit ${r.code}:\n${tail(r.out, 40)}`)
    return `${m[2]} warnings`
  })

  const built = await ctx.step('kit: vite build (SSR, adapter-node)', async () => {
    await ctx.ok('npm run build', { cwd: kit })
    expect(existsSync(join(kit, 'build', 'index.js')), 'build/index.js missing after the build')
  })
  if (built) {
    let server
    const port = await freePort()
    const base = `http://127.0.0.1:${port}`
    const up = await ctx.step('kit: `node build` answers', async () => {
      server = await serve('node build', { cwd: kit, url: `${base}/`, env: { PORT: String(port), HOST: '127.0.0.1', ORIGIN: base } })
      return base
    })
    try {
      if (up) {
        for (const [route, spec] of Object.entries(ROUTES)) {
          await ctx.step(`kit /${route}: SSR HTML 200`, async () => {
            const res = await request(`${base}/${route}`)
            const html = await res.text()
            expect(res.status === 200, `HTTP ${res.status}:\n${tail(html.replace(/<[^>]+>/g, ' '), 10)}\nserver log:\n${tail(server.log(), 15)}`)
            expect(html.includes(`<h1>${route}</h1>`), 'the HTML has no server-rendered page content')
            return `${(html.length / 1024).toFixed(0)} KB`
          })
          await ctx.step(`kit /${route}: renders in Chromium`, async () => {
            const shot = join(shots, `kit-${route}.png`)
            const r = await loadPage(`${base}/${route}`, { screenshot: shot, waitFor: spec.waitFor })
            try {
              const problems = pageProblems(r)
              expect(!problems.length, problems.join('\n'))
              const note = await spec.assert(r.page)
              await r.page.screenshot({ path: shot })
              return note
            } finally {
              await r.page.close()
            }
          })
        }
      }
    } finally {
      server?.stop()
    }
  }

  // ---- Node imports -----------------------------------------------------------
  for (const pkg of ['grid', 'enterprise']) {
    await ctx.step(`node: import every JS subpath of @svgrid/${pkg}`, async () => {
      const manifest = readJson(join(kit, 'node_modules', '@svgrid', pkg, 'package.json'))
      const skipped = []
      const needsSvelte = []
      const okd = []
      const failed = []
      for (const key of Object.keys(manifest.exports ?? {})) {
        if (key === './package.json' || key.includes('*') || key.endsWith('.css')) continue
        if (BROWSER_ONLY[pkg].includes(key)) {
          skipped.push(key)
          continue
        }
        const spec = `@svgrid/${pkg}${key.slice(1)}`
        const r = await ctx.sh(`node --input-type=module -e "await import('${spec}')"`, { cwd: kit, timeout: 60_000 })
        if (r.code === 0) okd.push(key)
        else if (/Unknown file extension "\.svelte"/.test(r.out)) needsSvelte.push(key)
        else failed.push(`${spec}:\n${tail(r.out, 8).replace(/^/gm, '  ')}`)
      }
      expect(!failed.length, failed.join('\n'))
      return `${okd.length} load; need a Svelte compiler: ${needsSvelte.join(' ') || 'none'}; browser-only, skipped: ${skipped.join(' ')}`
    })
  }

  // ---- Plain Vite + Svelte ---------------------------------------------------------
  const vite = ctx.dir('library-vite-svelte')
  const viteInstalled = await ctx.step('vite+svelte: npm install, then `npm install jszip pdfmake` as the export docs say', async () => {
    cpSync(join(FIXTURES, 'vite-svelte'), vite, { recursive: true })
    const pick = (n) => devDeps?.[n] ?? 'latest'
    writeFileSync(
      join(vite, 'package.json'),
      JSON.stringify(
        {
          name: 'post-publish-vite-svelte',
          private: true,
          type: 'module',
          scripts: { build: 'vite build' },
          devDependencies: { svelte: pick('svelte'), vite: pick('vite'), '@sveltejs/vite-plugin-svelte': pick('@sveltejs/vite-plugin-svelte') },
          dependencies: { '@svgrid/grid': gv, '@svgrid/enterprise': ev },
        },
        null,
        2,
      ),
    )
    const r = await ctx.ok('npm install', { cwd: vite })
    expect(!/ERESOLVE/.test(r.out), `npm install warned ERESOLVE:\n${tail(r.out)}`)
    // The export docs' install line, no ranges: what lands must satisfy the peers.
    const add = await ctx.ok('npm install jszip pdfmake', { cwd: vite })
    expect(!/ERESOLVE/.test(add.out), `\`npm install jszip pdfmake\` warned ERESOLVE:\n${tail(add.out)}`)
    const semver = semverFrom(ctx.work)
    const peers = readJson(join(vite, 'node_modules', '@svgrid', 'enterprise', 'package.json')).peerDependencies
    const v = (p) => readJson(join(vite, 'node_modules', p, 'package.json')).version
    for (const p of ['jszip', 'pdfmake']) expect(semver.satisfies(v(p), peers[p]), `${p}@${v(p)} is outside the peer range ${peers[p]}`)
    return `jszip ${v('jszip')}, pdfmake ${v('pdfmake')}`
  })
  if (!viteInstalled || !(await ctx.step('vite+svelte: vite build', () => ctx.ok('npm run build', { cwd: vite }).then(() => undefined)))) return

  /** Serve the build, load it, and read what the three exports produced. */
  async function exportsInBrowser(shot) {
    const port = await freePort()
    const url = `http://127.0.0.1:${port}/`
    const server = await serve(`npx vite preview --port ${port} --strictPort --host 127.0.0.1`, { cwd: vite, url })
    try {
      const r = await loadPage(url, { screenshot: join(shots, shot), waitFor: '[role="gridcell"]' })
      try {
        await r.page.waitForFunction(() => window.__check?.done, null, { timeout: 30_000 }).catch(() => {})
        const problems = pageProblems(r)
        const rows = await r.page.$$eval('[role="gridcell"]', (els) => new Set(els.map((e) => e.getAttribute('aria-rowindex'))).size)
        if (rows < 3) problems.push(`${rows} rows rendered`)
        const ex = await r.page.evaluate(() => window.__check)
        if (!ex) problems.push('onApiReady never ran the exports')
        else {
          if (!ex.done) problems.push(`exportData({ format: '${ex.started.at(-1)}', download: false }) did not settle in 30 s (no error, no result)`)
          for (const f of ['csv', 'xlsx', 'pdf']) if (ex[f]?.error) problems.push(`${f} export threw: ${ex[f].error}`)
          if (ex.csv && !ex.csv.error && !String(ex.csv.text).includes('Ada Lovelace')) problems.push(`csv: ${JSON.stringify(ex.csv)}`)
          if (ex.xlsx && !ex.xlsx.error && !String(ex.xlsx.magic).startsWith('PK')) problems.push(`xlsx magic ${JSON.stringify(ex.xlsx.magic)}`)
          if (ex.pdf && !ex.pdf.error && !String(ex.pdf.magic).startsWith('%PDF')) problems.push(`pdf magic ${JSON.stringify(ex.pdf.magic)}`)
        }
        expect(!problems.length, problems.join('\n'))
        return `${rows} rows; csv ${ex.csv.size} B, xlsx ${ex.xlsx.size} B, pdf ${ex.pdf.size} B`
      } finally {
        await r.page.close()
      }
    } finally {
      server.stop()
    }
  }

  await ctx.step('vite+svelte: SvGrid + installEnterprise export csv/xlsx/pdf in Chromium', () => exportsInBrowser('vite-svelte.png'))

  // `pnpm add pdfmake` and `yarn add pdfmake` (the export docs use pnpm) take
  // `latest` whatever the peer range says; npm alone picks a match. Without
  // the npm-only resolve, PDF export has to work or say why.
  await ctx.step('vite+svelte: PDF export with pdfmake@latest (what `pnpm add pdfmake` installs)', async () => {
    const latest = (await registryDoc('pdfmake'))['dist-tags'].latest
    await ctx.ok(`npm install pdfmake@${latest} --legacy-peer-deps`, { cwd: vite })
    await ctx.ok('npm run build', { cwd: vite })
    const note = await exportsInBrowser('vite-svelte-pdfmake-latest.png').catch((e) => {
      throw new Error(`pdfmake@${latest} (enterprise peer range ${readJson(join(vite, 'node_modules', '@svgrid', 'enterprise', 'package.json')).peerDependencies.pdfmake}):\n${e.message}`)
    })
    return `pdfmake@${latest}: ${note}`
  })
}
