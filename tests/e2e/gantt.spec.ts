/**
 * E2E: the Gantt view - things jsdom cannot see.
 *  - demo 475: drag, resize, a phase drag, drawing a link, the arrow menu,
 *    undo; every arrow lands on a bar edge, a moved task keeps its working
 *    days, and a drag past the end of the window does not run away (the
 *    pane-filling axis once re-scaled under the pointer mid-drag).
 *  - demo 476: the critical path - the ringed chain, slack in working days,
 *    and the chart filling its pane.
 */
import { expect, test, type Page } from '@playwright/test'

// A plan is a wide document: at the default 1280 the demo's chart pane is a
// few hundred pixels and every long bar runs under its edge.
test.use({ viewport: { width: 1500, height: 1000 } })

const EDITING = '/sv-grid/#/demos/475-gantt-editing'
const CRITICAL = '/sv-grid/#/demos/476-gantt-critical-path'

const bar = (page: Page, key: string) => page.locator(`.sv-gantt-bar[data-key="${key}"]`)

/** The centre of the VISIBLE part of a bar. A long bar runs on under the
 *  scroll container's edge, and a pointer put at its geometric centre lands
 *  on whatever sits beside the chart. */
async function centre(page: Page, key: string) {
  const b = bar(page, key)
  await b.scrollIntoViewIfNeeded()
  const r = (await b.boundingBox())!
  const s = (await page.locator('.sv-gantt-scroll').boundingBox())!
  const left = Math.max(r.x, s.x + 4)
  const right = Math.min(r.x + r.width, s.x + s.width - 4)
  return { x: (left + right) / 2, y: r.y + r.height / 2, left, right, width: right - left }
}

async function drag(page: Page, fromX: number, fromY: number, toX: number, toY: number, steps = 16) {
  await page.mouse.move(fromX, fromY)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(fromX + ((toX - fromX) * i) / steps, fromY + ((toY - fromY) * i) / steps)
  }
  await page.mouse.up()
}

/** Pixels per day at the current zoom, off two adjacent day ticks (week preset). */
const dayPx = (page: Page) =>
  page.evaluate(() => {
    const t = [...document.querySelectorAll<HTMLElement>('.sv-gantt-tick')]
    return t[2]!.getBoundingClientRect().left - t[1]!.getBoundingClientRect().left
  })

/** The DAYS cell of a task row: its length in working days, as the table shows it. */
async function workingDaysOf(page: Page, name: string) {
  const row = page.locator('.sv-gantt-tr', { hasText: name }).first()
  const cells = await row.locator('.sv-gantt-td').allTextContents()
  // name | owner | days | progress
  return Number(cells[2]!.trim())
}

const leftOf = (page: Page, key: string) => bar(page, key).evaluate((el) => parseFloat((el as HTMLElement).style.left))

/**
 * Every arrow starts on its predecessor's edge and ends on its successor's -
 * on a side, or, for a task entered from above, on its top edge - and the head
 * sits on the end of the line. The check the eye cannot make at 2px.
 */
