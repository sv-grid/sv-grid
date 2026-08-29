import { test, expect, type Page } from '@playwright/test'

/**
 * Phone-viewport guard for the demo gallery.
 *
 * The invariant that matters is NOT "the page doesn't scroll sideways" - the
 * shell's `<main>` is `overflow-x: hidden`, so that is trivially true even
 * when a demo is badly broken. It just means the overflowing part is CLIPPED,
 * i.e. silently invisible on a phone. That was the actual bug.
 *
 * So this asserts the real thing: nothing sticks out past the demo stage
 * unless it is reachable by scrolling. Two kinds of overflow are sanctioned:
 *   - anything inside a real horizontal scroller (the grid's own container,
 *     the kanban board's lane strip, ...), which the user can pan;
 *   - anything inside `[data-mobile-pan]`, a region a demo has explicitly
 *     declared it wants to pan (see 45-gantt-chart).
 * Anything else is content the user can never see.
 *
 * Second invariant: the demo pane is not starved of height. The header is
 * `shrink-0` and the stage is `flex-1`, so an unclamped blurb used to wrap to
 * many lines and squeeze the demo toward zero height - invisible to any
 * overflow check, which is why it is asserted separately.
 *
 * A representative demo per family rather than all 365; this is a regression
 * gate that has to stay fast. `node tools/audit-mobile.mjs` is the exhaustive
 * sweep and additionally reports clipped-by-an-ancestor cases for triage.
 *
 * Runs against the gallery on :5174 (see playwright.config.ts), so it does not
 * need the private website submodule.
 */

const MIN_STAGE_H = 400
// The demo PANE, not the stage: the `flex-1 min-h-0` child of the demo's root
// section that holds the grid. The stage can be a healthy 700px while this is
// 0px, because everything above it (a KPI strip, a chip toolbar) is `shrink-0`
// and the pane alone absorbs the shortfall. mobile.css rule 4b floors it.
const MIN_PANE_H = 300

const DEMOS = [
  // plain grid
  '01-quick-start',
  '02-sort-filter-paginate',
  '00-trading-desk',
  '06-large-dataset',
  // KPI dashboards - the fixed repeat(4-6) strips
  '49-admin-dashboard',
  '43-compliance-queue',
  '118-live-dashboard',
  '345-ops-dashboard',
  // the `.wrap` UI-kit family
  '254-text-inputs',
  '300-number-input',
  '322-form',
  '258-calendar-range',
  // chart split (inline fixed-width panel beside the grid)
  '147-integrated-charts',
  '151-time-series-chart',
  // shared global chrome layers
  '207-blank-sheet',
  '193-studio-live-sql',
  // component-heavy families
  '343-kanban-board',
  '52-pivot-table',
  '361-dock-layout',
  '11-stock-market',
  '81-mobile-card-view',
  // declared pan regions - these SHOULD pan, and must not escape the stage
  '45-gantt-chart',
  '381-scheduler-app-calendar',
]

/**
 * Collect elements that escape the stage with no way to scroll to them.
 * Mirrors `containment()` in tools/audit-mobile.mjs - keep the two in step.
 */
