/**
 * Capture the Product Hunt / launch gallery assets from the REAL demos.
 *
 * Every shot is a live interaction against the running example gallery, not a
 * mockup: we open the demo, drive the same pointer/keyboard sequence a user
 * would, and screenshot at the moment the feature is doing its thing.
 *
 * Usage:
 *   1. Start the gallery:  (cd examples && npm run dev)     # serves :5174/:5175
 *   2. node tools/capture-launch-assets.mjs [baseUrl] [shotFilter]
 *
 *      baseUrl     - default http://localhost:5175
 *      shotFilter  - optional comma list of shot ids (see SHOTS) to redo one
 *
 * Output: marketing/launch-assets/<id>.png  (+ .webm when RECORD_VIDEO=1)
 *
 * Product Hunt wants 1270x760 gallery images, so that is the logical viewport;
 * deviceScaleFactor 2 makes the PNG 2540x1520 so it stays crisp on retina.
 *
 * The gallery's own sidebar + demo header are hidden before each shot - they
 * are dev chrome, not product. `--sg-*` themed grid surfaces are untouched.
 */
import { mkdir, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'marketing', 'launch-assets')

const BASE = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:5175'
const FILTER = process.argv.find((a, i) => i >= 2 && !a.startsWith('http'))
const RECORD = process.env.RECORD_VIDEO === '1'

const VIEW = { width: 1270, height: 760 }

const reqEx = createRequire(join(ROOT, 'examples', 'package.json'))
const { chromium } = reqEx('playwright')

/** Strip the gallery's dev chrome so the shot is product, not scaffolding. */
const HIDE_CHROME = `
  .demo-sidebar, .demo-backdrop, .demo-hamburger { display: none !important; }
  .demo-page > main > header { display: none !important; }
  .demo-page > main { padding-top: 14px !important; }
`

/** Wait for a grid to have painted real rows (not the empty shell). */
async function gridReady(page, minRows = 5, timeout = 45_000) {
  await page.waitForFunction(
    (n) => document.querySelectorAll('.sv-grid-body [role="row"]').length >= n,
    minRows,
    { timeout },
  )
}

/**
 * The 1M-row demo generates its dataset in chunks with a progress readout, so
 * "rows exist" is not "done". Wait for the row count in the demo's own status
 * line to stop moving before we scroll, or the scroll lands mid-generation.
 */
async function settleRowCount(page, timeout = 90_000) {
  const started = Date.now()
  let last = -1
  let stableFor = 0
  while (Date.now() - started < timeout) {
    const n = await page.evaluate(() => {
      const txt = document.querySelector('main')?.textContent ?? ''
      const m = txt.match(/([\d,]{4,})\s*(rows|of)/i)
      return m ? Number(m[1].replace(/,/g, '')) : -1
    })
    if (n > 0 && n === last) {
      stableFor += 1
      if (stableFor >= 3) return n
    } else {
      stableFor = 0
    }
    last = n
    await page.waitForTimeout(700)
  }
  return last
}

/**
 * Click a column's Excel-filter button by coordinate. Playwright's own click
 * refuses a virtualized header cell after a deep scroll ("outside of the
 * viewport") even when it is painted and hittable, so measure and click.
 */
async function clickHeaderFilter(page, columnRe) {
  // The filter button is `width: 0; opacity: 0` until its header is hovered,
  // and hovering also shifts it left as it expands. So hover the header,
  // let the transition settle, and only THEN measure and click.
  const head = await page.evaluate((src) => {
    const re = new RegExp(src, 'i')
    for (const btn of document.querySelectorAll('.sv-grid-col-filter-btn')) {
      const h = btn.closest('[role="columnheader"]')
      if (!h || !re.test(h.textContent ?? '')) continue
      const r = h.getBoundingClientRect()
      if (r.right > innerWidth || r.bottom > innerHeight || r.x < 0 || r.y < 0) continue
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, col: h.textContent?.trim() }
    }
    return null
  }, columnRe.source)
  if (!head) throw new Error(`no in-viewport header matching ${columnRe}`)

  await page.mouse.move(head.x, head.y)
  await page.waitForTimeout(500)

  const pt = await page.evaluate((src) => {
    const re = new RegExp(src, 'i')
    for (const btn of document.querySelectorAll('.sv-grid-col-filter-btn')) {
      const h = btn.closest('[role="columnheader"]')
      if (!h || !re.test(h.textContent ?? '')) continue
      const r = btn.getBoundingClientRect()
      if (r.width < 4) continue // still collapsed
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    }
    return null
  }, columnRe.source)
  if (!pt) throw new Error(`filter button on "${head.col}" never expanded on hover`)

  process.stdout.write(`    filtering on "${head.col}"\n`)
  await page.mouse.click(pt.x, pt.y)
}

