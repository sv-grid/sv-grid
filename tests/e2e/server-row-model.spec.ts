/**
 * E2E: the Server-Side Row Model over one million rows (demo 467), the
 * server pivot (demo 468) and the focused demos in the same category (tree
 * data 469, transactions 470, selection 471, SQL planner 472, grouping
 * rules 473), in a real browser.
 *
 * The demo's request log is the oracle: every call the model makes to the
 * warehouse is a row in it, with its kind (group / leaf / update / create /
 * bulk) and its route, so the refetch rules are asserted from what the
 * "server" actually received rather than from what the grid looks like.
 *
 * Scroll assertions drive the scroll container directly; a `locator.click()`
 * on a header scrolls the grid through CDP and would look like a scroll bug.
 */
import { expect, test, type Page } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/467-server-row-model-1m'
const PIVOT = '/sv-grid/#/demos/468-server-pivot'
const demoUrl = (id: string) => `/sv-grid/#/demos/${id}`

const rows = (page: Page) => page.locator('tbody .sv-grid-row')
const groupCells = (page: Page) => page.locator('button.sv-group-cell')
const logRows = (page: Page) => page.locator('.log-row')
const foot = (page: Page) => page.locator('.foot')

/** The log's kinds, newest first. */
async function logKinds(page: Page, n = 40): Promise<string[]> {
  return page.locator('.log-row .log-kind').evaluateAll((els, n) => els.slice(0, n).map((e) => e.textContent!.trim()), n)
}

async function open(page: Page) {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto(DEMO)
  // Building a million rows and answering the first request takes a moment.
  await groupCells(page).first().waitFor({ timeout: 60_000 })
  await expect(logRows(page).first()).toContainText('group', { timeout: 30_000 })
}

/** Expand the first region and its first country, and wait for the leaves. */
async function drillIn(page: Page) {
  await groupCells(page).nth(0).click()
  await expect(groupCells(page)).toHaveCount(4 + 4, { timeout: 30_000 })
  await groupCells(page).nth(1).click()
  await expect.poll(() => logKinds(page, 1), { timeout: 30_000 }).toEqual(['leaf'])
  await expect(rows(page).nth(2)).not.toContainText('(')
}

async function scrollBody(page: Page, by: number) {
  await page.evaluate(async (by) => {
    const sc = document.querySelector('.sv-grid-container') as HTMLElement
    sc.scrollTop += by
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    await new Promise((r) => requestAnimationFrame(() => r(null)))
  }, by)
}

