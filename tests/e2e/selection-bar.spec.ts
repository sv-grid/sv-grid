import { expect, test, type Page } from '@playwright/test'

/**
 * The bulk-action bar (`selectionBar`) in a real browser.
 *
 * The unit suites cover the logic on both sides of the seam
 * (`selection-bar.dom.test.ts` in enterprise, `svgrid.selection-bar-seam.test.ts`
 * in the grid). What only a browser can answer is whether the bar is actually
 * ON TOP of the rows and inside the grid - jsdom computes no layout, so a bar
 * that renders in the DOM but sits behind the table or off the container would
 * pass every jsdom assertion.
 */

const DEMO = '/sv-grid/#/demos/430-selection-bar'
const BAR = '.sv-selbar'

async function setup(page: Page) {
  await page.goto(DEMO)
  await page.locator('td[data-svgrid-row="0"]').first().waitFor({ timeout: 30_000 })
}

/**
 * Tick the row-selection checkbox on the r-th rendered row.
 *
 * Indexed off `.sv-grid-selection-cell` rather than `tr.sv-grid-row`: that
 * selector also matches the header row, so nth(0) was the select-all column
 * header and nothing was ever ticked. The cell itself carries the click
 * handler, which is also what a user hits.
 */
async function tickRow(page: Page, r: number) {
  await page.locator(".sv-grid-selection-cell").nth(r).click()
}