async function expectArrowsAnchored(page: Page) {
  const problems = await page.evaluate(() => {
    const body = document.querySelector('.sv-gantt-body')!.getBoundingClientRect()
    const bars = [...document.querySelectorAll<HTMLElement>('.sv-gantt-bar')].map((b) => {
      const r = b.getBoundingClientRect()
      const milestone = b.classList.contains('sv-gantt-bar-milestone')
      return { key: b.dataset.key, left: r.left - body.left, right: r.right - body.left, midY: (r.top + r.bottom) / 2 - body.top, halfH: r.height / 2, milestone }
    })
    const out: string[] = []
    const lines = [...document.querySelectorAll<SVGPathElement>('.sv-gantt-dep-line')]
    const heads = [...document.querySelectorAll<SVGPathElement>('.sv-gantt-dep-arrow')]
    lines.forEach((p, i) => {
      const pts = [...p.getAttribute('d')!.matchAll(/[ML]\s*(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const)
      const first = pts[0]!
      const last = pts[pts.length - 1]!
      const head = /M(-?[\d.]+),(-?[\d.]+)/.exec(heads[i]?.getAttribute('d') ?? '')
      if (!head || Math.abs(Number(head[1]) - last[0]) > 0.6 || Math.abs(Number(head[2]) - last[1]) > 0.6) out.push(`arrow ${i}: head off the line end`)
      const from = bars.find((b) => Math.abs(b.midY - first[1]) < 1 && (Math.abs(b.right - first[0]) < 20 || Math.abs(b.left - first[0]) < 20))
      const to = bars.find(
        (b) =>
          (Math.abs(b.midY - last[1]) < 1 && (Math.abs(b.left - last[0]) < 20 || Math.abs(b.right - last[0]) < 20)) ||
          (Math.abs(Math.abs(b.midY - last[1]) - b.halfH) < 1.5 && last[0] >= b.left - 0.5 && last[0] <= b.right + 0.5),
      )
      if (!from) out.push(`arrow ${i}: starts on no bar`)
      if (!to) out.push(`arrow ${i}: ends on no bar`)
      if (getComputedStyle(p).fill !== 'none') out.push(`arrow ${i}: line is filled`)
      for (let k = 1; k < pts.length; k++) {
        if (Math.abs(pts[k - 1]![0] - pts[k]![0]) > 0.01 && Math.abs(pts[k - 1]![1] - pts[k]![1]) > 0.01) out.push(`arrow ${i}: diagonal segment`)
      }
    })
    return out
  })
  expect(problems).toEqual([])
}

/** The Gantt demos are gated until their release date (tools/lib/releases.mjs);
 *  the suite tests the view, not the calendar, so it opens the site as it
 *  will read on the day. */
const onReleaseDay = (page: Page) => page.addInitScript(() => { (globalThis as { __SVGRID_TODAY__?: string }).__SVGRID_TODAY__ = '2026-11-01' })

test.describe('gantt editing (real browser)', () => {
  test.beforeEach(async ({ page }) => {
    await onReleaseDay(page)
    await page.goto(EDITING)
    await bar(page, 't1').waitFor()
  })

  test('draws the plan: phases, tasks, a milestone, one anchored arrow per link', async ({ page }) => {
    await expect(page.locator('.sv-gantt-bar-summary')).toHaveCount(3)
    await expect(page.locator('.sv-gantt-bar-milestone')).toHaveCount(1)
    await expect(page.locator('.sv-gantt-dep-line')).toHaveCount(7)
    await expectArrowsAnchored(page)
  })

  test('a task dragged before the plan start follows the pointer instead of running away', async ({ page }) => {
    // Scope & estimates opens the plan. Its bar can sit under the sticky
    // task table when the chart opens on today, so put it 120px into the
    // pane first, then drag it three days left, well inside the pane (the
    // edge zone would keep scrolling). The axis grows on the left as it
    // goes; the scroll position has to move with it, or every growth maps
    // the pointer to an earlier day and the bar runs off by weeks.
    const d = await dayPx(page)
    // The chart scrolls itself in once it has a width; place the bar after.
    await expect.poll(() => page.locator('.sv-gantt-scroll').evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
    await page.evaluate(() => {
      const sc = document.querySelector<HTMLElement>('.sv-gantt-scroll')!
      const b = document.querySelector<HTMLElement>('.sv-gantt-bar[data-key="t1"]')!
      sc.scrollLeft = Math.max(0, parseFloat(b.style.left) - 120)
    })
    await page.waitForTimeout(300)
    const before = await page.locator('.sv-gantt-bar[data-key="t1"]').getAttribute('aria-label')
    const bar = await page.locator('.sv-gantt-bar[data-key="t1"]').boundingBox()
    const table = await page.locator('.sv-gantt-table').boundingBox()
    const x0 = bar!.x + 12
    const y0 = bar!.y + bar!.height / 2
    // Three days, but never into the 32px edge zone beside the table.
    const x1 = Math.max(x0 - d * 3, table!.x + table!.width + 40)
    await page.mouse.move(x0, y0)
    await page.mouse.down()
    for (let i = 1; i <= 20; i++) {
      await page.mouse.move(x0 + ((x1 - x0) * i) / 20, y0)
      await page.waitForTimeout(12)
    }
    await page.mouse.up()
    await expect(page.locator('.ge-entry').first()).toContainText('onTaskMove')
    const after = await page.locator('.sv-gantt-bar[data-key="t1"]').getAttribute('aria-label')
    const dateOf = (label: string | null) => new Date(`${/, (\w{3} \d+)/.exec(label ?? '')?.[1]} 2026`).getTime()
    const movedDays = (dateOf(after) - dateOf(before)) / 86400000
    // Three days' travel lands within a weekend snap of three days back.
    expect(movedDays).toBeLessThanOrEqual(-2)
    expect(movedDays).toBeGreaterThanOrEqual(-5)
    await expectArrowsAnchored(page)
  })

  test('a dragged task keeps its working days and its successors cascade', async ({ page }) => {
    const d = await dayPx(page)
    const daysBefore = await workingDaysOf(page, 'Client')
    const t4Before = await leftOf(page, 't4')
    const t5Before = await leftOf(page, 't5')
    const c = await centre(page, 't4')
    await drag(page, c.x, c.y, c.x + d * 4, c.y)

    // Four days on from a Wednesday is a Sunday: the drop lands on Monday
    // (+5 days), and the task is still the same number of working days.
    await expect.poll(() => leftOf(page, 't4')).toBeGreaterThanOrEqual(t4Before + d * 4.5)
    expect(await workingDaysOf(page, 'Client')).toBe(daysBefore)
    // QA pass depends on Client, so it moved too, and the log says so.
    expect(await leftOf(page, 't5')).toBeGreaterThan(t5Before)
    await expect(page.locator('.ge-entry').first()).toContainText('onDependenciesChange')
    await expect(page.locator('.ge-entry', { hasText: 'onTaskMove' }).first()).toContainText('Client')
    await expectArrowsAnchored(page)
  })

  test('a dragged phase carries its whole subtree', async ({ page }) => {
    const d = await dayPx(page)
    const before = { t3: await leftOf(page, 't3'), t4: await leftOf(page, 't4') }
    const c = await centre(page, 'p2')
    await drag(page, c.x, c.y, c.x + d * 3, c.y)
    await expect.poll(() => leftOf(page, 't3')).toBeGreaterThan(before.t3)
    expect(await leftOf(page, 't4')).toBeGreaterThan(before.t4)
    await expect(page.locator('.ge-entry', { hasText: 'onTaskMove' }).first()).toContainText('in subtree')
    await expectArrowsAnchored(page)
  })

  test('the hover card closes when a drag starts', async ({ page }) => {
    const d = await dayPx(page)
    const c = await centre(page, 't4')
    await page.mouse.move(c.x, c.y)
    await expect(page.locator('.sv-gantt-tooltip')).toBeVisible()
    await page.mouse.down()
    await page.mouse.move(c.x + d, c.y)
    await page.mouse.move(c.x + d * 2, c.y)
    await expect(page.locator('.sv-gantt-tooltip')).toHaveCount(0)
    await page.mouse.up()
  })

  test('dragging a task past the end of the window moves it by the drag, not further', async ({ page }) => {
    // The axis window grows as the last task is dragged beyond it. With the
    // chart stretched to fill its pane, that once changed the scale under the
    // pointer mid-drag, and a 12-day drag ran away to 40.
    const d = await dayPx(page)
    const before = await leftOf(page, 't6')
    const c = await centre(page, 't6')
    await drag(page, c.x, c.y, c.x + d * 12, c.y, 24)
    await expect.poll(() => leftOf(page, 't6')).toBeGreaterThan(before)
    const moved = (await leftOf(page, 't6')) - before
    // Twelve days, give or take the working-day snap and the edge scroll a
    // drag that ends near the pane's edge gets - never forty.
    expect(moved / d).toBeGreaterThanOrEqual(10)
    expect(moved / d).toBeLessThanOrEqual(19)
  })

  test('drawing a link adds an arrow, a cycle is refused, and the arrow menu removes it', async ({ page }) => {
    // Zoom out so the whole plan is on screen: nothing may scroll between
    // grabbing a dot and reaching the target bar.
    await page.locator('.sv-gantt-zoom button[aria-label="Zoom out"]').click()
    await expect(page.locator('.sv-gantt-zoom-label')).toHaveText('month')
    await expect(page.locator('.sv-gantt-dep-line')).toHaveCount(7)

    // Service layer (t3) -> Release notes (t6): drag the end dot onto the bar.
    const from = await centre(page, 't3')
    await page.mouse.move(from.x, from.y)
    const dots = page.locator('.sv-gantt-row', { has: bar(page, 't3') }).locator('.sv-gantt-link-dot')
    const endDot = (await dots.last().boundingBox())!
    const to = await centre(page, 't6')
    await drag(page, endDot.x + endDot.width / 2, endDot.y + endDot.height / 2, to.x, to.y, 24)
    await expect(page.locator('.sv-gantt-dep-line')).toHaveCount(8)
    await expect(page.locator('.ge-entry').first()).toContainText('onDependencyAdd')
    await expectArrowsAnchored(page)

    // Release notes (t6) -> Scope (t1) would close a cycle: refused, no arrow.
    const from2 = await centre(page, 't6')
    await page.mouse.move(from2.x, from2.y)
    const dots2 = page.locator('.sv-gantt-row', { has: bar(page, 't6') }).locator('.sv-gantt-link-dot')
    const endDot2 = (await dots2.last().boundingBox())!
    const to2 = await centre(page, 't1')
    await drag(page, endDot2.x + endDot2.width / 2, endDot2.y + endDot2.height / 2, to2.x, to2.y, 24)
    await expect(page.locator('.sv-gantt-dep-line')).toHaveCount(8)

    // Right-click the new arrow: the menu names both ends and removes it.
    const mid = await page.evaluate(() => {
      const body = document.querySelector('.sv-gantt-body')!.getBoundingClientRect()
      const paths = [...document.querySelectorAll<SVGPathElement>('.sv-gantt-dep-line')]
      const m = /M([\d.]+),([\d.]+) L([\d.]+),([\d.]+)/.exec(paths[paths.length - 1]!.getAttribute('d')!)!
      return { x: body.left + (Number(m[1]) + Number(m[3])) / 2, y: body.top + Number(m[2]) }
    })
    await page.mouse.click(mid.x, mid.y, { button: 'right' })
    const menu = page.locator('.sv-gantt-menu')
    await expect(menu).toBeVisible()
    await expect(menu).toContainText('Remove link')
    await expect(menu).toContainText('Service layer')
    await menu.locator('[role="menuitem"]').first().click()
    await expect(page.locator('.sv-gantt-dep-line')).toHaveCount(7)
    await expect(page.locator('.ge-entry').first()).toContainText('onDependencyRemove')
  })

  test('undo puts every task back where it was', async ({ page }) => {
    const d = await dayPx(page)
    const labels = async () =>
      page.locator('.sv-gantt-bar').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
    const initial = await labels()
    const c = await centre(page, 't4')
    await drag(page, c.x, c.y, c.x + d * 4, c.y)
    await expect.poll(labels).not.toEqual(initial)
    const grip = await centre(page, 't2')
    await drag(page, grip.right - 3, grip.y, grip.right - 3 + d * 3, grip.y)
    await expect.poll(async () => (await labels()).join()).not.toEqual(initial.join())

    await bar(page, 't2').focus()
    for (let i = 0; i < 6; i++) await page.keyboard.press('Control+z')
    await expect.poll(labels).toEqual(initial)
    await page.keyboard.press('Control+Shift+z')
    await expect.poll(labels).not.toEqual(initial)
  })
})

test.describe('gantt critical path (real browser)', () => {
  test.beforeEach(async ({ page }) => {
    await onReleaseDay(page)
    await page.goto(CRITICAL)
    await bar(page, 't1').waitFor()
  })

  test('rings the chain with no slack, arrows included, and reports slack in working days', async ({ page }) => {
    const ringed = await page.locator('.sv-gantt-bar.sv-gantt-critical').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.key).sort())
    expect(ringed).toEqual(['m1', 'p1', 'p2', 'p3', 't1', 't2', 't3', 't6', 't7'])
    await expect(page.locator('.sv-gantt-dep-line.sv-gantt-dep-critical')).toHaveCount(5)
    // The slack column: nothing on the chain has room; the joinery branch has two working days.
    const slack = async (name: string) => {
      const cells = await page.locator('.sv-gantt-tr', { hasText: name }).first().locator('.sv-gantt-td').allTextContents()
      return Number(cells[cells.length - 1]!.trim())
    }
    expect(await slack('Structural works')).toBe(0)
    expect(await slack('Joinery')).toBe(2)
    expect(await slack('Signage')).toBe(2)
    await expect(page.locator('.cp-path')).toContainText('Strip out')
    await expectArrowsAnchored(page)
  })

  test('moving a critical task hands its room to the one it left behind', async ({ page }) => {
    // At the month preset a tick is a week.
    const weekPx = await page.evaluate(() => {
      const t = [...document.querySelectorAll<HTMLElement>('.sv-gantt-tick')]
      return t[2]!.getBoundingClientRect().left - t[1]!.getBoundingClientRect().left
    })
    const c = await centre(page, 't2')
    await drag(page, c.x, c.y, c.x + weekPx, c.y, 24)
    // Strip out is no longer critical: the week it now has is its slack.
    await expect(bar(page, 't1')).not.toHaveClass(/sv-gantt-critical/)
    await expect(bar(page, 't2')).toHaveClass(/sv-gantt-critical/)
    await expect(page.locator('.cp-path')).not.toContainText('Strip out')
    const cells = await page.locator('.sv-gantt-tr', { hasText: 'Strip out' }).first().locator('.sv-gantt-td').allTextContents()
    expect(Number(cells[cells.length - 1]!.trim())).toBeGreaterThan(0)
    await expectArrowsAnchored(page)
  })

  test('the chart fills the pane beside the task table', async ({ page }) => {
    const { body, pane } = await page.evaluate(() => {
      const scroll = document.querySelector<HTMLElement>('.sv-gantt-scroll')!
      const table = document.querySelector<HTMLElement>('.sv-gantt-table')!
      const body = document.querySelector<HTMLElement>('.sv-gantt-body')!
      return { body: body.offsetWidth, pane: scroll.clientWidth - table.offsetWidth }
    })
    // A short plan at a coarse preset stretches to the pane's width rather
    // than stopping part way across; never a pixel over it (a scrollbar).
    expect(body).toBeGreaterThanOrEqual(pane - 3)
    expect(body).toBeLessThanOrEqual(pane)
  })
})