test.describe('server-side row model over one million rows', () => {
  test('loads the top level, drills in, and streams leaf blocks as the level scrolls', async ({ page }) => {
    await open(page)
    // Four regions, each with its child count and subtotal.
    await expect(groupCells(page)).toHaveCount(4)
    await expect(rows(page).first()).toContainText('(4)')
    await drillIn(page)

    // Scrolling down inside the opened country asks for the next blocks and
    // never leaves a blank row: every mounted row is a group, a leaf, a
    // placeholder or the pinned total.
    const before = await logRows(page).count()
    for (let i = 0; i < 6; i += 1) await scrollBody(page, 1000)
    await expect.poll(() => logRows(page).count(), { timeout: 30_000 }).toBeGreaterThan(before)
    await expect.poll(() => logKinds(page, 1), { timeout: 30_000 }).toEqual(['leaf'])
    const blank = await rows(page).evaluateAll((els) =>
      els.filter((r) => !r.classList.contains('sv-grid-row-spacer') && r.textContent!.trim() === '' && !r.querySelector('.sv-grid-placeholder-skeleton, [aria-busy="true"]')).length,
    )
    expect(blank).toBe(0)
    await expect(page.locator('.sv-grid-placeholder-failed')).toHaveCount(0)
  })

  test('sorting a plain column refetches leaf levels only; an aggregated column refetches every level', async ({ page }) => {
    await open(page)
    await drillIn(page)
    const mark = await logRows(page).count()

    // Product is a leaf column: only leaf blocks come back.
    await page.locator('th .sv-grid-header-label', { hasText: 'Product' }).first().click({ force: true })
    await expect.poll(() => logRows(page).count(), { timeout: 30_000 }).toBeGreaterThan(mark)
    await page.waitForTimeout(800)
    const afterPlain = (await logKinds(page)).slice(0, (await logRows(page).count()) - mark)
    expect(afterPlain.length).toBeGreaterThan(0)
    expect(afterPlain.every((k) => k === 'leaf')).toBe(true)

    // Amount is aggregated: the group levels reload too.
    const mark2 = await logRows(page).count()
    await page.locator('th .sv-grid-header-label', { hasText: 'Amount' }).first().click({ force: true })
    await expect.poll(async () => (await logKinds(page)).slice(0, (await logRows(page).count()) - mark2).includes('group'), { timeout: 30_000 }).toBe(true)
  })

  test('a filter purges every level', async ({ page }) => {
    await open(page)
    await drillIn(page)
    await page.locator('form.search input').fill('Knuth')
    await page.locator('form.search button').click()
    await expect.poll(async () => (await logKinds(page, 4)).includes('group'), { timeout: 30_000 }).toBe(true)
    // The filtered subtotals are smaller than the unfiltered ones.
    await expect(rows(page).first()).not.toContainText('$1,250,861,544')
    await expect(rows(page).first()).toContainText('(4)')
  })

  test('a failed block shows Retry and recovers', async ({ page }) => {
    await open(page)
    await page.getByLabel('Simulate failures').check()
    await page.getByRole('button', { name: 'Purge' }).click()
    // 30% of requests fail; purge and retry until one does.
    await expect
      .poll(async () => {
        const failed = await page.locator('.sv-grid-placeholder-failed').count()
        if (failed === 0) await page.getByRole('button', { name: 'Purge' }).click()
        return failed
      }, { timeout: 60_000, intervals: [700] })
      .toBeGreaterThan(0)
    await expect(page.locator('.sv-grid-placeholder-failed').getByRole('button', { name: 'Retry', exact: true }).first()).toBeVisible()
    await page.getByLabel('Simulate failures').uncheck()
    await page.getByRole('button', { name: 'Retry failed' }).click()
    await expect(page.locator('.sv-grid-placeholder-failed')).toHaveCount(0, { timeout: 30_000 })
    await expect(groupCells(page).first()).toBeVisible()
  })

  test('select-all counts every row on the server, and the bulk edit goes out as one rule', async ({ page }) => {
    await open(page)
    await page.locator('thead .sv-grid-selection-column input[type=checkbox], thead .sv-grid-selection-column [role=checkbox], thead .sv-grid-selection-column button').first().click()
    await expect(foot(page).locator('[data-stat=selected]')).toContainText('1,000,000', { timeout: 15_000 })
    await expect(page.locator('.sv-selbar')).toContainText('1,000,000')
    await page.locator('.sv-selbar button', { hasText: 'Edit fields' }).click()
    const drawer = page.locator('[class*="bulk"]').first()
    await expect(drawer).toContainText('1,000,000')
  })

  test('an inline edit is one update, applied as a transaction, and the subtotal follows', async ({ page }) => {
    await open(page)
    await drillIn(page)
    const country = rows(page).nth(1)
    const subtotalBefore = (await country.textContent())!.replace(/\s+/g, ' ')
    const mark = await logRows(page).count()

    // Qty of the first leaf: checkbox, group, id, amount, qty, status, product, category, date.
    const qty = rows(page).nth(2).locator('td').nth(4)
    await qty.dblclick()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('999')
    await page.keyboard.press('Enter')

    await expect.poll(async () => (await logKinds(page)).slice(0, (await logRows(page).count()) - mark), { timeout: 30_000 }).toContain('update')
    await expect(rows(page).nth(2)).toContainText('999')
    // The parent level was refreshed, not the leaf block: one group request
    // for the route, and no leaf request.
    await expect.poll(async () => (await logKinds(page)).slice(0, (await logRows(page).count()) - mark), { timeout: 30_000 }).toContain('group')
    const since = (await logKinds(page)).slice(0, (await logRows(page).count()) - mark)
    expect(since.filter((k) => k === 'leaf')).toHaveLength(0)
    await expect.poll(async () => (await country.textContent())!.replace(/\s+/g, ' '), { timeout: 30_000 }).not.toBe(subtotalBefore)
  })

  test('a transaction add appears without a refetch', async ({ page }) => {
    await open(page)
    await drillIn(page)
    await rows(page).nth(2).locator('td').nth(3).click()
    const mark = await logRows(page).count()
    await page.getByRole('button', { name: 'Add row' }).click()
    await expect(foot(page).locator('[data-stat=server]')).toContainText('1,000,001', { timeout: 30_000 })
    const since = (await logKinds(page)).slice(0, (await logRows(page).count()) - mark)
    expect(since).toContain('create')
    expect(since.filter((k) => k === 'leaf')).toHaveLength(0)
  })

  test('a jump to row 900,000 before its block loaded lands on placeholders, then on data', async ({ page }) => {
    await open(page)
    // Flat: the root claims its million rows up front (levelParams.initialRowCount).
    await page.getByRole('button', { name: 'Flat', exact: true }).click()
    // Slow the server down so the placeholders can be seen before the block lands.
    await page.getByLabel('Slow network').check()
    await page.locator('.jump input').fill('900000')
    await page.locator('.jump button').click()
    // The rows under the viewport are placeholders first: the scrollbar was
    // already the right length, and the block under row 900,000 is what loads.
    await expect(page.locator('tbody .sv-grid-placeholder-row').first()).toBeVisible({ timeout: 15_000 })
    await expect
      .poll(async () => {
        // Data rows only: not the spacer rows, not the pinned grand total.
        const ids = await page.locator('tbody.sv-grid-body .sv-grid-row:not(.sv-grid-row-spacer):not(.sv-grid-placeholder-row)').evaluateAll((els) =>
          els.map((r) => Number(r.querySelector('td:nth-child(3)')?.textContent?.replace(/\D/g, ''))).filter((n) => Number.isFinite(n) && n > 0),
        )
        return ids.length > 0 && ids.every((n) => n >= 899_900 && n <= 900_200)
      }, { timeout: 30_000 })
      .toBe(true)
    await expect(page.locator('tbody .sv-grid-placeholder-row')).toHaveCount(0, { timeout: 30_000 })
    // Only the blocks around the jump were asked for; not the 8,999 before it.
    const kinds = await logKinds(page, 10)
    expect(kinds.filter((k) => k === 'flat').length).toBeLessThan(6)
  })

  test('paged mode pages the top level through the footer pager', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Paged', exact: true }).click()
    await expect(page.locator('.sv-grid-pagination-range')).toContainText('1 to 4 of 4', { timeout: 30_000 })
    await expect(groupCells(page)).toHaveCount(4)
  })
})

