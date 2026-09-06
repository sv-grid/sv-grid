/**
 * E2E: the fill handle targets the rows you dragged over, on a SORTED grid.
 *
 * The fill drag works in display coordinates (positions in `allRows`, the same
 * space `isCellEditableAt` uses), but `readCellRaw` / `writeCellRaw` indexed
 * `internalData` with that number directly. Those are the same row only while
 * the grid is unsorted, unfiltered and unpaginated - which is exactly the
 * default state a jsdom test sets up, so nothing caught it. Sort a column and
 * the fill read its pattern from one row and wrote to another.
 *
 * Needs a real browser: the bug only appears once a pointer drag on the handle
 * meets a real sorted row model.
 */
import { expect, test } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/05-inline-editing'

test.describe('fill handle on a sorted grid', () => {
  test('fills the rows dragged over, not the ones at those data positions', async ({ page }) => {
    await page.goto(DEMO)
    await page.locator('.sv-grid-cell').first().waitFor()

    const headers = await page.$$eval('.sv-grid-column', (els) =>
      els.map((el) => (el.textContent ?? '').trim()),
    )
    const nameCol = headers.findIndex((h) => h.startsWith('First name'))
    const ageCol = headers.findIndex((h) => h.startsWith('Age'))
    expect(nameCol).toBeGreaterThan(-1)
    expect(ageCol).toBeGreaterThan(-1)

    const names = () =>
      page.$$eval('tbody.sv-grid-body tr', (trs, c) =>
        trs.slice(0, 5).map((t) => (t.children[c]?.textContent ?? '').trim()), nameCol)

    const unsorted = await names()
    // Sort, so the displayed order stops matching the data order.
    await page.locator('.sv-grid-column').nth(nameCol).click()
    await expect.poll(names).not.toEqual(unsorted)
    const sorted = await names()
    expect(sorted, 'names should be ascending').toEqual([...sorted].sort())

    const ages = () =>
      page.$$eval('tbody.sv-grid-body tr', (trs, c) =>
        trs.slice(0, 5).map((t) => (t.children[c]?.textContent ?? '').trim()), ageCol)

    const before = await ages()

    // Select the first row's Age cell and drag its fill handle down two rows.
    await page.locator('tbody.sv-grid-body tr').nth(0).locator('td').nth(ageCol).click()
    const handle = page.locator('.sv-grid-fill-handle').first()
    await handle.waitFor()
    const from = await handle.boundingBox()
    const to = await page
      .locator('tbody.sv-grid-body tr')
      .nth(2)
      .locator('td')
      .nth(ageCol)
      .boundingBox()
    expect(from && to).toBeTruthy()

    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2)
    await page.mouse.down()
    await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 8 })
    await page.mouse.up()

    // Rows 1 and 2 take row 0's value; row 0 and everything below are untouched.
    await expect.poll(ages).toEqual([
      before[0],
      before[0],
      before[0],
      before[3],
      before[4],
    ])
  })
})
