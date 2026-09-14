/**
 * The `h` vocabulary a tutorial script drives the gallery with.
 *
 * Ported from the launch-asset capture scripts, which solved the awkward
 * parts once already: the Excel filter button is `width: 0` until its header
 * is hovered, a virtualized header can fail Playwright's own actionability
 * check after a deep scroll, the 1M-row demo builds its data in chunks, and
 * the pivot designer / kanban board use native HTML5 drag and drop, which
 * synthetic mouse moves never reach.
 *
 * Every pointer action goes through `moveTo`, which sweeps the mouse in steps
 * so the recorded cursor (lib/cursor.mjs) travels rather than jumps.
 */

/**
 * Hide the gallery's own chrome: it is dev scaffolding, not product. The Vite
 * error overlay is included because the dev server pushes it to every open
 * page the moment any module fails to transform (a gitignored bench adapter
 * that imports an uninstalled package is enough), and it then eats the
 * pointer for the rest of the recording.
 */
export const HIDE_CHROME = `
  .demo-sidebar, .demo-backdrop, .demo-hamburger { display: none !important; }
  .demo-page > main > header { display: none !important; }
  .demo-page > main { padding-top: 10px !important; }
  html, body { overflow: hidden !important; }
  vite-error-overlay { display: none !important; }
`

/** A string as a literal inside a RegExp source. */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * @param {import('playwright').Page} page
 * @param {(msg: string) => void} log
 */