/** Hide a demo's explanatory blurb; it is teaching copy, not product UI. */
async function hideIntro(page, needle) {
  await page.evaluate((text) => {
    for (const el of document.querySelectorAll('main div')) {
      if (!el.textContent?.includes(text)) continue
      if (el.querySelector('.sv-grid-root, .pvd')) continue
      el.style.display = 'none'
      return
    }
  }, needle)
}

const SHOTS = [
  {
    id: '02-million-rows',
    demo: '78-million-rows',
    caption: '1M rows, virtualized, with the Excel-style filter menu open',
    async run(page) {
      await gridReady(page, 10)
      const total = await settleRowCount(page)
      process.stdout.write(`    dataset settled at ${total.toLocaleString()} rows\n`)

      // Scroll deep into the set so the visible row numbers prove the scale.
      await page.evaluate(() => {
        const el = document.querySelector('.sv-grid-container')
        if (el) el.scrollTop = Math.floor(el.scrollHeight * 0.42)
      })
      await page.waitForTimeout(1200)

      // Open the Excel-style filter menu. Pick the button by column name and
      // click by coordinate: after a deep scroll the virtualized header can
      // fail Playwright's own actionability check even though it is painted.
      await clickHeaderFilter(page, /department|status|country/i)
      await page.waitForTimeout(1200)
    },
  },
  {
    id: '03a-date-editor',
    demo: '05-inline-editing',
    caption: 'Rich date picker editing a cell in place',
    async run(page) {
      await gridReady(page, 5)
      await page.waitForTimeout(1200)
      // Open the date editor on a row high enough that the popover renders
      // downward and stays inside the frame.
      const col = await page.evaluate(() => {
        const heads = [...document.querySelectorAll('[role="columnheader"]')]
        return heads.findIndex((h) => /joined|date/i.test(h.textContent ?? ''))
      })
      if (col < 0) throw new Error('no date column found in 05-inline-editing')
      const cell = page.locator(`.sv-grid-body [role="row"]`).nth(1).locator('[role="gridcell"]').nth(col)
      await cell.dblclick()
      // The rich editor is SvCalendar; its root class is `sv-cal`.
      await page.waitForSelector('.sv-cal', { timeout: 10_000 })
      await page.waitForTimeout(900)
    },
  },
  {
    id: '03b-fill-handle',
    demo: '95-fill-handle',
    caption: 'Excel-style fill handle mid-drag, extending a +10 series',
    zoom: 1.45,
    hideIntro: 'hover the bottom-right corner',
    async run(page) {
      await gridReady(page, 5)
      await page.waitForTimeout(900)

      // This demo lays its cases out in ROWS and fills to the RIGHT: the two
      // "Source" columns seed a pattern and the arrow columns are the target.
      // Select both seeds of the "+10" row so the engine has a series to infer
      // (one cell alone only ever means copy-mode), then drag the handle right.
      const row = page.locator('.sv-grid-body [role="row"]').nth(1)
      await row.locator('[role="gridcell"]').nth(1).click()
      await page.waitForTimeout(250)
      await row.locator('[role="gridcell"]').nth(2).click({ modifiers: ['Shift'] })
      await page.waitForTimeout(400)

      const handle = page.locator('.sv-grid-fill-handle').first()
      const box = await handle.boundingBox()
      if (!box) throw new Error('fill handle not visible after selecting the seed range')

      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2
      await page.mouse.move(cx, cy)
      await page.mouse.down()
      // Step across the arrow columns so the pointermove handler runs per cell
      // and the dashed fill preview grows with it.
      for (let i = 1; i <= 6; i++) {
        await page.mouse.move(cx + i * 110, cy, { steps: 4 })
        await page.waitForTimeout(130)
      }
      await page.waitForTimeout(500)
      // Screenshot is taken by the caller while the button is still DOWN.
    },
    async after(page) {
      await page.mouse.up()
    },
  },
  {
    id: '04-pivot-designer',
    demo: '168-pivot-designer',
    caption: 'Pivot Designer: dragging a field into the Rows well',
    hideIntro: 'self-contained pivot authoring',
    async run(page) {
      await page.waitForSelector('.pvd-field', { timeout: 30_000 })
      await gridReady(page, 3)
      await page.waitForTimeout(1200)

      // The designer uses native HTML5 drag and drop, so synthetic mouse
      // moves never reach its handlers. Dispatch the real drag events, then
      // let Svelte flush before shooting: `dragOver` is $state, so the
      // `drag-over` class lands a tick after the event, not during it.
      const started = await page.evaluate(() => {
        const field = [...document.querySelectorAll('.pvd-field')].find((f) => /Salesperson/.test(f.textContent ?? ''))
        const well = [...document.querySelectorAll('.pvd-well')].find((w) =>
          /rows/i.test(w.querySelector('.pvd-well-head')?.textContent ?? ''),
        )
        if (!field || !well) return false
        const dt = new DataTransfer()
        field.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
        well.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dt }))
        well.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt }))
        return true
      })
      if (!started) throw new Error('pivot field or Rows well not found')
      await page.waitForTimeout(500)

      const over = await page.evaluate(() =>
        [...document.querySelectorAll('.pvd-well')].some((w) => w.classList.contains('drag-over')),
      )
      if (!over) throw new Error('Rows well never entered its drag-over state')

      // Park the cursor over the well so the shot reads as an in-flight drag.
      const w = await page.locator('.pvd-well').filter({ hasText: 'Rows' }).first().boundingBox()
      if (w) await page.mouse.move(w.x + w.width / 2, w.y + w.height - 20)
      await page.waitForTimeout(300)
    },
  },
  {
    id: '04b-pivot-mode',
    demo: '360-pivot-mode-grid',
    caption: 'Pivot mode ON: heat-mapped measures with the tool panel docked',
    hideIntro: 'enterprise pivot panel',
    async run(page) {
      await gridReady(page, 3)
      await page.waitForTimeout(1800)

      // Flip the panel's PIVOT MODE switch. Target the class directly: a text
      // search for "pivot mode" also matches the gallery's own nav. The docked
      // right-hand panel names it `pvd-pivot-toggle` (the inline designer in
      // demo 168 uses `pvd-toggle`), so accept either.
      const toggle = page.locator('.pvd-pivot-toggle, .pvd-toggle').first()
      await toggle.waitFor({ timeout: 15_000 })
      await toggle.click()
      await page.waitForTimeout(2200)

      // Confirm we actually pivoted rather than just toggling something: the
      // flat grid is keyed by Name, the pivot by the Language/Country axis.
      const pivoted = await page.evaluate(() => {
        const heads = [...document.querySelectorAll('[role="columnheader"]')].map((h) => h.textContent ?? '')
        return !heads.some((h) => /^\s*Name\s*$/.test(h))
      })
      if (!pivoted) throw new Error('pivot mode toggle did not switch the grid into pivot layout')
    },
  },
]

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const shots = FILTER
    ? SHOTS.filter((s) => FILTER.split(',').map((x) => x.trim()).includes(s.id))
    : SHOTS

  process.stdout.write(`capture-launch-assets: ${shots.length} shots from ${BASE} -> ${OUT_DIR}\n`)

  const browser = await chromium.launch()
  let ok = 0
  const failures = []

  for (const shot of shots) {
    const ctx = await browser.newContext({
      viewport: VIEW,
      deviceScaleFactor: 2,
      ...(RECORD ? { recordVideo: { dir: join(OUT_DIR, 'video-raw'), size: VIEW } } : {}),
    })
    const page = await ctx.newPage()
    process.stdout.write(`  ${shot.id}  (${shot.demo})\n`)
    try {
      await page.goto(`${BASE}/#/${shot.demo}`, { waitUntil: 'domcontentloaded' })
      await page.addStyleTag({ content: HIDE_CHROME })
      if (shot.hideIntro) await hideIntro(page, shot.hideIntro)
      // Short demos leave a dead band under the grid; scaling the demo root up
      // fills the frame. Applied before `run` so measurements come out right.
      if (shot.zoom) {
        await page.addStyleTag({ content: `.demo-page > main { zoom: ${shot.zoom}; }` })
        await page.waitForTimeout(500)
      }
      await shot.run(page)
      await page.screenshot({ path: join(OUT_DIR, `${shot.id}.png`) })
      if (shot.after) await shot.after(page)
      ok++
      process.stdout.write(`    -> ${shot.id}.png\n`)
    } catch (err) {
      failures.push({ id: shot.id, err: String(err).split('\n')[0] })
      process.stdout.write(`    FAILED: ${String(err).split('\n')[0]}\n`)
      // Still write what rendered, so a partial shot can be inspected.
      await page.screenshot({ path: join(OUT_DIR, `${shot.id}.FAILED.png`) }).catch(() => {})
    }
    await ctx.close()
  }

  await browser.close()
  if (!RECORD) await rm(join(OUT_DIR, 'video-raw'), { recursive: true, force: true }).catch(() => {})

  process.stdout.write(`\ncaptured ${ok}/${shots.length}\n`)
  if (failures.length) {
    for (const f of failures) process.stdout.write(`  FAILED ${f.id}: ${f.err}\n`)
    process.exitCode = 1
  }
}

main()