test.describe('selectionBar', () => {
  test('appears on selection, floating inside the grid box', async ({ page }) => {
    await setup(page)
    await expect(page.locator(BAR)).toHaveCount(0)

    await tickRow(page, 0)
    const bar = page.locator(BAR)
    await expect(bar).toBeVisible()

    const barBox = (await bar.boundingBox())!
    const rootBox = (await page.locator('.sv-grid-root').first().boundingBox())!

    // Inside the grid's own box on every side - what `absolute` against
    // .sv-grid-root buys, and what `fixed` would have broken.
    expect(barBox.x).toBeGreaterThanOrEqual(rootBox.x - 1)
    expect(barBox.y).toBeGreaterThanOrEqual(rootBox.y - 1)
    expect(barBox.x + barBox.width).toBeLessThanOrEqual(rootBox.x + rootBox.width + 1)
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(rootBox.y + rootBox.height + 1)

    // And it is the thing painted at that point, not behind the table.
    const onTop = await page.evaluate(
      ([x, y]) => !!document.elementFromPoint(x as number, y as number)?.closest('.sv-selbar'),
      [barBox.x + barBox.width / 2, barBox.y + barBox.height / 2],
    )
    expect(onTop).toBe(true)
  })

  test('floats without resizing the grid, and leaves room to scroll clear of it', async ({ page }) => {
    // Two things at once, and they pull against each other:
    //
    //  - The bar FLOATS: the grid must be exactly the same size with it up, or
    //    every layout holding one jumps when a checkbox is ticked.
    //  - It must not permanently hide a row, so the SCROLLER gains bottom
    //    padding the height of the bar - the last row can be scrolled into
    //    clear view, the bar just overlays that padding.
    await setup(page)
    const measure = () =>
      page.evaluate(() => {
        const c = document.querySelector('.sv-grid-container')!
        return {
          height: Math.round(c.getBoundingClientRect().height),
          scrollHeight: c.scrollHeight,
        }
      })

    const before = await measure()
    await tickRow(page, 0)
    await expect(page.locator(BAR)).toBeVisible()
    const during = await measure()

    expect(during.height).toBe(before.height)
    const barHeight = (await page.locator(BAR).boundingBox())!.height
    expect(during.scrollHeight - before.scrollHeight).toBeGreaterThanOrEqual(barHeight)

    // ...and back exactly as it was once the selection goes.
    await page.locator('.sv-selbar-clear').click()
    await expect(page.locator(BAR)).toHaveCount(0)
    expect(await measure()).toEqual(before)
  })

  test('the count tracks the selection', async ({ page }) => {
    await setup(page)
    await tickRow(page, 0)
    await expect(page.locator('.sv-selbar-count')).toHaveText('1 selected')
    await tickRow(page, 1)
    await expect(page.locator('.sv-selbar-count')).toHaveText('2 selected')
  })

  test('position moves it between the bottom and top edges', async ({ page }) => {
    await setup(page)
    await tickRow(page, 0)

    const bar = page.locator(BAR)
    const rootBox = (await page.locator('.sv-grid-root').first().boundingBox())!
    const bottomBox = (await bar.boundingBox())!
    // Bottom half of the grid.
    expect(bottomBox.y).toBeGreaterThan(rootBox.y + rootBox.height / 2)

    await page.getByRole('button', { name: 'Top', exact: true }).click()
    await expect(bar).toHaveAttribute('data-position', 'top')
    const topBox = (await bar.boundingBox())!
    expect(topBox.y).toBeLessThan(rootBox.y + rootBox.height / 2)
    // It actually moved, rather than just changing an attribute.
    expect(topBox.y).toBeLessThan(bottomBox.y)
  })

  test('keeps the essentials inline and the optional extras in the menu', async ({ page }) => {
    await setup(page)
    await tickRow(page, 0)
    await tickRow(page, 1)

    // What any list needs, on the bar.
    for (const name of ['Select all', 'Edit fields', 'Delete']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
    }
    // What this tracker happens to offer, behind the menu.
    for (const name of ['Mark done', 'Merge', 'Export']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
    }

    await page.locator('.sv-selbar-more-btn').click()
    const menu = page.locator('.sv-selbar-menu')
    await expect(menu).toBeVisible()
    for (const name of ['Mark done', 'Merge', 'Export']) {
      await expect(menu.getByRole('menuitem', { name })).toBeVisible()
    }

    // The menu opens away from the edge the bar is pinned to, so it never
    // falls off the grid.
    const barBox = (await page.locator(BAR).boundingBox())!
    const menuBox = (await menu.boundingBox())!
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(barBox.y + 1)
  })

  test('an action runs against the selected rows', async ({ page }) => {
    await setup(page)
    await tickRow(page, 0)
    await tickRow(page, 1)

    await page.locator('.sv-selbar-more-btn').click()
    await page.locator('.sv-selbar-menu').getByRole('menuitem', { name: 'Mark done' }).click()
    await expect(page.locator('.pill')).toHaveText('Marked 2 done')
  })

  test('Edit fields opens the drawer and bulk-edits several fields at once', async ({ page }) => {
    await setup(page)
    const cellAt = (r, c) => page.locator(`td[data-svgrid-row="${r}"][data-svgrid-col="${c}"]`)

    // data-svgrid-col counts DATA columns only - the selection checkbox is
    // its own cell and takes no index. So: 0 Key, 1 Summary, 2 Status,
    // 3 Priority, 4 Assignee, 5 Labels, 6 Due, 7 Points.
    expect((await cellAt(0, 1).innerText()).trim()).not.toBe('Bulk renamed')

    await tickRow(page, 0)
    await tickRow(page, 1)
    await page.getByRole('button', { name: 'Edit fields' }).click()

    // The drawer is the grid's own SvDrawer, so it is a labelled dialog.
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()

    // TWO fields in one pass - the reason this is a drawer and not a
    // one-field dialog. Both are native inputs; Status is a custom picker.
    await drawer.getByLabel('Summary').fill('Bulk renamed')
    await drawer.getByLabel('Points').fill('13')
    await page.getByRole('button', { name: /Apply to 2/ }).click()

    await expect(drawer).toHaveCount(0)
    expect((await cellAt(0, 1).innerText()).trim()).toBe('Bulk renamed')
    expect((await cellAt(1, 1).innerText()).trim()).toBe('Bulk renamed')
    expect((await cellAt(0, 7).innerText()).trim()).toBe('13')
  })

  test('a field the selection disagrees on opens blank and stays per-row if untouched', async ({ page }) => {
    await setup(page)
    const cellAt = (r, c) => page.locator(`td[data-svgrid-row="${r}"][data-svgrid-col="${c}"]`)
    const titles = [
      (await cellAt(0, 1).innerText()).trim(),
      (await cellAt(1, 1).innerText()).trim(),
    ]

    await tickRow(page, 0)
    await tickRow(page, 1)
    await page.getByRole('button', { name: 'Edit fields' }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()

    // The two rows have different summaries, so the field opens EMPTY rather
    // than silently picking one of them.
    await expect(drawer.getByLabel('Summary')).toHaveValue('')

    // Change only Pts. The untouched Summary must leave each row's own value.
    await drawer.getByLabel('Points').fill('7')
    await page.getByRole('button', { name: /Apply to 2/ }).click()
    await expect(drawer).toHaveCount(0)

    expect((await cellAt(0, 1).innerText()).trim()).toBe(titles[0])
    expect((await cellAt(1, 1).innerText()).trim()).toBe(titles[1])
    expect((await cellAt(0, 7).innerText()).trim()).toBe('7')
  })

  test('Select all takes the whole view and then disables itself', async ({ page }) => {
    await setup(page)
    await tickRow(page, 0)

    const selectAll = page.getByRole('button', { name: 'Select all' })
    await expect(selectAll).toBeEnabled()
    await selectAll.click()

    // The chip is the fastest read of how many are now in play.
    await expect(page.locator('.sv-selbar-chip')).toHaveText('24')
    await expect(selectAll).toBeDisabled()
  })

  test('clearing dismisses the bar', async ({ page }) => {
    await setup(page)
    await tickRow(page, 0)
    await expect(page.locator(BAR)).toBeVisible()

    await page.locator('.sv-selbar-clear').click()
    await expect(page.locator(BAR)).toHaveCount(0)
  })

  test('Escape clears the selection', async ({ page }) => {
    await setup(page)
    await tickRow(page, 0)
    await expect(page.locator(BAR)).toBeVisible()

    // Pressed on a focusable element INSIDE the bar. The count is a <span>, so
    // Playwright cannot focus it and the key would be dispatched at the body -
    // outside the bar, where the handler correctly never sees it.
    await page.locator('.sv-selbar-clear').press('Escape')
    await expect(page.locator(BAR)).toHaveCount(0)
  })
})
