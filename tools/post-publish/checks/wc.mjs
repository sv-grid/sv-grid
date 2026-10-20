/**
 * The custom elements from npm: @svgrid/grid-wc in a plain Vite project
 * (<sv-grid> and <sv-chart> in one bundle), the no-build script-tag path the
 * README documents against the unpacked tarball, and <sv-sheet> from
 * @svgrid/enterprise/wc in a production Vite build.
 */
import { cpSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
import { REPO, existsSync, freePort, loadPage, readJson, registryDoc, tail, writeFileSync } from '../lib.mjs'

export const name = 'wc'
export const description = '<sv-grid> + <sv-chart> in a Vite build, the no-build script tag, <sv-sheet> in a Vite build'

const FIXTURES = join(REPO, 'tools', 'post-publish', 'fixtures', 'wc')

const KNOWN_CONSOLE_ERRORS = new Set([])

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
}

/**
 * A static file server in this process: `mounts` maps a URL prefix to a
 * directory, longest prefix first. Returns { url, stop }.
 */
async function staticServer(mounts) {
  const entries = Object.entries(mounts).sort((a, b) => b[0].length - a[0].length)
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    for (const [prefix, dir] of entries) {
      if (!path.startsWith(prefix)) continue
      let file = normalize(join(dir, path.slice(prefix.length)))
      if (!file.startsWith(normalize(dir + sep)) && file !== normalize(dir)) break
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
      if (!existsSync(file)) break
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      res.end(readFileSync(file))
      return
    }
    res.writeHead(404).end('not found')
  })
  const port = await freePort()
  await new Promise((r) => server.listen(port, '127.0.0.1', r))
  return { url: `http://127.0.0.1:${port}/`, stop: () => new Promise((r) => server.close(r)) }
}

/** `npm pack` a package and unpack it; returns the package folder. */
async function unpack(ctx, spec, dirName) {
  const dir = ctx.dir(dirName)
  const tgz = (await ctx.ok(`npm pack ${spec} --silent`, { cwd: dir })).out.trim().split(/\r?\n/).pop()
  await ctx.ok(`tar xzf ${tgz}`, { cwd: dir })
  return join(dir, 'package')
}

/**
 * Share of near-black pixels in what the user sees of `selector`: the
 * element's screenshot decoded in the page's own canvas.
 */
async function darkRatio(page, selector) {
  const png = await page.locator(selector).first().screenshot()
  return page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    let dark = 0
    for (let i = 0; i < d.length; i += 4) if (d[i] < 40 && d[i + 1] < 40 && d[i + 2] < 40) dark++
    return dark / (d.length / 4)
  }, png.toString('base64'))
}

/** What a chart element shows that it should not: black marks, its a11y table. */
async function chartProblems(page, selector) {
  const out = []
  const r = await page.evaluate((sel) => {
    const host = document.querySelector(sel)
    if (!host) return { missing: true }
    const svg = host.querySelector('svg:not([aria-hidden="true"])') ?? host.querySelector('svg')
    const marks = svg
      ? [...svg.querySelectorAll('rect, path')].filter((el) => {
          const box = el.getBoundingClientRect()
          return getComputedStyle(el).fill !== 'none' && box.width > 4 && box.height > 4
        })
      : []
    const black = marks.filter((el) => getComputedStyle(el).fill === 'rgb(0, 0, 0)').length
    // The a11y table sits in a clipped sr-only box; visible means a hit test
    // at its first cell lands inside it.
    const tables = [...host.querySelectorAll('table')].filter((t) => {
      const cell = t.querySelector('td, th') ?? t
      const box = cell.getBoundingClientRect()
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      return box.width > 4 && box.height > 4 && !!hit && t.contains(hit)
    }).length
    return { svg: !!svg, marks: marks.length, black, tables }
  }, selector)
  if (r.missing) return { problems: [`no ${selector} on the page`], note: '' }
  if (!r.svg) out.push(`${selector} drew no <svg>`)
  if (r.marks < 3) out.push(`${selector} has ${r.marks} filled marks`)
  if (r.black) out.push(`${selector}: ${r.black} marks are solid black (unstyled)`)
  if (r.tables) out.push(`${selector}: its hidden data table is visible`)
  const ratio = await darkRatio(page, selector)
  if (ratio > 0.15) out.push(`${selector}: ${(ratio * 100).toFixed(0)}% of its pixels are near-black`)
  return { problems: out, note: `${r.marks} marks, ${(ratio * 100).toFixed(1)}% dark` }
}

