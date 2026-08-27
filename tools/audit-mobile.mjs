/**
 * Audit every demo at phone width and report anything that makes the PAGE pan
 * sideways. This is the measured worklist behind the mobile pass - run it to
 * find real offenders instead of eyeballing 365 demos.
 *
 * Usage:
 *   1. Start the examples gallery:  pnpm dev            # serves :5174
 *   2. node tools/audit-mobile.mjs [baseUrl] [idFilter]
 *      (or `pnpm audit:mobile` from the repo root)
 *
 *      baseUrl   - default http://localhost:5174. Point it at the website
 *                  (http://localhost:5180/sv-grid) to check that surface too -
 *                  it has its own chrome, so the stage is a different size.
 *      idFilter  - optional comma list of ids (or a number N) for quick
 *                  iteration. Omit to audit all.
 *      --vp=WxH  - viewport override, e.g. --vp=360x800 (common Android) or
 *                  --vp=844x390 (landscape). Default 390x844 (iPhone 13).
 *      --prefix=  - route prefix. The gallery serves a demo at `#/<id>`; the
 *                  website nests it under `#/demos/<id>`, so sweeping the site
 *                  needs `--prefix=demos/`.
 *
 *   Sweep the website surface (start it with the RIGHT base - from Git Bash
 *   set MSYS_NO_PATHCONV=1 or the leading slash is rewritten to a Win path):
 *     node tools/audit-mobile.mjs http://localhost:5180/sv-grid --prefix=demos/
 *
 * What it asserts (the hard gate):
 *   documentElement.scrollWidth <= clientWidth   - the page body must never
 *   scroll horizontally on a phone. Exits non-zero if any demo breaks it.
 *
 * What it reports (the soft worklist):
 *   Per demo, the elements sticking out past the demo stage, biggest overhang
 *   first, split into two buckets:
 *     - "esc" - nothing can scroll it into view. A real bug: the content is
 *       simply unreachable on a phone.
 *     - "cut" - an ancestor clips it. Needs a human: correct for a carousel
 *       track or an animated progress fill, silent data loss for anything the
 *       reader needs.
 *   Overflow that IS reachable - inside a real horizontal scroller, or inside
 *   a `[data-mobile-pan]` region a demo declared - is sanctioned and skipped.
 *   Scrollers are detected by measurement, not by class name, so this covers
 *   the grid's container, the board's lane strip, the dock's panes and
 *   anything added later with no maintenance.
 *
 * Also flags a starved demo pane (stage shorter than MIN_STAGE_H), which is
 * what a long unclamped header blurb does on a phone.
 *
 * Runtime is ~1s/demo serial, so a full sweep is ~6 minutes. If it is running
 * an order of magnitude slower, the selector wait is timing out per demo -
 * see the `state: 'attached'` note at the wait itself.
 * Do NOT parallelise against the Vite dev server - see the worker-cap comment
 * in playwright.config.ts for why that just produces timeouts.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const REGISTRY = join(ROOT, 'examples', 'src', 'shared', 'registry.ts')
// Suffixed per viewport AND surface, so a 360-wide run doesn't clobber the 390
// one and a website sweep doesn't clobber the gallery's - the two surfaces have
// different chrome and are meant to be compared, not overwritten.
const outName = (vp, base) => {
  const site = /5180|sv-grid\/?$/.test(base) && !/5174/.test(base) ? '-site' : ''
  const size = vp.width === 390 && vp.height === 844 ? '' : `-${vp.width}x${vp.height}`
  return `mobile-audit${site}${size}.json`
}

// Default is the iPhone 13 logical viewport. Override with `--vp=WxH` to check
// a narrower phone (360x800 is the common Android size, 320x568 an old SE) or
// landscape - the layer is tuned close enough to the edge that 30px matters.
const DEFAULT_VIEWPORT = { width: 390, height: 844 }
// A stage shorter than this means the chrome above it ate the demo. Scaled
// down in landscape, where there simply is less height to give.
const MIN_STAGE_H_RATIO = 400 / 844

const argv = process.argv.slice(2)
const vpArg = argv.find((a) => a.startsWith('--vp='))
const VIEWPORT = vpArg
  ? (() => {
      const [w, h] = vpArg.slice(5).split('x').map(Number)
      if (!w || !h) throw new Error(`bad --vp (expected WxH, got "${vpArg.slice(5)}")`)
      return { width: w, height: h }
    })()
  : DEFAULT_VIEWPORT
const MIN_STAGE_H = Math.round(VIEWPORT.height * MIN_STAGE_H_RATIO)

const rest = argv.filter((a) => !a.startsWith('--'))
const BASE = rest[0] && rest[0].startsWith('http') ? rest[0] : 'http://localhost:5174'
const FILTER = rest.find((a) => !a.startsWith('http'))

const OUT = join(ROOT, outName(VIEWPORT, BASE))

// The gallery routes a demo at `#/<id>`; the website nests it under
// `#/demos/<id>`. Pass `--prefix=demos/` to sweep the website surface, which
// has its own chrome (site header, different padding) and so a different stage.
const prefixArg = argv.find((a) => a.startsWith('--prefix='))
const ROUTE_PREFIX = prefixArg ? prefixArg.slice(9) : ''

// Playwright is a devDependency of the root workspace.
const { chromium } = createRequire(import.meta.url)('playwright')

async function demoIds() {
  const src = await readFile(REGISTRY, 'utf-8')
  const ids = [...src.matchAll(/demo\('([^']+)'/g)].map((m) => m[1])
  if (!FILTER) return ids
  if (/^\d+$/.test(FILTER)) return ids.slice(0, Number(FILTER))
  const set = new Set(FILTER.split(',').map((s) => s.trim()))
  return ids.filter((id) => set.has(id))
}

/** Runs in the page. Kept dependency-free so it can be pasted into devtools. */
function probe(minStageH) {
  const de = document.documentElement
  // `.demo-stage` is the shell hook added by the mobile pass; fall back to
  // <main> so a BASELINE run against unmodified code still measures something.
  const stage = document.querySelector('.demo-stage') || document.querySelector('main')
  if (!stage) return { fatal: 'no stage element' }

  // An element sticking out is only a BUG if nothing between it and the stage
  // can scroll it into view. Detecting that generically - rather than listing
  // known container classes - is what makes this correct: it covers the grid's
  // `.sv-grid-container`, the board's `.sv-board-lanes`, the dock's
  // `.sv-dock__content` and anything added later, with no maintenance.
  const scrollableCache = new WeakMap()
  const canPan = (el) => {
    if (scrollableCache.has(el)) return scrollableCache.get(el)
    const ox = getComputedStyle(el).overflowX
    const v = (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1
    scrollableCache.set(el, v)
    return v
  }
  const stageRight = stage.getBoundingClientRect().right
  // Returns 'pan' (reachable by scrolling - fine), 'hidden' (an ancestor clips
  // it, so it is off-screen and unreachable) or null (it escapes the stage).
  //
  // 'hidden' is reported SEPARATELY rather than skipped, because the two cases
  // that produce it look identical to the DOM but are opposites in intent: a
  // carousel track parking its next slide off-stage is correct, while a gantt
  // canvas clipped by an overflow:hidden root is silent data loss. Only a human
  // can tell those apart, so the audit surfaces them for triage instead of
  // guessing - the whole point being to not quietly pass a broken demo.
  const containment = (el) => {
    // Walk the WHOLE chain and let 'pan' beat 'hidden'. Returning at the first
    // clipping ancestor would be wrong: a grid header cell clips its own
    // overflow, but the grid container above it scrolls, so the content IS
    // reachable. Reachability is the property that matters here.
    // Start at `el` itself, not its parent: the element that CARRIES
    // data-mobile-pan is the declared region, so it is sanctioned too.
    let clipsSomewhere = false
    for (let p = el; p && p !== stage; p = p.parentElement) {
      if (p.hasAttribute('data-mobile-pan')) return 'pan'
      if (p === el) continue // self can't scroll or clip itself into view
      if (canPan(p)) return 'pan'
      const ox = getComputedStyle(p).overflowX
      if ((ox === 'hidden' || ox === 'clip') && p.getBoundingClientRect().right <= stageRight + 1) {
        clipsSomewhere = true
      }
    }
    // The STAGE itself is a pan surface once the shell flags it `.is-wide`, so
    // anything inside a scrolling stage is reachable by definition - nothing can
    // "escape" a box you can scroll. This is the sanctioned treatment for a demo
    // too wide to fit (see .demo-stage.is-wide), and it is what landscape leans
    // on, where no width-based rule applies. The per-demo `stagePans` flag still
    // reports that it happened, so this hides nothing.
    if (canPan(stage)) return 'pan'
    return clipsSomewhere ? 'hidden' : null
  }

  const right = stageRight
  const offenders = []
  const clipped = []
  for (const el of stage.querySelectorAll('*')) {
    const b = el.getBoundingClientRect()
    if (b.width < 2 || b.height < 2) continue // hidden / zero-size
    if (b.right <= right + 1) continue
    const how = containment(el)
    if (how === 'pan') continue // reachable by scrolling - sanctioned
    const cls = typeof el.className === 'string' ? el.className : ''
    const rec = {
      sel: el.tagName.toLowerCase() + (cls ? '.' + cls.trim().split(/\s+/).join('.') : ''),
      w: Math.round(b.width),
      over: Math.round(b.right - right),
    }
    ;(how === 'hidden' ? clipped : offenders).push(rec)
  }
  // Collapse duplicates (virtualised rows repeat the same selector).
  const dedupe = (list) => {
    const seen = new Map()
    for (const o of list) {
      const prev = seen.get(o.sel)
      if (!prev || o.over > prev.over) seen.set(o.sel, o)
    }
    return [...seen.values()].sort((a, b) => b.over - a.over).slice(0, 5)
  }

  return {
    pageOverflow: de.scrollWidth - de.clientWidth,
    bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
    stagePans: stage.scrollWidth > stage.clientWidth + 1,
    stageH: Math.round(stage.clientHeight),
    starved: stage.clientHeight < minStageH,
    offenders: dedupe(offenders),
    clipped: dedupe(clipped),
  }
}

async function main() {
  const ids = await demoIds()
  process.stdout.write(
    `audit-mobile: ${ids.length} demos at ${VIEWPORT.width}x${VIEWPORT.height} -> ${BASE}\n\n`,
  )

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2, hasTouch: true })

  // Preflight. A dev server that is down (or was never started) otherwise
  // produces 357 identical timeouts over ~12 minutes and a report full of
  // failures that look like demo bugs. Fail in two seconds with the real
  // reason instead. Checked again at the end, so a server that DIES mid-sweep
  // is reported as such rather than as a wall of broken demos.
  // `waitUntil: 'commit'` deliberately: this asks "is a server answering?", not
  // "has the app finished booting". The website's first request compiles a large
  // route graph and can take well over 10s cold, which a domcontentloaded probe
  // reported as DOWN while curl was happily getting a 200. Two attempts, because
  // the very first hit is the slow one.
  // Probe `BASE + '/'`, exactly the shape the per-demo URLs use. Without the
  // trailing slash the website base 404s (`/sv-grid` vs `/sv-grid/`), which had
  // this guard declaring a perfectly healthy server dead and refusing to run.
  // `waitUntil: 'commit'` asks "is a server answering?", not "has the app
  // booted" - the website's first request compiles a large route graph and can
  // take well over 10s cold, which a domcontentloaded probe reports as DOWN.
  const probeUrl = BASE.endsWith('/') ? BASE : BASE + '/'
  const reachable = async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await page.goto(probeUrl, { waitUntil: 'commit', timeout: 20000 })
        if (res && res.status() < 400) return true
      } catch {
        /* retry once before declaring it down */
      }
    }
    return false
  }
  if (!(await reachable())) {
    await browser.close()
    process.stderr.write(
      `audit-mobile: cannot reach ${BASE}\n` +
        `  Gallery:  pnpm dev\n` +
        `  Website:  MSYS_NO_PATHCONV=1 SVGRID_SITE_BASE='/sv-grid/' pnpm --filter svgrid-website dev\n` +
        `  (the MSYS_NO_PATHCONV is not optional from Git Bash - without it the\n` +
        `   leading slash is rewritten to a Windows path and every demo route\n` +
        `   silently falls back to the landing demo)\n`,
    )
    process.exit(2)
  }

  const results = []
  let overflowing = 0
  let starved = 0
  let failed = 0

  for (const id of ids) {
    try {
      await page.goto(`${BASE}/#/${ROUTE_PREFIX}${id}`, { waitUntil: 'domcontentloaded' })
      await page
        // `state: 'attached'`, NOT the default 'visible'. Playwright resolves a
        // comma-list against the first match in DOM order and then waits for
        // THAT element to have a non-empty box; in landscape (844x390) the
        // first match never satisfies it, so every demo burned the full 18s
        // timeout and a sweep took ten times as long. Attached is what this
        // actually needs - the demo is mounted, and the settle below covers
        // paint. (Measurements were always taken after the wait, so the slow
        // runs were correct, just glacial.)
        .waitForSelector('main .sv-grid-container, main svg, main canvas, main table, main section, main .wrap', {
          timeout: 18000,
          state: 'attached',
        })
        .catch(() => {})
      await page.waitForTimeout(900)

      const r = await page.evaluate(probe, MIN_STAGE_H)
      if (r.fatal) throw new Error(r.fatal)
      results.push({ id, ...r })

      const bad = r.pageOverflow > 0
      if (bad) overflowing += 1
      if (r.starved) starved += 1

      const flags = [
        bad ? `PAGE+${r.pageOverflow}` : null,
        r.starved ? `starved(${r.stageH}px)` : null,
        r.stagePans ? 'stage-pans' : null,
      ].filter(Boolean)

      process.stdout.write(
        `  ${bad ? '!!' : r.starved ? ' ~' : ' ok'}  ${id.padEnd(34)} ${flags.join(' ') || 'clean'}\n`,
      )
      for (const o of r.offenders.slice(0, 3)) {
        process.stdout.write(`      esc +${String(o.over).padStart(4)}px  ${o.sel.slice(0, 72)}\n`)
      }
      for (const o of r.clipped.slice(0, 3)) {
        process.stdout.write(`      cut +${String(o.over).padStart(4)}px  ${o.sel.slice(0, 72)}\n`)
      }
    } catch (err) {
      failed += 1
      results.push({ id, error: err.message })
      process.stdout.write(`  !!  ${id.padEnd(34)} ${err.message}\n`)
    }
  }

  // If the server went away mid-sweep, say so. Otherwise a dead server reads
  // as "N demos are broken" and sends you hunting for CSS bugs that don't
  // exist - which is exactly what a crashed dev server did on the first run.
  const serverAlive = await reachable()
  await browser.close()
  await writeFile(OUT, JSON.stringify({ viewport: VIEWPORT, base: BASE, results }, null, 2))

  if (!serverAlive) {
    process.stderr.write(
      `\naudit-mobile: ${BASE} stopped responding DURING the sweep.\n` +
        `  Results after that point are meaningless - restart it and re-run.\n`,
    )
    process.exitCode = 2
  }

  // Aggregate the offender selectors so the worklist is grouped, not per-demo.
  const byCls = new Map()
  for (const r of results) {
    for (const o of r.offenders ?? []) {
      const k = o.sel.replace(/^[a-z]+/, '')
      byCls.set(k, (byCls.get(k) ?? 0) + 1)
    }
  }
  const top = [...byCls.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)

  process.stdout.write(`\n--- top offending selectors ---\n`)
  for (const [sel, n] of top) process.stdout.write(`  ${String(n).padStart(3)}x  ${sel.slice(0, 80)}\n`)

  const withCut = results.filter((r) => (r.clipped ?? []).length)
  if (withCut.length) {
    process.stdout.write(
      `\n--- clipped, needs human triage (${withCut.length}) ---\n` +
        `    An ancestor hides these. Correct for a carousel track or an animated\n` +
        `    progress fill; silent data loss for anything the user needs to read.\n`,
    )
    for (const r of withCut) {
      process.stdout.write(`  ${r.id.padEnd(34)} +${r.clipped[0].over}px ${r.clipped[0].sel.slice(0, 46)}\n`)
    }
  }

  process.stdout.write(
    `\ndone: ${results.length} audited, ${overflowing} page-overflow, ${starved} starved pane, ` +
      `${withCut.length} clipped, ${failed} failed\n` +
      `report: ${OUT}\n`,
  )

  // Hard gate: the page body must never scroll horizontally.
  if (overflowing > 0) process.exitCode = 1
}

main()
