#!/usr/bin/env node
/**
 * Slideshows (carousels) for developers: TikTok photo mode, and LinkedIn.
 *
 *   node tools/slides/render.mjs <deck-id ...|all> [--format tiktok|linkedin|all]
 *
 * A deck is a module in tools/slides/decks/. Each slide is an HTML page
 * rendered at 1080 x 1920 by Playwright; a slide with a `shot` embeds a
 * screenshot taken from the running product (the demo gallery, the
 * scaffolded SvelteKit template, the web component's demo page) in the same
 * run, so what a slide shows is what the code on it does today.
 *
 * Out: marketing/<format>/<deck>/NN.png, caption.txt (paste into the post)
 * and contact-sheet.png (every slide on one page, for review). LinkedIn also
 * gets <deck>.pdf, to post as a document, which LinkedIn shows as a
 * swipeable carousel. A deck may give `linkedinCaption`. Screenshots are
 * captured once and laid out for each format. Posting is manual: nothing
 * here talks to TikTok or LinkedIn.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { FORMATS, slideHtml, codeFontSize } from './lib/template.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DECKS = join(ROOT, 'tools', 'slides', 'decks')
const OUT = join(ROOT, 'marketing')

/** Below this a code line is not readable on a phone held at arm's length. */
const MIN_CODE_PX = 26

/** The servers a shot can come from. Started on demand, stopped at the end. */
const SERVERS = {
  // The demo gallery (pnpm dev). Dark Ember is its default; set it anyway.
  gallery: {
    base: 'http://localhost:5174',
    start: () => spawnNode(join(ROOT, 'examples', 'node_modules', 'vite', 'bin', 'vite.js'), ['--port', '5174', '--strictPort'], join(ROOT, 'examples')),
    init: `try { localStorage.setItem('sg-theme', 'dark'); localStorage.setItem('sg-preset', 'ember') } catch {}`,
    css: `.demo-sidebar, .demo-backdrop, .demo-hamburger { display: none !important; }
      .demo-page > main > header { display: none !important; }
      vite-error-overlay { display: none !important; }`,
  },
  // `npm create @svgrid@latest -- --template sveltekit --theme ember --dark`,
  // scaffolded by the tutorial recorder for the SSR videos. A production
  // build, so a JavaScript-off page gets its stylesheet as a <link>.
  kit: {
    base: 'http://localhost:4311',
    dir: join(ROOT, 'tutorials-out', 'app', 'sveltekit-ember-dark'),
    start() {
      if (!existsSync(join(this.dir, 'node_modules'))) throw new Error(`${this.dir} is missing: record mk-sveltekit-ssr-proof once to scaffold it`)
      execFileSync('npm', ['run', 'build'], { cwd: this.dir, stdio: 'ignore', shell: true })
      return spawn('npm', ['run', 'preview', '--', '--port', '4311', '--strictPort'], { cwd: this.dir, stdio: 'ignore', shell: true, windowsHide: true })
    },
  },
  // The web component's own demo page, served by its package script.
  wc: {
    base: 'http://localhost:4205',
    ready: '/demo.html',
    start: () => spawn('npm', ['run', 'preview'], { cwd: join(ROOT, 'packages', 'grid-wc'), stdio: 'ignore', shell: true, windowsHide: true }),
  },
}

function spawnNode(script, args, cwd) {
  if (!existsSync(script)) throw new Error(`${script} not found: run pnpm install`)
  return spawn(process.execPath, [script, ...args], { cwd, stdio: 'ignore', windowsHide: true })
}