function pageProblems(r) {
  const out = []
  if (r.status !== 200) out.push(`HTTP ${r.status}`)
  for (const e of r.pageErrors) out.push(`page error: ${e}`)
  for (const e of r.consoleErrors) if (!KNOWN_CONSOLE_ERRORS.has(e)) out.push(`console error: ${e}`)
  for (const f of r.failed) if (!/ERR_ABORTED/.test(f)) out.push(`request failed: ${f}`)
  return out
}

function expect(cond, message) {
  if (!cond) throw new Error(message)
}

function viteProject(dir, fixture, deps, viteVersion) {
  cpSync(join(FIXTURES, fixture), dir, { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: `post-publish-${fixture}`, private: true, type: 'module', scripts: { build: 'vite build' }, devDependencies: { vite: viteVersion }, dependencies: deps }, null, 2),
  )
}

function builtJs(dir) {
  const assets = join(dir, 'dist', 'assets')
  return existsSync(assets) ? readdirSync(assets).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n') : ''
}

export async function run(ctx) {
  const shots = join(ctx.work, 'screenshots')
  mkdirSync(shots, { recursive: true })
  const { 'grid-wc': wv, enterprise: ev, grid: gv } = ctx.versions
  // What `npm create vite` would pin today.
  const viteVersion = `^${(await registryDoc('vite'))['dist-tags'].latest}`

  // ---- <sv-grid> + <sv-chart> in a Vite build ----------------------------------
  const vanilla = ctx.dir('wc-vanilla')
  const vInstalled = await ctx.step('vanilla: npm install @svgrid/grid-wc + vite', async () => {
    viteProject(vanilla, 'vanilla', { '@svgrid/grid-wc': wv }, viteVersion)
    const r = await ctx.ok('npm install', { cwd: vanilla })
    expect(!/ERESOLVE/.test(r.out), `npm install warned ERESOLVE:\n${tail(r.out)}`)
    return `vite ${viteVersion}`
  })
  const vBuilt = vInstalled && (await ctx.step('vanilla: vite build', async () => {
    await ctx.ok('npm run build', { cwd: vanilla })
    expect(existsSync(join(vanilla, 'dist', 'index.html')), 'dist/index.html missing')
  }))
  if (vBuilt) {
    const server = await staticServer({ '/': join(vanilla, 'dist') })
    let r
    try {
      await ctx.step('vanilla: <sv-grid> + <sv-chart> render in Chromium', async () => {
        r = await loadPage(server.url, { screenshot: join(shots, 'wc-vanilla.png'), waitFor: '#plain [role="gridcell"]' })
        const problems = pageProblems(r)
        const rows = await r.page.$$eval('#plain [role="gridcell"]', (els) => new Set(els.map((e) => e.getAttribute('aria-rowindex'))).size)
        if (rows < 3) problems.push(`#plain rendered ${rows} rows`)
        const chart = await chartProblems(r.page, '#chart')
        problems.push(...chart.problems)
        expect(!problems.length, problems.join('\n'))
        return `${rows} rows; chart ${chart.note}`
      })
      if (r) {
        await ctx.step('vanilla: no row checkboxes unless `selectable` is set', async () => {
          const plain = await r.page.locator('#plain :is(input[type="checkbox"], [role="checkbox"])').count()
          const picking = await r.page.locator('#picking :is(input[type="checkbox"], [role="checkbox"])').count()
          expect(plain === 0, `<sv-grid> without selectable shows ${plain} checkboxes`)
          expect(picking > 0, '<sv-grid selectable> shows no checkboxes')
          return `0 without, ${picking} with`
        })
        // `sv-grid { display: block; height: 260px }` is how the docs size the
        // element; the grid must draw inside that box, not over the next element.
        await ctx.step('vanilla: <sv-grid> draws inside the height its host is given', async () => {
          const boxes = await r.page.evaluate(() =>
            ['plain', 'picking'].map((id) => {
              const host = document.getElementById(id)
              const root = host.querySelector('.sv-grid-root')
              return { id, host: Math.round(host.getBoundingClientRect().height), grid: Math.round(root?.getBoundingClientRect().height ?? -1) }
            }),
          )
          const over = boxes.filter((b) => b.grid > b.host + 1)
          expect(!over.length, over.map((b) => `#${b.id}: host ${b.host}px, grid drawn ${b.grid}px`).join('\n'))
          return boxes.map((b) => `#${b.id} ${b.grid}/${b.host}px`).join(', ')
        })
        await ctx.step('vanilla: rowclick fires with the row', async () => {
          await r.page.locator('#plain [role="gridcell"]', { hasText: 'Berlin' }).first().click()
          await r.page.waitForTimeout(300)
          const clicks = await r.page.evaluate(() => window.__check.rowclicks)
          expect(clicks.length >= 1, 'no rowclick event')
          const d = clicks[0].detail
          const row = d?.city ? d : (d?.row ?? d?.original)
          expect(row?.city === 'Berlin', `rowclick detail: ${JSON.stringify(d).slice(0, 200)}`)
          return `detail ${JSON.stringify(d).slice(0, 60)}`
        })
      }
    } finally {
      await r?.page.close()
      await server.stop()
    }
  }

  // ---- The no-build path: script tag on the unpacked tarball ---------------------
  await ctx.step('no-build: script tags on the tarball, as the README shows', async () => {
    const pkg = await unpack(ctx, `@svgrid/grid-wc@${wv}`, 'wc-nobuild')
    const manifest = readJson(join(pkg, 'package.json'))
    const entry = String(manifest.unpkg ?? manifest.main).replace(/^\.\//, '')
    const chart = 'dist/chart/sv-chart-element.js' // the path the README's chart snippet loads
    for (const f of [entry, chart]) expect(existsSync(join(pkg, f)), `${f} is not in the tarball`)
    const page = join(ctx.work, 'wc-nobuild', 'site')
    mkdirSync(page, { recursive: true })
    const html = readFileSync(join(FIXTURES, 'nobuild', 'index.html'), 'utf8').split('__GRID_WC__').join(`/pkg/${entry}`).split('__CHART__').join(`/pkg/${chart}`)
    writeFileSync(join(page, 'index.html'), html)
    const server = await staticServer({ '/pkg/': pkg, '/': page })
    try {
      const r = await loadPage(server.url, { screenshot: join(shots, 'wc-nobuild.png'), waitFor: '#grid [role="gridcell"]' })
      try {
        const problems = pageProblems(r)
        const text = await r.page.evaluate(() => document.getElementById('grid')?.innerText ?? '')
        if (!text.includes('Ada Lovelace')) problems.push('the grid did not render its rows')
        const c = await chartProblems(r.page, '#chart')
        problems.push(...c.problems)
        if (!problems.length) {
          await r.page.locator('#grid [role="gridcell"]', { hasText: 'Alan Turing' }).first().click()
          await r.page.waitForTimeout(300)
          const clicks = await r.page.evaluate(() => window.__check.rowclicks.length)
          if (!clicks) problems.push('rowclick did not fire')
        }
        expect(!problems.length, problems.join('\n'))
        return `${entry}; chart ${c.note}`
      } finally {
        await r.page.close()
      }
    } finally {
      await server.stop()
    }
  })

  // ---- <sv-sheet> from @svgrid/enterprise/wc in a production build ---------------
  const sheet = ctx.dir('wc-sheet')
  const sInstalled = await ctx.step('sheet: npm install @svgrid/enterprise + vite', async () => {
    viteProject(sheet, 'sheet', { '@svgrid/enterprise': ev, '@svgrid/grid': gv }, viteVersion)
    const r = await ctx.ok('npm install', { cwd: sheet })
    expect(!/ERESOLVE/.test(r.out), `npm install warned ERESOLVE:\n${tail(r.out)}`)
  })
  const sBuilt = sInstalled && (await ctx.step('sheet: production build keeps the element', async () => {
    await ctx.ok('npm run build', { cwd: sheet })
    const js = builtJs(sheet)
    expect(js.includes('customElements.define'), 'no customElements.define in dist/assets: the side-effect import was tree-shaken')
    expect(js.includes('sv-sheet'), 'no "sv-sheet" in dist/assets')
    return `${(js.length / 1024).toFixed(0)} KB of JS`
  }))
  if (sBuilt) {
    await ctx.step('sheet: <sv-sheet> upgrades and renders cells in Chromium', async () => {
      const server = await staticServer({ '/': join(sheet, 'dist') })
      try {
        const r = await loadPage(server.url, { screenshot: join(shots, 'wc-sheet.png'), waitFor: 'sv-sheet [role="gridcell"]' })
        try {
          const problems = pageProblems(r)
          const defined = await r.page.evaluate(() => !!customElements.get('sv-sheet'))
          if (!defined) problems.push('customElements.get("sv-sheet") is undefined')
          const cells = await r.page.$$eval('sv-sheet [role="gridcell"]', (els) => els.map((e) => e.textContent?.trim() ?? ''))
          if (!cells.includes('Rent')) problems.push(`no "Rent" cell; ${cells.length} cells`)
          if (!cells.some((c) => /^1,?500$/.test(c))) problems.push(`=SUM(B2:B3) did not show 1500; cells: ${cells.filter(Boolean).slice(0, 20).join(' | ')}`)
          expect(!problems.length, problems.join('\n'))
          return `${cells.length} cells`
        } finally {
          await r.page.close()
        }
      } finally {
        await server.stop()
      }
    })
  }
}