test.describe('server-side pivot', () => {
  test('builds the pivot columns from the fields the backend reports, and applies a layout once', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto(PIVOT)
    await groupCells(page).first().waitFor({ timeout: 60_000 })
    const headers = page.locator('thead th')
    for (const year of ['2022', '2023', '2024', '2025']) await expect(headers.filter({ hasText: year }).first()).toBeVisible()
    // A region opens onto pivoted countries; the innermost level has no expander.
    await groupCells(page).first().click()
    await expect(page.locator('.sv-group-cell-leaf')).toHaveCount(4, { timeout: 30_000 })
    // Deferred apply: removing Year from Columns changes nothing until Apply.
    const before = await page.locator('.log-item').count()
    await page.locator('.pvd-well[data-well="cols"] .pvd-chip-x').click()
    await page.waitForTimeout(600)
    expect(await page.locator('.log-item').count()).toBe(before)
    await page.locator('.pvd-apply button', { hasText: 'Apply' }).click()
    await expect.poll(() => page.locator('.log-item').count(), { timeout: 30_000 }).toBeGreaterThan(before)
    await expect(headers.filter({ hasText: '2024' })).toHaveCount(0)
  })
})

test.describe('the focused row model demos', () => {
  const openDemo = async (page: Page, id: string) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto(demoUrl(id))
    await page.locator('.sv-grid-root').first().waitFor({ timeout: 60_000 })
  }

  test('tree data: a folder is read on expand, and a file is added and deleted without a refetch', async ({ page }) => {
    await openDemo(page, '469-server-tree-data')
    await groupCells(page).first().waitFor({ timeout: 30_000 })
    await expect(foot(page)).toContainText('Requests', { timeout: 30_000 })
    const requestsOf = async () => Number((await foot(page).locator('.stat').first().textContent())!.replace(/\D/g, ''))
    // The root folders open on load and read as they arrive; wait for the
    // request count to stand still before measuring against it.
    await expect(page.locator('.sv-group-spinner')).toHaveCount(0, { timeout: 30_000 })
    let before = await requestsOf()
    for (let i = 0; i < 20; i += 1) {
      await page.waitForTimeout(500)
      const now = await requestsOf()
      if (now === before) break
      before = now
    }
    // The second folder (a child of the first, which opened on load) reads on click.
    await groupCells(page).nth(1).click()
    await expect.poll(requestsOf, { timeout: 30_000 }).toBe(before + 1)
    // Focus a file, add one beside it: a transaction, no request.
    const file = rows(page).filter({ hasText: /\.(ts|md|json|css|svelte|png|svg|sql)/ }).first()
    await file.locator('td').nth(1).click()
    const mark = await requestsOf()
    await page.getByRole('button', { name: 'New file' }).click()
    await expect(rows(page).filter({ hasText: 'notes-' }).first()).toBeVisible({ timeout: 15_000 })
    expect(await requestsOf()).toBe(mark)
    await rows(page).filter({ hasText: 'notes-' }).first().locator('td').nth(1).click()
    await page.getByRole('button', { name: 'Delete file' }).click()
    await expect(rows(page).filter({ hasText: 'notes-' })).toHaveCount(0, { timeout: 15_000 })
    expect(await requestsOf()).toBe(mark)
  })

  test('transactions: the feed patches, applies, reports storeNotFound for a closed level, and cancelled under the veto', async ({ page }) => {
    await openDemo(page, '470-server-transactions')
    await page.getByRole('button', { name: 'fast' }).click()
    const statuses = () => page.locator('.log-row .log-status').evaluateAll((els) => els.map((e) => e.textContent!.trim()))
    await expect.poll(statuses, { timeout: 30_000 }).toContain('patched')
    await expect.poll(statuses, { timeout: 30_000 }).toContain('applied')
    // South and West are closed, so their adds have no level to land in.
    await expect.poll(statuses, { timeout: 30_000 }).toContain('storeNotFound')
    await page.getByLabel('Veto adds').check()
    await expect.poll(statuses, { timeout: 30_000 }).toContain('cancelled')
  })

  test('selection: select-all is a rule the server counts, with exceptions and a bulk edit by rule', async ({ page }) => {
    await openDemo(page, '471-server-selection')
    await expect(rows(page).first()).toContainText('@example.com', { timeout: 30_000 })
    await page.locator('thead .sv-grid-selection-column input[type=checkbox], thead .sv-grid-selection-column [role=checkbox], thead .sv-grid-selection-column button').first().click()
    await expect(foot(page).locator('[data-stat=selected]')).toContainText('100,000', { timeout: 15_000 })
    await page.locator('tbody .sv-grid-selection-cell .sv-grid-checkbox').nth(1).click()
    await expect(foot(page).locator('[data-stat=selected]')).toContainText('99,999')
    await expect(page.locator('.rule-body')).toContainText('"selectAll": true')
    await expect(page.locator('.rule-body')).toContainText('"2"')
    await page.getByRole('button', { name: 'Pause selected' }).click()
    await expect(foot(page)).toContainText('updateWhere: 99,999 rows', { timeout: 30_000 })
    await expect(rows(page).first()).toContainText('paused', { timeout: 30_000 })
    // Under grouping a ticked plan counts its subscribers, loaded or not.
    await page.getByRole('button', { name: 'Grouped by plan' }).click()
    await groupCells(page).first().waitFor({ timeout: 30_000 })
    await page.locator('tbody .sv-grid-selection-cell .sv-grid-checkbox').first().click()
    await expect(page.locator('.rule-body')).toContainText('selectAllChildren": true')
    await expect
      .poll(async () => Number((await foot(page).locator('[data-stat=selected] strong').textContent())!.replace(/\D/g, '')), { timeout: 15_000 })
      .toBeGreaterThan(1000)
  })

  test('sql planner: the statements follow the request and the dialect', async ({ page }) => {
    await openDemo(page, '472-server-sql-planner')
    const sql = page.locator('.sql-text')
    await expect(sql.first()).toContainText('GROUP BY "region"', { timeout: 30_000 })
    await expect(page.locator('.sql-label')).toContainText(['group rows', 'count', 'grand total'])
    await page.getByRole('button', { name: 'MySQL' }).click()
    await expect(sql.first()).toContainText('GROUP BY `region`')
    await page.getByLabel('Pivot by year').check()
    await expect(page.locator('.sql-label').first()).toContainText('pivot keys', { timeout: 30_000 })
    await expect(sql.nth(1)).toContainText('CASE WHEN')
    await expect(page.locator('thead th').filter({ hasText: '2024' }).first()).toBeVisible()
  })

  test('grouping rules: a plain column sort re-fetches leaves only, an aggregated column every level', async ({ page }) => {
    await openDemo(page, '473-server-grouping-rules')
    // Countries open on load: regions, countries and their first leaf blocks.
    const kinds = () => page.locator('.log-row .log-kind').evaluateAll((els) => els.map((e) => e.textContent!.trim()))
    await expect.poll(async () => (await kinds()).filter((k) => k === 'leaf').length, { timeout: 60_000 }).toBe(9)
    let mark = (await kinds()).length
    await page.locator('thead th', { hasText: 'Product' }).locator('button, [role=button], .sv-grid-header-sort').first().click()
    await expect.poll(async () => (await kinds()).length, { timeout: 30_000 }).toBe(mark + 9)
    expect((await kinds()).slice(0, 9).every((k) => k === 'leaf')).toBe(true)
    mark = (await kinds()).length
    await page.locator('thead th', { hasText: 'Amount' }).locator('button, [role=button], .sv-grid-header-sort').first().click()
    await expect.poll(async () => (await kinds()).length, { timeout: 30_000 }).toBeGreaterThanOrEqual(mark + 13)
    expect((await kinds()).slice(0, 13)).toContain('group')
  })
})