function killTree(child) {
  if (!child?.pid) return
  if (process.platform === 'win32') {
    try { execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { /* gone */ }
  } else child.kill('SIGTERM')
}

async function reachable(url) {
  try {
    const r = await fetch(url)
    return r.status < 500
  } catch {
    return false
  }
}

const running = new Map()
async function ensureServer(name) {
  const s = SERVERS[name]
  if (!s) throw new Error(`unknown server "${name}"`)
  if (running.has(name)) return s
  const probe = s.base + (s.ready ?? '/')
  if (await reachable(probe)) {
    running.set(name, null) // someone else's; leave it running
    return s
  }
  console.log(`  starting ${name} ...`)
  const child = s.start()
  running.set(name, child)
  const t0 = Date.now()
  while (Date.now() - t0 < 180_000) {
    if (await reachable(probe)) return s
    if (child.exitCode !== null) throw new Error(`${name} exited with code ${child.exitCode}`)
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`${name} did not come up on ${probe}`)
}

/** Capture one screenshot for a slide. Returns a data: URL. */
async function capture(browser, shot) {
  const s = await ensureServer(shot.server)
  const context = await browser.newContext({
    viewport: shot.viewport ?? { width: 900, height: 1000 },
    deviceScaleFactor: shot.scale ?? 2,
    javaScriptEnabled: shot.js !== false,
    colorScheme: 'dark',
  })
  if (s.init && shot.js !== false) await context.addInitScript(s.init)
  const page = await context.newPage()
  try {
    await page.goto(s.base + shot.path, { waitUntil: 'networkidle', timeout: 60_000 })
    if (s.css) await page.addStyleTag({ content: s.css }).catch(() => {})
    if (shot.css) await page.addStyleTag({ content: shot.css }).catch(() => {})
    if (shot.setup) await shot.setup(page)
    if (shot.waitFor) await page.waitForSelector(shot.waitFor, { timeout: 40_000 })
    if (shot.assert) await shot.assert(page)
    await page.waitForTimeout(shot.settle ?? 600)
    if (shot.trim) {
      // A grid with no containerHeight is 520px tall whatever it holds, so
      // three rows sit on top of an empty body. Crop to the header and the
      // rows; a pager far below them becomes a second crop rather than
      // keeping the empty band between.
      const clips = await page.evaluate((sel) => {
        const root = document.querySelector(sel)
        if (!root) return null
        const r = root.getBoundingClientRect()
        const cells = [...root.querySelectorAll('[role="columnheader"], [role="row"], [data-svgrid-row], tr')].map((e) => e.getBoundingClientRect())
        const bottom = Math.max(...cells.map((c) => c.bottom))
        const pager = root.querySelector('.sv-grid-pagination')?.getBoundingClientRect()
        const box = (top, bot) => ({ x: r.left, y: top, width: r.width, height: bot - top })
        if (!pager) return [box(r.top, bottom + 1)]
        if (pager.top - bottom < 40) return [box(r.top, pager.bottom)]
        return [box(r.top, bottom + 1), box(pager.top, pager.bottom)]
      }, shot.selector)
      if (!clips) throw new Error(`shot ${shot.path}: ${shot.selector} not found`)
      const out = []
      for (const clip of clips) out.push(`data:image/png;base64,${(await page.screenshot({ clip, animations: 'disabled' })).toString('base64')}`)
      return out
    }
    const target = shot.selector ? page.locator(shot.selector).first() : page
    const png = await target.screenshot({ animations: 'disabled' })
    return `data:image/png;base64,${png.toString('base64')}`
  } finally {
    await context.close()
  }
}

async function renderDeck(browser, deck, formats) {
  // Every screenshot once, before any layout: a slide's text may read the
  // facts a later shot measures, and both formats show the same capture.
  const shots = []
  for (const [i, slide] of deck.slides.entries()) {
    if (slide.code && !slide.codeSize && codeFontSize(slide.code) < MIN_CODE_PX) {
      throw new Error(`${deck.id} slide ${i + 1}: a code line is too long to read on a phone (${codeFontSize(slide.code)}px); shorten it`)
    }
    shots.push(slide.shot ? await capture(browser, slide.shot) : undefined)
    if (slide.shot) console.log(`  ${deck.id} shot ${i + 1}/${deck.slides.length}`)
  }
  for (const format of formats) await layoutDeck(browser, deck, format, shots)
}

async function layoutDeck(browser, deck, format, shots) {
  const { size } = FORMATS[format]
  const dir = join(OUT, format, deck.id)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 })
  const files = []
  for (const [i, slide] of deck.slides.entries()) {
    const shot = shots[i]
    // A text field may be a function of `deck.facts`, which a shot's assert
    // fills with what it measured, so a number on a slide is read off the
    // page in the same run rather than typed.
    const facts = deck.facts ?? {}
    const text = Object.fromEntries(
      Object.entries(slide).map(([k, v]) => [k, k !== 'shot' && typeof v === 'function' ? v(facts) : v]),
    )
    await page.setContent(slideHtml(text, { index: i, total: deck.slides.length, shot, format }), { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.evaluate(() => window.__fit())
    // Nothing may spill past the safe area: on TikTok the caption sits on top of it.
    const overflow = await page.evaluate(() => {
      const p = document.querySelector('.page')
      return p.scrollHeight - p.clientHeight
    })
    if (overflow > 2) throw new Error(`${deck.id} (${format}) slide ${i + 1}: content overflows the safe area by ${overflow}px`)
    const file = join(dir, `${String(i + 1).padStart(2, '0')}.png`)
    await page.screenshot({ path: file })
    files.push(file)
    console.log(`  ${deck.id} ${format} ${i + 1}/${deck.slides.length}`)
  }
  const caption = format === 'linkedin' && deck.linkedinCaption ? deck.linkedinCaption : deck.caption
  writeFileSync(join(dir, 'caption.txt'), `${caption.trim()}\n\n${deck.hashtags.map((h) => `#${h}`).join(' ')}\n`)

  if (format === 'linkedin') {
    // One slide per PDF page, at the slide's own size.
    const doc = await browser.newPage()
    const pages = files.map((f) => `<img src="data:image/png;base64,${readFileSync(f).toString('base64')}" />`).join('')
    await doc.setContent(`<style>@page{size:${size.width}px ${size.height}px;margin:0}body{margin:0}img{display:block;width:${size.width}px;height:${size.height}px;break-after:page}</style>${pages}`, { waitUntil: 'load' })
    await doc.pdf({ path: join(dir, `${deck.id}.pdf`), width: `${size.width}px`, height: `${size.height}px`, printBackground: true })
    await doc.close()
  }

  // Every slide at a quarter size on one page, to review a deck in one look.
  // Inline: a page set from a string cannot load file:// URLs.
  const cells = files.map((f) => `<img src="data:image/png;base64,${readFileSync(f).toString('base64')}" />`).join('')
  const sheet = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  await sheet.setContent(`<body style="margin:0;background:#292524;display:grid;grid-template-columns:repeat(${Math.min(files.length, 6)},1fr);gap:12px;padding:12px">${cells.replace(/<img /g, '<img style="width:100%;display:block;border-radius:8px" ')}</body>`, { waitUntil: 'load' })
  await sheet.screenshot({ path: join(dir, 'contact-sheet.png'), fullPage: true })
  await sheet.close()
  await page.close()
}

const args = process.argv.slice(2)
const fi = args.indexOf('--format')
const formatArg = fi >= 0 ? args.splice(fi, 2)[1] : 'tiktok'
const formats = formatArg === 'all' ? Object.keys(FORMATS) : [formatArg]
if (formats.some((f) => !FORMATS[f])) {
  console.error(`unknown format "${formatArg}": tiktok, linkedin or all`)
  process.exit(1)
}
const wanted = args
if (!wanted.length) {
  console.error('usage: node tools/slides/render.mjs <deck-id ...|all> [--format tiktok|linkedin|all]')
  process.exit(1)
}
const ids = wanted.includes('all') ? readdirSync(DECKS).filter((f) => f.endsWith('.mjs')).map((f) => f.replace(/\.mjs$/, '')) : wanted

const browser = await chromium.launch()
let failed = false
try {
  for (const id of ids) {
    const deck = (await import(pathToFileURL(join(DECKS, `${id}.mjs`)).href)).default
    console.log(`${deck.id}: ${deck.slides.length} slides`)
    try {
      await renderDeck(browser, deck, formats)
    } catch (err) {
      failed = true
      console.error(`${deck.id} FAILED: ${err.message}`)
    }
  }
} finally {
  await browser.close()
  for (const child of running.values()) killTree(child)
}
console.log(failed ? 'done, with failures' : `done: ${formats.map((f) => join(OUT, f)).join(', ')}`)
process.exit(failed ? 1 : 0)