async function escapingElements(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector('.demo-stage')
    if (!stage) return { hasStage: false, escaping: [] as string[], stageH: 0, paneH: -1, pageOverflow: 0 }

    const right = stage.getBoundingClientRect().right
    const canPan = (el: Element) => {
      const ox = getComputedStyle(el).overflowX
      return (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1
    }

    const escaping: string[] = []
    for (const el of stage.querySelectorAll('*')) {
      const b = el.getBoundingClientRect()
      if (b.width < 2 || b.height < 2) continue
      if (b.right <= right + 1) continue

      // Walk the whole chain; reachable beats clipped. Stopping at the first
      // clipping ancestor would be wrong - a grid header cell clips its own
      // overflow while the grid container above it scrolls.
      let sanctioned = false
      for (let p: Element | null = el; p && p !== stage; p = p.parentElement) {
        if (p.hasAttribute('data-mobile-pan')) { sanctioned = true; break }
        if (p === el) continue
        if (canPan(p)) { sanctioned = true; break }
        // An ancestor that hides overflow while itself fitting is clipping on
        // purpose (a carousel track, an animated progress fill). Not this
        // test's business - audit-mobile.mjs reports those for human triage.
        const ox = getComputedStyle(p).overflowX
        if ((ox === 'hidden' || ox === 'clip') && p.getBoundingClientRect().right <= right + 1) {
          sanctioned = true
        }
      }
      // A scrolling stage makes everything inside it reachable - that is the
      // sanctioned treatment for a demo too wide to fit.
      if (!sanctioned && canPan(stage)) sanctioned = true
      if (sanctioned) continue

      const cls = typeof el.className === 'string' ? el.className : ''
      escaping.push(
        `${el.tagName.toLowerCase()}${cls ? '.' + cls.trim().split(/\s+/).join('.') : ''} ` +
          `(+${Math.round(b.right - right)}px)`,
      )
    }

    // -1 when the demo has no such pane (the `.wrap` UI-kit family, sheets),
    // so the assertion on it is skipped rather than failed.
    const pane = stage.querySelector(':scope > section > .flex-1.min-h-0')

    return {
      hasStage: true,
      escaping: [...new Set(escaping)].slice(0, 5),
      stageH: Math.round(stage.clientHeight),
      paneH: pane ? Math.round(pane.clientHeight) : -1,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
}

for (const id of DEMOS) {
  test(`${id}: fits a phone`, async ({ page }) => {
    await page.goto(`http://localhost:5174/#/${id}`)
    // Wait for the demo to actually paint before measuring; an empty stage
    // trivially "fits" and would make this pass for the wrong reason.
    await page
      .waitForSelector(
        '.demo-stage .sv-grid-container, .demo-stage svg, .demo-stage canvas, .demo-stage section, .demo-stage .wrap',
        { timeout: 20_000 },
      )
      .catch(() => {})
    await page.waitForTimeout(700)

    const r = await escapingElements(page)

    expect(r.hasStage, 'the shell should tag the demo wrapper with .demo-stage').toBe(true)
    expect(
      r.escaping,
      `content is off-screen with no way to scroll to it:\n  ${r.escaping.join('\n  ')}`,
    ).toEqual([])
    expect(r.pageOverflow, `page scrolls sideways by ${r.pageOverflow}px`).toBeLessThanOrEqual(0)
    expect(r.stageH, `demo pane starved to ${r.stageH}px by the chrome above it`).toBeGreaterThan(
      MIN_STAGE_H,
    )
    if (r.paneH >= 0) {
      expect(
        r.paneH,
        `the grid pane is only ${r.paneH}px tall - the demo's own chrome ate it (mobile.css 4b should floor it)`,
      ).toBeGreaterThanOrEqual(MIN_PANE_H)
    }
  })
}

/**
 * Galaxy S24 Ultra in Chrome with the URL bar showing: 384x745. The trading
 * desk is the hero demo, and its KPI strip + chip toolbar are `shrink-0` above
 * a `flex-1 min-h-0` grid pane, so on this viewport the pane collapsed to ~0px
 * and - with nothing overflowing - the page could not even scroll to it. Two
 * things fix it and both are asserted: the pane floor (mobile.css 4b) gives
 * the grid a real height and makes the shell's <main> scroll to it, and the
 * demo's own phone trims keep its chrome small enough that the grid gets the
 * screen rather than the floor.
 */
test.describe('Galaxy S24 Ultra portrait', () => {
  test.use({
    viewport: { width: 384, height: 745 },
    deviceScaleFactor: 3.75,
    hasTouch: true,
    isMobile: true,
  })

  test('00-trading-desk: the grid keeps a real height and is reachable by scrolling', async ({ page }) => {
    await page.goto('http://localhost:5174/#/00-trading-desk')
    await page.waitForSelector('.demo-stage .sv-grid-root', { timeout: 20_000 })
    await page.waitForTimeout(700)

    const r = await page.evaluate(() => {
      const grid = document.querySelector('.demo-stage .sv-grid-root')!
      const main = document.querySelector('main')!
      const h = (sel: string) => Math.round(document.querySelector(sel)!.getBoundingClientRect().height)
      const chrome = { kpi: h('.td-kpi-strip'), toolbar: h('.td-toolbar') }
      const scrollable = main.scrollHeight > main.clientHeight + 1
      // The shell's <main> is the vertical scroller. Scroll it all the way
      // down: the grid's bottom edge must then sit inside the viewport.
      main.scrollTop = main.scrollHeight
      const b = grid.getBoundingClientRect()
      return { gridH: Math.round(b.height), gridBottom: Math.round(b.bottom), vh: innerHeight, chrome, scrollable }
    })

    expect(r.gridH, `grid is only ${r.gridH}px tall`).toBeGreaterThanOrEqual(MIN_PANE_H)
    expect(
      r.gridBottom,
      `grid bottom (${r.gridBottom}px) is below the ${r.vh}px viewport even after scrolling <main> to the end`,
    ).toBeLessThanOrEqual(r.vh + 1)
    expect(
      r.chrome.kpi + r.chrome.toolbar,
      `KPI strip (${r.chrome.kpi}px) + toolbar (${r.chrome.toolbar}px) - the demo's phone trims are not applying`,
    ).toBeLessThan(340)
  })
})

test('long blurbs stay clamped so the demo keeps its height', async ({ page }) => {
  // 194-studio-supabase has one of the longest blurbs in the registry, so it is
  // the worst case for the header-starves-the-stage bug.
  await page.goto('http://localhost:5174/#/194-studio-supabase')
  await page.waitForTimeout(900)

  const header = await page.evaluate(() => {
    const h = document.querySelector('.demo-head')
    return h ? Math.round(h.getBoundingClientRect().height) : -1
  })
  expect(header, '.demo-head should exist').toBeGreaterThan(0)
  expect(header, `header is ${header}px tall - the blurb clamp is not applying`).toBeLessThan(160)
})

/**
 * Landscape. A phone on its side is 844x390, which does NOT match
 * `max-width: 767px` - so none of the width-based mobile CSS applies and the
 * chrome is at full desktop size inside a 390px-tall viewport. That combination
 * left several demos with a stage of 0-2px: the header alone measured 440px.
 *
 * The fix keys off `(max-height: 500px) and (pointer: coarse)`, so these tests
 * must run with touch emulation or they assert nothing.
 */
test.describe('landscape phone', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })

  // Worst cases: the longest blurb in the registry, a demo with a tall
  // shrink-0 header of its own, and a plain grid as the control.
  for (const id of ['194-studio-supabase', '343-kanban-board', '322-form', '01-quick-start']) {
    test(`${id}: demo pane survives landscape`, async ({ page }) => {
      await page.goto(`http://localhost:5174/#/${id}`)
      await page.waitForTimeout(1200)

      const r = await page.evaluate(() => {
        const stage = document.querySelector('.demo-stage')
        const head = document.querySelector('.demo-head')
        const pane = stage ? stage.querySelector(':scope > section > .flex-1.min-h-0') : null
        return {
          coarse: matchMedia('(pointer: coarse)').matches,
          stageH: stage ? Math.round(stage.clientHeight) : 0,
          paneH: pane ? Math.round(pane.clientHeight) : -1,
          headH: head ? Math.round(head.getBoundingClientRect().height) : -1,
          pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      })

      // Guard the guard: without coarse-pointer emulation the fix is inert and
      // every assertion below would be testing the wrong thing.
      expect(r.coarse, 'needs touch emulation for the landscape CSS to apply').toBe(true)
      expect(r.headH, `header ate ${r.headH}px of a 390px screen`).toBeLessThan(120)
      expect(r.stageH, `demo pane is only ${r.stageH}px tall in landscape`).toBeGreaterThan(100)
      // The landscape pane floor (240px in mobile.css); a KPI strip plus a
      // two-line toolbar otherwise leave the grid 0px in a ~200px stage.
      if (r.paneH >= 0) {
        expect(r.paneH, `grid pane is only ${r.paneH}px tall in landscape`).toBeGreaterThanOrEqual(200)
      }
      expect(r.pageOverflow, 'page scrolls sideways').toBeLessThanOrEqual(0)
    })
  }
})
