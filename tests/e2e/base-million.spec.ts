/**
 * E2E: demo 723, a table of a million records. A table this size is never in the
 * page, so what is asserted here is what a fake table cannot show: every view
 * reads the true size, nothing is written by looking, links and rollups reach
 * records the page never held, and a write lands where it should.
 */
import { expect, test, type Page } from '@playwright/test'

const MILLION = '1,000,000 records'

async function open(page: Page) {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto('/sv-grid/#/demos/723-base-million-orders')
  await page.locator('text=SO-100010').first().waitFor({ timeout: 120_000 })
  await page.evaluate(() => document.querySelectorAll('[data-svgrid-enterprise-upgrade]').forEach((n) => n.remove()))
}
async function view(page: Page, name: string) {
  await page.locator('.sv-fvb-view').first().click()
  await page.locator('.sv-fviews-pick').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) }).first().click()
}
const tab = (page: Page, name: string) => page.locator('[class*=sv-btabs]').getByText(name, { exact: true }).first().click()
const count = (page: Page) => page.locator('.sv-fvb').first()
const laneSum = async (page: Page) =>
  (await page.locator('.sv-board-lane-count').allInnerTexts()).reduce((n, t) => n + Number(t.replace(/\D/g, '')), 0)

test.describe('SvGrid Base: a million records (real browser)', () => {
  test.setTimeout(120_000)

  test('every view reads all of it, and looking writes nothing', async ({ page }) => {
    await open(page)
    await expect(count(page)).toContainText(MILLION)
    for (const name of ['Board', 'Calendar', 'Timeline', 'Gallery', 'List', 'Inbox', 'Revenue by month']) {
      await view(page, name)
      await expect(count(page)).toContainText(MILLION)
    }
    // Back on the board after every other view: a write would show in its lanes.
    await view(page, 'Board')
    await expect.poll(() => laneSum(page)).toBe(1_000_000)
  })

  test('a board draws what is in sight, from anywhere in a lane', async ({ page }) => {
    await open(page)
    await view(page, 'Board')
    await expect.poll(() => laneSum(page)).toBe(1_000_000)
    await page.locator('.sv-board-lane-body').nth(1).evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    await expect(page.locator('.sv-board-lane').nth(1).locator('.sv-board-card:not(.is-loading)').last()).toContainText('SO-', { timeout: 10_000 })
    expect(await page.locator('.sv-board-card').count()).toBeLessThan(120)
  })

  test('a busy calendar day says how many it holds, and lists them all', async ({ page }) => {
    await open(page)
    await view(page, 'Calendar')
    const more = page.locator('.sv-sched-more').first()
    await expect(more).toContainText(/\+[\d,]{5} more/, { timeout: 15_000 })
    await more.click()
    await expect(page.locator('.sv-fbase-dayrec').first()).toBeVisible()
  })

  test('a calendar month scrolls its last days clear of the "+", and every chip still fits its week', async ({ page }) => {
    await open(page)
    await view(page, 'Calendar')
    await expect(page.locator('.sv-sched-more').first()).toContainText(/\+[\d,]{5} more/, { timeout: 15_000 })
    const found = await page.evaluate(() => {
      const body = document.querySelector('.sv-sched-monthbody')!
      body.scrollTop = body.scrollHeight
      const fab = document.querySelector('.sv-fbase-fab')!.getBoundingClientRect()
      const name = (e: Element) => `${e.className}: ${e.textContent?.trim()}`
      const under = [...document.querySelectorAll('.sv-sched-bar, .sv-sched-more, .sv-sched-daynum')].filter((e) => {
        const b = e.getBoundingClientRect()
        return b.left < fab.right && b.right > fab.left && b.top < fab.bottom && b.bottom > fab.top
      })
      const cut = [...document.querySelectorAll('.sv-sched-week')].flatMap((w) => {
        const week = w.getBoundingClientRect()
        return [...w.querySelectorAll('.sv-sched-bar, .sv-sched-more')].filter((e) => e.getBoundingClientRect().bottom > week.bottom + 0.5)
      })
      return { under: under.map(name), cut: cut.map(name) }
    })
    expect(found).toEqual({ under: [], cut: [] })
  })

  test('a dashboard adds up the whole table', async ({ page }) => {
    await open(page)
    await view(page, 'Dashboard')
    await expect(page.locator('.sv-fdash-number').first()).toHaveText('1,000,000', { timeout: 15_000 })
  })

  test('a rollup over the million, and a lookup of a record the page never held', async ({ page }) => {
    await open(page)
    await tab(page, 'Customers')
    await expect(page.locator('[role="row"]').nth(1)).toContainText('4,924', { timeout: 20_000 })
    await tab(page, 'Returns')
    await expect(page.locator('[role="row"]').nth(5)).toContainText('SO-900003', { timeout: 20_000 })
  })

  test('the link picker searches all of it', async ({ page }) => {
    await open(page)
    await tab(page, 'Returns')
    const cell = page.locator('[role="gridcell"][data-col-id="order"]').first()
    await expect(cell).toContainText('SO-', { timeout: 20_000 })
    const box = (await cell.boundingBox())!
    await page.mouse.dblclick(box.x + box.width - 5, box.y + box.height / 2)
    await expect(page.locator('.sv-flp-more')).toContainText('1,000,000')
    await page.locator('.sv-flp-search').fill('SO-987654')
    await expect(page.locator('.sv-flp-row').first()).toContainText('SO-987654')
  })

  test('a link made from the side with no list moves the count', async ({ page }) => {
    await open(page)
    await tab(page, 'Customers')
    const row = page.locator('[role="row"]').nth(1)
    await expect(row).toContainText('4,924', { timeout: 20_000 })
    const box = (await page.locator('[role="gridcell"][data-col-id="orders"]').first().boundingBox())!
    // The cell's own padding: its right edge is the "+N" button.
    await page.mouse.dblclick(box.x + 2, box.y + box.height / 2)
    await page.locator('.sv-flp-search').fill('SO-999999')
    await expect(page.locator('.sv-flp-row').first()).toContainText('SO-999999')
    await page.locator('.sv-flp-row').first().click()
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(row).toContainText('4,925', { timeout: 20_000 })
  })

  test('a new record is a draft: filled from the view, gone if left empty, stored at its first value', async ({ page }) => {
    await open(page)
    await view(page, 'Big EU orders')
    await expect(count(page)).toContainText('4,423 records')
    const add = page.locator('.sv-fbase-fab[aria-label="Add record"]')
    const record = page.locator('[role="dialog"]').first()

    await add.click()
    await expect(record).toContainText('EU')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(record).toBeHidden()
    await expect(count(page)).toContainText('4,423 records')
    await expect(page.locator('[role="row"]').nth(1)).toContainText('SO-')

    await add.click()
    const amount = await record.getByText('Amount', { exact: true }).first().boundingBox()
    await page.mouse.click(amount!.x + 120, amount!.y + 34)
    await page.keyboard.type('6000')
    await page.keyboard.press('Enter')
    // The order number is the database's, and the first value stays.
    await expect(record).toContainText('SO-1100000')
    await expect(record).toContainText('$6,000.00')
    await expect(record).toContainText('$1,200.00')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(record).toBeHidden()
    await expect(count(page)).toContainText('4,424 records')
  })

  test('the "+" for a new field is in sight on a wide table, and the field arrives', async ({ page }) => {
    await open(page)
    const adder = page.locator('.sv-field-column-adder-button').first()
    const box = await adder.boundingBox()
    expect(box!.x + box!.width).toBeLessThan(1400)
    await adder.click()
    const editor = page.locator('[role="dialog"]').first()
    await editor.locator('input[type=text], input:not([type])').first().fill('Priority note')
    await editor.getByRole('button', { name: 'Create field' }).click()
    await expect(page.locator('[role="columnheader"]').filter({ hasText: 'Priority' })).toBeVisible()
  })

  test('on a phone a Timeline keeps its names and a grouped view its groups', async ({ page }) => {
    await open(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await view(page, 'Timeline')
    const head = page.locator('.sv-gantt-table-head > *')
    await expect(head).toHaveText(['Order'])
    expect((await head.first().boundingBox())!.width).toBeGreaterThan(100)
    await view(page, 'By status')
    await expect(page.locator('.sv-flist-ghead').first()).toContainText('New', { timeout: 20_000 })
    await expect(page.locator('.sv-gal-card')).toHaveCount(0)
  })

  test('the room for the "+" is inside what scrolls: no band under a board or a month', async ({ page }) => {
    await open(page)
    const frame = await page.locator('.sv-fbase-body').boundingBox()
    const end = frame!.y + frame!.height
    const bottom = async (selector: string) => {
      const box = await page.locator(selector).first().boundingBox()
      return box ? box.y + box.height : 0
    }
    await view(page, 'Board')
    await expect(page.locator('.sv-board-card').first()).toBeVisible({ timeout: 20_000 })
    await expect.poll(() => bottom('.sv-board-lane')).toBeGreaterThan(end - 12)
    await view(page, 'Calendar')
    await expect(page.locator('.sv-sched-more').first()).toBeVisible({ timeout: 20_000 })
    await expect.poll(() => bottom('.sv-sched-monthbody')).toBeGreaterThan(end - 4)
  })

  test('the grid goes by the table\'s name', async ({ page }) => {
    await open(page)
    await expect(page.getByRole('grid', { name: 'Orders' }).or(page.getByRole('treegrid', { name: 'Orders' }))).toBeVisible()
  })

  test('the list stays under the height that paints straight, and agrees with its scrollbar at both ends', async ({ page }) => {
    await open(page)
    const sc = page.locator('.sv-grid-container').first()
    const first = () => page.locator('tbody tr.sv-grid-row:not(.sv-grid-row-spacer)').first()
    expect(await sc.evaluate((n) => n.scrollHeight)).toBeLessThan(2 ** 24)
    // A pixel is a pixel near the top: row 11 is 300px down.
    await sc.evaluate((n) => { n.scrollTop = 300 })
    await expect(page.locator('tbody tr.sv-grid-row', { hasText: 'SO-100010' }).first()).toBeVisible()
    await sc.evaluate((n) => { n.scrollTop = 1e12 })
    await expect(page.locator('tbody tr.sv-grid-row', { hasText: 'SO-1099999' }).first()).toBeVisible({ timeout: 30_000 })
    // The rows do not push past the end they were scaled to.
    const height = await sc.evaluate((n) => n.scrollHeight)
    await sc.evaluate((n) => { n.scrollTop -= 300 })
    await expect(first()).toBeVisible()
    await page.waitForTimeout(400)
    expect(await sc.evaluate((n) => n.scrollHeight)).toBe(height)
    // Ctrl+End puts the last row in view, not under the fold.
    await sc.evaluate((n) => { n.scrollTop = 0 })
    await page.getByText('SO-100001', { exact: true }).first().click()
    await page.keyboard.press('Control+End')
    const last = page.locator('tbody tr.sv-grid-row', { hasText: 'SO-1099999' }).first()
    await expect(last).toBeVisible({ timeout: 30_000 })
    const box = await sc.boundingBox()
    await expect.poll(async () => ((await last.boundingBox())?.y ?? 1e9) + 30).toBeLessThanOrEqual(box!.y + box!.height + 1)
  })

  test('a drag of the scrollbar shows where it is, and the rows where it stops come at once', async ({ page }) => {
    await open(page)
    await page.waitForTimeout(500)
    const bar = await page.evaluate(() => {
      const sb = document.querySelector('sv-grid-scrollbar[orientation="vertical"]')!
      const box = (e: Element) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height } }
      return { thumb: box(sb.shadowRoot!.querySelector('.thumb')!), track: box(sb.shadowRoot!.querySelector('.track')!) }
    })
    const x = bar.thumb.x + bar.thumb.w / 2
    const y = bar.thumb.y + bar.thumb.h / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let i = 1; i <= 40; i++) await page.mouse.move(x, y + (bar.track.h * 0.5 * i) / 40)
    // Mid-drag, or just stopped: a row not read yet still says its number.
    const number = page.locator('.sv-grid-placeholder-row .sv-grid-row-number-cell').first()
    if (await number.count()) expect(Number((await number.innerText()).replace(/\D/g, ''))).toBeGreaterThan(100_000)
    await page.mouse.up()
    const stopped = Date.now()
    await expect(page.locator('.sv-grid-placeholder-row')).toHaveCount(0, { timeout: 5000 })
    // One read and the time to see the drag has stopped, not the blocks it flew past.
    expect(Date.now() - stopped).toBeLessThan(2500)
    const first = await page.locator('.sv-grid-row:not(.sv-grid-row-spacer) .sv-grid-row-number-cell').nth(5).innerText()
    expect(Number(first.replace(/\D/g, ''))).toBeGreaterThan(100_000)
  })

  test('a Gallery has records ahead of a brisk scroll', async ({ page }) => {
    await open(page)
    await view(page, 'Gallery')
    await page.getByText('SO-100000', { exact: true }).first().waitFor()
    const box = (await page.locator('.sv-gal').first().boundingBox())!
    await page.mouse.move(box.x + 200, box.y + 200)
    let blank = 0
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, 300)
      await page.waitForTimeout(100)
      const cards = await page.locator('.sv-gal-card:not(.is-loading)').count()
      if (!cards) blank += 1
    }
    expect(blank).toBeLessThanOrEqual(2)
  })

  test('switching between a Calendar, a Timeline and a Gallery keeps no nodes', async ({ page }) => {
    test.setTimeout(180_000)
    await open(page)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Performance.enable')
    const nodes = async () => {
      // The watermark's timers hold a view for a few seconds.
      await page.waitForTimeout(6500)
      await cdp.send('HeapProfiler.collectGarbage')
      await cdp.send('HeapProfiler.collectGarbage')
      const { metrics } = await cdp.send('Performance.getMetrics')
      return metrics.find((m) => m.name === 'Nodes')!.value
    }
    const round = async () => {
      for (const name of ['Calendar', 'Timeline', 'Calendar', 'Gallery', 'Timeline', 'Gallery']) {
        await view(page, name)
        await page.waitForTimeout(900)
      }
    }
    await round()
    const before = await nodes()
    await round()
    await round()
    // A round kept thousands when these views stayed behind.
    expect((await nodes()) - before).toBeLessThan(500)
  })

  test('a record says its place among all of them, and Next goes past what is loaded', async ({ page }) => {
    await open(page)
    const pos = page.locator('.sv-frv-pos')
    const next = page.getByRole('button', { name: 'Next record' })
    await view(page, 'Gallery')
    await page.getByText('SO-100000', { exact: true }).first().click()
    await expect(pos).toHaveText('1 of 1,000,000')
    for (let i = 0; i < 65; i++) await next.click()
    await expect(pos).toHaveText('66 of 1,000,000')
    await page.keyboard.press('Escape')

    await view(page, 'Board')
    await page.locator('.sv-board-card').first().click({ position: { x: 12, y: 12 } })
    await expect(pos).toHaveText('1 of 1,000,000')
    await page.keyboard.press('Escape')

    // A calendar's record has its place among every record, by date.
    await view(page, 'Calendar')
    await page.locator('.sv-sched-bar').first().click()
    await expect(pos).toHaveText(/^\d{3},\d{3} of 1,000,000$/, { timeout: 30_000 })
    await expect(next).toBeEnabled()
    await page.keyboard.press('Escape')

    await view(page, 'All orders')
    await page.locator('.sv-fbase-fab').click()
    await expect(pos).toHaveText('New record')
  })

  test('select all is every record of the view, and undo brings them back', async ({ page }) => {
    await open(page)
    const all = page.getByRole('checkbox', { name: 'Select all rows' })
    const bar = page.locator('.sv-selbar')
    const ask = page.getByRole('dialog')
    await all.click()
    await expect(bar).toContainText('1,000,000')
    await bar.getByRole('button', { name: 'Delete' }).click()
    await expect(ask).toContainText('cannot be restored', { timeout: 60_000 })
    await ask.getByRole('button', { name: 'Cancel' }).click()
    await all.click()
    await expect(bar).toBeHidden()

    await view(page, 'Big EU orders')
    await expect(count(page)).toContainText('4,423 records')
    await all.click()
    await expect(bar).toContainText('4,423')
    const spared = await page.locator('[role="row"]').nth(1).locator('[role="checkbox"]').first()
    await spared.click()
    await expect(bar).toContainText('4,422')
    await bar.getByRole('button', { name: 'Delete' }).click()
    await expect(ask).toContainText('Delete 4,422 records?', { timeout: 30_000 })
    await expect(ask).not.toContainText('cannot be restored')
    await ask.getByRole('button', { name: 'Delete' }).click()
    await expect(count(page)).toContainText('1 record', { timeout: 30_000 })
    await page.locator('.sv-btabs-tool[aria-label^="Undo"]').first().click()
    await expect(count(page)).toContainText('4,423 records', { timeout: 30_000 })
  })

  test('Edit fields on every record asks first with the exact number, and a small one has progress, Stop and Undo', async ({ page }) => {
    test.setTimeout(240_000)
    await open(page)
    const all = page.getByRole('checkbox', { name: 'Select all rows' })
    const bar = page.locator('.sv-selbar')
    const ask = page.getByRole('dialog', { name: 'Edit records' })
    const pick = async (field: string, value: string) => {
      await bar.getByRole('button', { name: /Edit fields/ }).click()
      const drawer = page.locator('.sv-drawer').last()
      await drawer.locator('.sv-form__field').filter({ hasText: field }).locator('button').first().click()
      await page.locator('.sv-ddl__opt').filter({ hasText: value }).first().click()
      await drawer.getByRole('button', { name: /Apply to/ }).click()
    }
    await all.click()
    await pick('Region', 'LATAM')
    // A record that holds the value already is no change, so the number is under the million.
    await expect(ask).toContainText(/Change [\d,]+ records\?/, { timeout: 60_000 })
    await expect(ask).toContainText('too many to undo')
    const said = Number(/Change ([\d,]+) records/.exec((await ask.innerText()))![1]!.replace(/,/g, ''))
    expect(said).toBeGreaterThan(10_000)
    expect(said).toBeLessThan(1_000_000)
    await ask.getByRole('button', { name: 'Cancel' }).click()
    await expect(ask).toBeHidden()
    await all.click()

    await view(page, 'Big EU orders')
    await expect(count(page)).toContainText('4,423 records')
    const rows = page.locator('.sv-grid-row').filter({ hasText: 'SO-' })
    const showing = async (status: string) => (await rows.allInnerTexts()).filter((t) => t.includes(status)).length
    await expect(rows.first()).toBeVisible()
    const before = await showing('Returned')
    const shown = await rows.count()
    expect(before).toBeLessThan(shown)
    await all.click()
    await pick('Status', 'Returned')
    await expect(ask).toBeHidden({ timeout: 30_000 })
    await expect.poll(() => showing('Returned'), { timeout: 15_000 }).toBe(await rows.count())
    await page.locator('.sv-btabs-tool[aria-label^="Undo"]').first().click()
    await expect.poll(() => showing('Returned'), { timeout: 30_000 }).toBe(before)
  })

  test('a sort on a lookup no database here can compute reads the table and answers', async ({ page }) => {
    test.setTimeout(240_000)
    await open(page)
    await page.locator('.sv-fvb-btn').filter({ hasText: /^\s*Sort\s*$/ }).first().click()
    // In the panel: the column header is a button of that name too.
    await page.locator('.sv-fvb-panel').getByRole('button', { name: 'Tier', exact: true }).first().click()
    await page.keyboard.press('Escape')
    await expect(page.getByText(/Reading [\d,]+ of 1,000,000/).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Reading [\d,]+ of 1,000,000/)).toHaveCount(0, { timeout: 200_000 })
    const rows = page.locator('[role="row"]')
    for (const i of [1, 2, 3]) await expect(rows.nth(i)).toContainText('Bronze')
    await expect(count(page)).toContainText(MILLION)
  })

  test('"+N" lists a link\'s records on a click or a double-click', async ({ page }) => {
    await open(page)
    await tab(page, 'Customers')
    await expect(page.locator('[role="row"]').nth(1)).toContainText('4,924', { timeout: 20_000 })
    const more = page.locator('.sv-flr-more').first()
    await more.dblclick()
    const list = page.locator('[role="dialog"]').first()
    await expect(list).toContainText('SO-')
    await page.waitForTimeout(500)
    await expect(list).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(list).toBeHidden()
    await more.click()
    await expect(list).toContainText('SO-')
  })

  test('a grouped list: "+" makes a record, and Next runs past what was read', async ({ page }) => {
    await open(page)
    await view(page, 'List by region')
    await page.locator('.sv-fbase-fab').click()
    const record = page.locator('[role="dialog"]').first()
    await expect(record).toContainText('Amount')
    await expect(record).not.toContainText('not in the grid')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(record).toBeHidden()

    await page.locator('[data-head] .sv-flist-ghead').first().click()
    await page.locator('.sv-flist-item').first().click()
    const next = record.getByRole('button', { name: /next/i }).first()
    for (let i = 0; i < 60; i += 1) await next.click()
    await expect(page.locator('.sv-frv-pos').first()).toContainText('61 of 1,000,000', { timeout: 15_000 })
    await expect(record).not.toContainText('not in the grid')
  })

  for (const name of ['Board', 'Gallery', 'Timeline']) {
    test(`the count follows a record added, undone and redone in ${name}`, async ({ page }) => {
      await open(page)
      await view(page, name)
      await page.locator('.sv-fbase-fab').click()
      const record = page.locator('[role="dialog"]').first()
      const amount = (await record.getByText('Amount', { exact: true }).first().boundingBox())!
      await page.mouse.click(amount.x + 120, amount.y + 34)
      await page.keyboard.type('6000')
      await page.keyboard.press('Enter')
      await expect(record).toContainText('SO-1100000')
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
      await expect(record).toBeHidden()
      await expect(count(page)).toContainText('1,000,001 records', { timeout: 20_000 })
      await page.locator('.sv-btabs-tool[aria-label^="Undo"]').first().click()
      await expect(count(page)).toContainText(MILLION, { timeout: 20_000 })
      await page.locator('.sv-btabs-tool[aria-label^="Redo"]').first().click()
      await expect(count(page)).toContainText('1,000,001 records', { timeout: 20_000 })
    })
  }

  test('a new card takes the lane of its status, set while open or from the card', async ({ page }) => {
    await open(page)
    await view(page, 'Board')
    const record = page.locator('[role="dialog"]').first()
    const lane = (name: string) => page.locator('.sv-board-lane').filter({ hasText: name }).first().locator('.sv-board-lane-count')
    const pick = async (label: string) => {
      const at = (await record.getByText(label, { exact: true }).first().boundingBox())!
      await page.mouse.click(at.x + 120, at.y + 34)
    }
    const close = async () => {
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
      await expect(record).toBeHidden()
    }
    await expect(lane('Paid')).toContainText('200,292', { timeout: 20_000 })
    await page.locator('.sv-fbase-fab').click()
    await pick('Amount')
    await page.keyboard.type('6000')
    await page.keyboard.press('Enter')
    await expect(record).toContainText('SO-1100000')
    await pick('Status')
    await page.getByRole('option', { name: 'Paid' }).first().click()
    await close()
    await expect(lane('Paid')).toContainText('200,293', { timeout: 20_000 })
    await expect(page.locator('.sv-board-lane').filter({ hasText: 'Uncategorized' })).toHaveCount(0)
  })

  test('a list row shows its chips whole', async ({ page }) => {
    await open(page)
    for (const name of ['List', 'Inbox']) {
      await view(page, name)
      await page.locator('.sv-flist-chips').first().waitFor({ timeout: 15_000 })
      const cut = await page.locator('.sv-flist-chips').evaluateAll((rows) => rows.slice(0, 10).flatMap((row) => {
        const box = row.getBoundingClientRect()
        return [...row.querySelectorAll('*')]
          .filter((e) => e.getBoundingClientRect().top < box.bottom && e.getBoundingClientRect().bottom > box.bottom + 0.5)
          .map((e) => e.className)
      }))
      expect(cut).toEqual([])
    }
  })

  test('a view switch shows no count or rows of the view it left', async ({ page }) => {
    await open(page)
    await view(page, 'Big EU orders')
    await expect(count(page)).toContainText(/[\d,]+ records/, { timeout: 30_000 })
    const big = (await page.locator('.sv-fvb-count').innerText()).trim()
    expect(big).not.toContain('1,000,000')
    await page.evaluate(() => {
      const seen: string[] = ((window as any).__seen = [])
      const look = () => {
        const shown = document.querySelector('.sv-fvb-view-name')?.textContent?.trim() ?? ''
        const n = document.querySelector('.sv-fvb-count')?.textContent?.trim() ?? ''
        const rows = [...document.querySelectorAll('.sv-grid-row')].map((r) => r.textContent ?? '').join(' ')
        seen.push(`${shown}|${n}|${/SO-\d+/.exec(rows)?.[0] ?? ''}`)
        if (seen.length < 4000) requestAnimationFrame(look)
      }
      requestAnimationFrame(look)
    })
    const firstBig = await page.evaluate(() => /SO-\d+/.exec(document.querySelector('.sv-grid-root')?.textContent ?? '')?.[0] ?? '')
    await view(page, 'All orders')
    await expect(page.locator('.sv-fvb-count')).toContainText('1,000,000', { timeout: 30_000 })
    await expect(page.locator('text=SO-100010').first()).toBeVisible({ timeout: 30_000 })
    const seen = await page.evaluate(() => (window as any).__seen as string[])
    const under = seen.filter((s) => s.startsWith('All orders|'))
    expect(under.length).toBeGreaterThan(0)
    expect(under.filter((s) => s.split('|')[1] === big)).toEqual([])
    expect(under.filter((s) => s.split('|')[2] === firstBig && firstBig !== 'SO-100000')).toEqual([])
  })

  test('search across tables finds a record far from anything read', async ({ page }) => {
    await open(page)
    await page.getByPlaceholder('Search all tables').click()
    await page.keyboard.type('SO-777777')
    await expect(page.locator('.sv-bsearch-panel')).toContainText('SO-777777', { timeout: 15_000 })
    await page.keyboard.press('Enter')
    await expect(page.locator('[role="dialog"]').filter({ hasText: 'SO-777777' }).first()).toBeVisible({ timeout: 15_000 })
  })
})