export function createHelpers(page, log = () => {}) {
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 }
  let last = { x: viewport.width * 0.55, y: viewport.height * 0.6 }

  /** Resolve a selector, Locator or point to a viewport box. */
  async function box(target) {
    if (target && typeof target === 'object' && 'x' in target && 'y' in target && !('boundingBox' in target)) {
      return { x: target.x, y: target.y, width: 0, height: 0 }
    }
    const loc = typeof target === 'string' ? page.locator(target).first() : target
    // A cell in a column scrolled out of the grid's viewport has a box, just
    // one the pointer cannot reach; scrolling it in first is what a user does.
    await loc.scrollIntoViewIfNeeded().catch(() => {})
    const b = await loc.boundingBox()
    if (!b) throw new Error(`target not visible: ${typeof target === 'string' ? target : 'locator'}`)
    return b
  }

  async function center(target) {
    const b = await box(target)
    const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    if (c.x < 0 || c.y < 0 || c.x > viewport.width || c.y > viewport.height) {
      throw new Error(`target centre (${Math.round(c.x)}, ${Math.round(c.y)}) is outside the ${viewport.width}x${viewport.height} viewport`)
    }
    return c
  }

  /** Column index by header text, else the number given. */
  async function columnIndex(col) {
    if (typeof col === 'number') return col
    const idx = await page.evaluate((src) => {
      const re = new RegExp(src, 'i')
      const heads = [...document.querySelectorAll('[role="columnheader"]')]
      return heads.findIndex((h) => re.test(h.textContent ?? ''))
    }, col.source)
    if (idx < 0) throw new Error(`no column header matching ${col}`)
    return idx
  }

  const h = {
    page,
    log,

    pause: (ms) => page.waitForTimeout(ms),

    /** Real rows have painted (not the empty shell). */
    async gridReady(minRows = 5, timeout = 60_000) {
      await page.waitForFunction(
        (n) => document.querySelectorAll('.sv-grid-body [role="row"]').length >= n,
        minRows,
        { timeout },
      )
    },

    /**
     * Read the number on one of a demo's stat cards ("PENDING EDITS 3",
     * "ROWS 1,000,000"). Returns -1 when no card matches.
     */
    async kpi(labelRe) {
      return page.evaluate((src) => {
        const re = new RegExp(`${src}\\s*([\\d,]+)`, 'i')
        for (const c of document.querySelectorAll('main div')) {
          const t = (c.textContent || '').replace(/\s+/g, ' ')
          const m = t.match(re)
          if (m) return Number(m[1].replace(/,/g, ''))
        }
        return -1
      }, labelRe.source)
    },

    /**
     * The 1M-row demo generates its dataset in chunks with a "ROWS n target m"
     * card. Wait until n reaches m; scrolling earlier lands mid-generation.
     */
    async settleRowCount(timeout = 180_000) {
      const started = Date.now()
      let lastN = 0
      while (Date.now() - started < timeout) {
        const n = await page.evaluate(() => {
          for (const c of document.querySelectorAll('main div')) {
            const t = (c.textContent || '').replace(/\s+/g, ' ')
            const m = t.match(/ROWS\s*([\d,]{5,})\s*target\s*([\d,]+)/i)
            if (m) {
              const have = Number(m[1].replace(/,/g, ''))
              const want = Number(m[2].replace(/,/g, ''))
              return have >= want ? have : -have
            }
          }
          return 0
        })
        if (n > 0) {
          log(`dataset settled at ${n.toLocaleString()} rows`)
          return n
        }
        lastN = Math.abs(n)
        await page.waitForTimeout(400)
      }
      log(`dataset still at ${lastN.toLocaleString()} rows after ${timeout} ms`)
      return lastN
    },

    /** Collapse the demo's prose so the grid fills the frame. */
    async focusGrid() {
      await page.evaluate(() => {
        const main = document.querySelector('.demo-page > main')
        if (!main) return
        const head = main.querySelector('h1, h2')
        if (head) head.style.display = 'none'
        for (const p of main.querySelectorAll('p')) {
          if ((p.textContent || '').length > 40) p.style.display = 'none'
        }
      })
    },

    /** Hide the demo's explanatory blurb by a text needle. */
    async hideIntro(needle) {
      await page.evaluate((text) => {
        for (const el of document.querySelectorAll('main div')) {
          if (!el.textContent?.includes(text)) continue
          if (el.querySelector('.sv-grid-root, .sv-grid-container, .pvd')) continue
          el.style.display = 'none'
          return
        }
      }, needle)
    },

    /** Sweep the pointer to a point over `ms` so the cursor visibly travels. */
    async moveTo(x, y, { ms = 350 } = {}) {
      const dist = Math.hypot(x - last.x, y - last.y)
      const steps = Math.max(4, Math.min(60, Math.round(Math.max(ms, dist) / 16)))
      await page.mouse.move(x, y, { steps })
      last = { x, y }
    },

    async hover(target, opts) {
      const c = await center(target)
      await h.moveTo(c.x, c.y, opts)
      return c
    },

    async click(target, { ms, button = 'left', modifiers = [] } = {}) {
      const c = await h.hover(target, { ms })
      for (const m of modifiers) await page.keyboard.down(m)
      await page.mouse.click(c.x, c.y, { button })
      for (const m of modifiers) await page.keyboard.up(m)
      return c
    },

    async dblclick(target, opts) {
      const c = await h.hover(target, opts)
      await page.mouse.dblclick(c.x, c.y)
      return c
    },

    /** A body cell by row index and column index or header pattern. */
    async cell(rowIdx, col) {
      const ci = await columnIndex(col)
      return page.locator('.sv-grid-body [role="row"]').nth(rowIdx).locator('[role="gridcell"]').nth(ci)
    },

    async clickCell(rowIdx, col, opts) {
      return h.click(await h.cell(rowIdx, col), opts)
    },

    async dblclickCell(rowIdx, col, opts) {
      return h.dblclick(await h.cell(rowIdx, col), opts)
    },

    async type(text, { delay = 90 } = {}) {
      await page.keyboard.type(text, { delay })
    },

    async press(key) {
      await page.keyboard.press(key)
    },

    toggle: (target, opts) => h.click(target, opts),

    /**
     * Pick an option in a native `<select>`. The dropdown a real click opens
     * is drawn by the OS, outside the page, so the screencast never sees it;
     * the cursor travels to the select and the option is set through the
     * DOM, which fires the same change event the picker listens to.
     * `target` is a selector or Locator for the select; a chart-panel picker
     * can also be named by its label, `{ label: /group by/i }`, which finds
     * the `.sv-grid-chart-ctl` whose label matches.
     */
    async selectOption(target, value, opts) {
      let loc
      if (target && typeof target === 'object' && 'label' in target) {
        loc = page.locator('.sv-grid-chart-ctl', { has: page.locator('.sv-grid-chart-ctl-lbl', { hasText: target.label }) }).first().locator('select')
      } else loc = typeof target === 'string' ? page.locator(target).first() : target
      await h.hover(loc, opts)
      await page.waitForTimeout(250)
      await loc.selectOption(value)
      await page.waitForTimeout(150)
    },

    /**
     * Click a chip or button by its text, optionally inside `within` (a
     * selector). The chart panel's indicator chips and the demos' own chip
     * rows are plain buttons whose text is the label.
     */
    async clickChip(text, { within, selector = 'button', ...opts } = {}) {
      const scope = within ? page.locator(within).first() : page
      const re = text instanceof RegExp ? text : new RegExp('^\\s*' + escapeRe(String(text)) + '\\s*$', 'i')
      const loc = scope.locator(selector, { hasText: re }).first()
      return h.click(loc, opts)
    },

    /**
     * Ease the grid's scroll position to a fraction of its height over `ms`.
     * A single scrollTop assignment renders as two states; the eased version
     * shows continuous motion.
     */
    async easedScroll(fraction, ms = 4000, selector = '.sv-grid-container') {
      await page.evaluate(
        async ({ fraction, ms, selector }) => {
          const el = document.querySelector(selector)
          if (!el) throw new Error(`no scroller ${selector}`)
          const from = el.scrollTop
          const target = Math.floor((el.scrollHeight - el.clientHeight) * fraction)
          const start = performance.now()
          await new Promise((done) => {
            const step = (t) => {
              const p = Math.min(1, (t - start) / ms)
              const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
              el.scrollTop = from + (target - from) * eased
              if (p < 1) requestAnimationFrame(step)
              else done()
            }
            requestAnimationFrame(step)
          })
        },
        { fraction, ms, selector },
      )
    },

    /**
     * Open a column's Excel-style filter menu. The button is `width: 0` until
     * its header is hovered and shifts as it expands: hover, let the
     * transition settle, then measure and click by coordinate.
     */
    async clickHeaderFilter(columnRe) {
      const head = await page.evaluate((src) => {
        const re = new RegExp(src, 'i')
        for (const btn of document.querySelectorAll('.sv-grid-col-filter-btn')) {
          const hd = btn.closest('[role="columnheader"]')
          if (!hd || !re.test(hd.textContent ?? '')) continue
          const r = hd.getBoundingClientRect()
          if (r.right > innerWidth || r.bottom > innerHeight || r.x < 0 || r.y < 0) continue
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, col: hd.textContent?.trim() }
        }
        return null
      }, columnRe.source)
      if (!head) throw new Error(`no in-viewport header matching ${columnRe}`)
      await h.moveTo(head.x, head.y)
      await page.waitForTimeout(500)
      const pt = await page.evaluate((src) => {
        const re = new RegExp(src, 'i')
        for (const btn of document.querySelectorAll('.sv-grid-col-filter-btn')) {
          const hd = btn.closest('[role="columnheader"]')
          if (!hd || !re.test(hd.textContent ?? '')) continue
          const r = btn.getBoundingClientRect()
          if (r.width < 4) continue
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
        }
        return null
      }, columnRe.source)
      if (!pt) throw new Error(`filter button on "${head.col}" never expanded on hover`)
      log(`opening filter on "${head.col}"`)
      await h.moveTo(pt.x, pt.y, { ms: 200 })
      await page.mouse.click(pt.x, pt.y)
      return head.col
    },

    /**
     * Drag the fill handle of the current selection across `cells` cells.
     * Steps per cell so the pointermove handler runs and the dashed preview
     * grows with the drag.
     */
    async dragFillHandle({ cells = 4, stepPx, dir = 'right', perCellMs = 140 } = {}) {
      const handle = page.locator('.sv-grid-fill-handle').first()
      const b = await handle.boundingBox()
      if (!b) throw new Error('fill handle not visible: select a range first')
      if (!stepPx) {
        // One step per cell: measure the cell the handle sits in.
        const cell = await handle.evaluate((el) => {
          const c = el.closest('[role="gridcell"]') ?? el.parentElement
          const r = c.getBoundingClientRect()
          return { width: r.width, height: r.height }
        })
        stepPx = dir === 'down' ? cell.height : cell.width
      }
      const cx = b.x + b.width / 2
      const cy = b.y + b.height / 2
      await h.moveTo(cx, cy)
      await page.mouse.down()
      for (let i = 1; i <= cells; i += 1) {
        const x = dir === 'right' ? cx + i * stepPx : cx
        const y = dir === 'down' ? cy + i * stepPx : cy
        await page.mouse.move(x, y, { steps: 4 })
        await page.waitForTimeout(perCellMs)
      }
      await page.waitForTimeout(350)
      await page.mouse.up()
      last = { x: dir === 'right' ? cx + cells * stepPx : cx, y: dir === 'down' ? cy + cells * stepPx : cy }
    },

    /**
     * Native HTML5 drag and drop: the pivot designer's field chips and the
     * kanban cards are `draggable="true"` with dragstart/dragover/drop
     * handlers, which never see synthetic mouse moves. Dispatch the real
     * DragEvents with one shared DataTransfer while the visible cursor sweeps
     * from source to target, so the viewer sees a drag and the app gets one.
     * `source` / `target` are { selector, text?, within? }: the first element
     * matching `selector` whose text matches `text` (a RegExp), searched
     * inside the element described by `within` when given (so "the lane
     * body inside the lane titled Review" is expressible).
     */
    async dragHtml5(source, target, { ms = 900, hoverMs = 250 } = {}) {
      const plain = (d) => (d ? { selector: d.selector, text: d.text?.source, within: plain(d.within) } : undefined)
      const rects = await page.evaluate(
        ({ s, t }) => {
          const find = ({ selector, text, within }, root = document) => {
            const scope = within ? find(within, root) : root
            if (!scope) return null
            const re = text ? new RegExp(text, 'i') : null
            return [...scope.querySelectorAll(selector)].find((el) => !re || re.test(el.textContent ?? '')) ?? null
          }
          const se = find(s)
          const te = find(t)
          if (!se || !te) return { missing: !se ? 'source' : 'target' }
          const sr = se.getBoundingClientRect()
          const tr = te.getBoundingClientRect()
          window.__tutDrag = { se, te, dt: new DataTransfer() }
          return {
            s: { x: sr.x + sr.width / 2, y: sr.y + sr.height / 2 },
            t: { x: tr.x + tr.width / 2, y: tr.y + Math.min(tr.height / 2, 40) },
          }
        },
        { s: plain(source), t: plain(target) },
      )
      if (rects.missing) throw new Error(`dragHtml5: ${rects.missing} not found`)

      // No real mouse press: the pointer only travels for the camera. A real
      // mousedown/up pair would also be a click on the source (the pivot
      // designer's field chips toggle a checkbox on click).
      await h.moveTo(rects.s.x, rects.s.y)
      await page.waitForTimeout(hoverMs)
      await page.evaluate(() => {
        const { se, dt } = window.__tutDrag
        se.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
      })
      // Sweep in a few segments, firing dragover at the target as we arrive.
      const segs = 6
      for (let i = 1; i <= segs; i += 1) {
        const x = rects.s.x + ((rects.t.x - rects.s.x) * i) / segs
        const y = rects.s.y + ((rects.t.y - rects.s.y) * i) / segs
        await page.mouse.move(x, y, { steps: 6 })
        await page.waitForTimeout(ms / segs)
        if (i === segs - 1) {
          await page.evaluate(() => {
            const { te, dt } = window.__tutDrag
            te.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }))
            te.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
          })
        }
      }
      last = { x: rects.t.x, y: rects.t.y }
      await page.evaluate(() => {
        const { te, dt } = window.__tutDrag
        te.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
      })
      await page.waitForTimeout(hoverMs)
      await page.evaluate(() => {
        const { se, te, dt } = window.__tutDrag
        te.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
        se.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }))
        delete window.__tutDrag
      })
    },

    /**
     * Paint the viewport black for `ms` and remove it. The muxer finds this
     * flash with ffmpeg's blackdetect and trims the recording to its end, so
     * the video's zero and the beat clock share one origin.
     */
    async flashSync(ms = 150) {
      await page.evaluate(async (ms) => {
        const el = document.createElement('div')
        el.id = 'tut-sync'
        el.style.cssText = 'position:fixed;inset:0;background:#000;z-index:2147483646;pointer-events:none'
        document.body.appendChild(el)
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        await new Promise((r) => setTimeout(r, ms))
        el.remove()
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      }, ms)
    },

    /** Park the pointer somewhere harmless (default: lower right of the grid). */
    async park(x = viewport.width * 0.62, y = viewport.height * 0.7, opts) {
      await h.moveTo(x, y, opts)
    },
  }
  return h
}
