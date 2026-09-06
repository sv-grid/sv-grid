import { expect, test, type Page } from '@playwright/test'

/**
 * Excel-style range drag-and-drop (`moveCells`).
 *
 * Everything here is a real pointer sequence against the range BORDER, which
 * is the part jsdom cannot check: the grab target is the outer 4px of a
 * painted outline, so it only exists once the cell has a real rect. The value
 * arithmetic and every refusal rule are unit-tested in
 * `packages/grid/src/move-cells.test.ts`.
 *
 * `page.mouse` throughout rather than `locator.dragTo` / `locator.click`:
 * Playwright's element actions scroll the target into view through CDP, which
 * both moves the grid under the pointer mid-gesture and lands the click on the
 * element's CENTRE - the one place on a border cell that is guaranteed NOT to
 * be on the grab strip.
 */

const DEMO = '/sv-grid/#/demos/429-move-cells'

const cell = (r: number, c: number) =>
  `td[data-svgrid-row="${r}"][data-svgrid-col="${c}"]`

async function setup(page: Page) {
  await page.goto(DEMO)
  await page.locator(cell(0, 1)).waitFor({ timeout: 30_000 })
}

const text = async (page: Page, r: number, c: number) =>
  (await page.locator(cell(r, c)).innerText()).trim()

/** Select (r0,c0)-(r1,c1) by dragging across the cell interiors. */
async function selectRange(page: Page, r0: number, c0: number, r1: number, c1: number) {
  const from = await page.locator(cell(r0, c0)).boundingBox()
  const to = await page.locator(cell(r1, c1)).boundingBox()
  if (!from || !to) throw new Error('cells not laid out')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 })
  await page.mouse.up()
  await expect(page.locator(`${cell(r0, c0)}[data-selected-range="true"]`)).toBeVisible()
}

/**
 * Drag the range's TOP border from the cell at (r,c) by (dRows, dCols).
 * The grab point is 2px below the cell's top edge, horizontally centred -
 * inside the 4px strip, and clear of the fill handle in the far corner.
 */
async function dragBorder(
  page: Page,
  r: number,
  c: number,
  dRows: number,
  dCols: number,
  opts: { modifier?: 'Control' } = {},
) {
  const grab = await page.locator(cell(r, c)).boundingBox()
  const drop = await page.locator(cell(r + dRows, c + dCols)).boundingBox()
  if (!grab || !drop) throw new Error('cells not laid out')
  await page.mouse.move(grab.x + grab.width / 2, grab.y + 2)
  await page.mouse.down()
  // A couple of intermediate points: the drag tracks the pointer with
  // elementFromPoint, and a single jump would never cross the cells between.
  await page.mouse.move(drop.x + drop.width / 2, drop.y + 2, { steps: 8 })
  if (opts.modifier) await page.keyboard.down(opts.modifier)
  await page.mouse.up()
  if (opts.modifier) await page.keyboard.up(opts.modifier)
}

test.describe('moveCells - drag a range to move or copy it', () => {
  test('the cursor tells you the border is grabbable', async ({ page }) => {
    await setup(page)
    await selectRange(page, 0, 1, 1, 2)

    const root = page.locator('.sv-grid-root').first()
    await expect(root).not.toHaveAttribute('data-move-grab', 'true')

    const box = await page.locator(cell(0, 1)).boundingBox()
    if (!box) throw new Error('cell not laid out')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await expect(root).not.toHaveAttribute('data-move-grab', 'true')

    await page.mouse.move(box.x + box.width / 2, box.y + 2)
    await expect(root).toHaveAttribute('data-move-grab', 'true')
  })

  test('dragging the border moves the values and blanks the source', async ({ page }) => {
    await setup(page)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))

    const before = [await text(page, 0, 1), await text(page, 1, 1)]
    expect(before.every((v) => v !== '')).toBe(true)
    expect(await text(page, 3, 1)).toBe('')

    await selectRange(page, 0, 1, 1, 1)
    await dragBorder(page, 0, 1, 3, 0)

    expect(errors, errors.join('\n')).toHaveLength(0)
    expect(await text(page, 3, 1)).toBe(before[0])
    expect(await text(page, 4, 1)).toBe(before[1])
    expect(await text(page, 0, 1)).toBe('')
    expect(await text(page, 1, 1)).toBe('')
  })

  test('the moved range stays selected where it landed', async ({ page }) => {
    await setup(page)
    await selectRange(page, 0, 1, 1, 1)
    await dragBorder(page, 0, 1, 3, 0)
    await expect(page.locator(`${cell(3, 1)}[data-selected-range="true"]`)).toBeVisible()
    await expect(page.locator(`${cell(4, 1)}[data-selected-range="true"]`)).toBeVisible()
    await expect(page.locator(`${cell(0, 1)}[data-selected-range="true"]`)).toHaveCount(0)
  })

  test('holding Ctrl at the drop copies instead of moving', async ({ page }) => {
    await setup(page)
    const before = [await text(page, 0, 1), await text(page, 1, 1)]

    await selectRange(page, 0, 1, 1, 1)
    await dragBorder(page, 0, 1, 3, 0, { modifier: 'Control' })

    expect(await text(page, 3, 1)).toBe(before[0])
    expect(await text(page, 4, 1)).toBe(before[1])
    // Source kept, which is the whole difference from a move.
    expect(await text(page, 0, 1)).toBe(before[0])
    expect(await text(page, 1, 1)).toBe(before[1])
  })

  test('a drop onto a read-only column changes nothing', async ({ page }) => {
    await setup(page)
    // Column 0 is the read-only "Week" column in this demo.
    const week = await text(page, 3, 0)
    const before = await text(page, 0, 1)

    await selectRange(page, 0, 1, 1, 1)
    await dragBorder(page, 0, 1, 3, -1)

    expect(await text(page, 3, 0)).toBe(week)
    expect(await text(page, 0, 1)).toBe(before)
  })

  test('a click on the border keeps the range instead of collapsing it', async ({ page }) => {
    await setup(page)
    await selectRange(page, 0, 1, 1, 2)

    const box = await page.locator(cell(0, 1)).boundingBox()
    if (!box) throw new Error('cell not laid out')
    await page.mouse.move(box.x + box.width / 2, box.y + 2)
    await page.mouse.down()
    await page.mouse.up()

    // All four cells of the original rectangle are still in the selection.
    await expect(page.locator('td[data-selected-range="true"]')).toHaveCount(4)
  })

  test('an interior pointerdown still starts a fresh selection', async ({ page }) => {
    await setup(page)
    await selectRange(page, 0, 1, 1, 2)

    const box = await page.locator(cell(3, 3)).boundingBox()
    if (!box) throw new Error('cell not laid out')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.up()

    await expect(page.locator('td[data-selected-range="true"]')).toHaveCount(1)
    await expect(page.locator(`${cell(3, 3)}[data-selected-range="true"]`)).toBeVisible()
  })

  test('parking the pointer at the bottom edge scrolls the grid', async ({ page }) => {
    await setup(page)
    const viewport = page.locator('.sv-grid-container').first()
    expect(await viewport.evaluate((el) => el.scrollTop)).toBe(0)

    await selectRange(page, 0, 1, 1, 1)

    // Grab the range border and park the pointer inside the bottom edge band
    // WITHOUT crossing more cells - the scroll has to come from the pointer
    // sitting there, not from further movement.
    const grab = await page.locator(cell(0, 1)).boundingBox()
    const box = await viewport.boundingBox()
    if (!grab || !box) throw new Error('not laid out')
    await page.mouse.move(grab.x + grab.width / 2, grab.y + 2)
    await page.mouse.down()
    await page.mouse.move(grab.x + grab.width / 2, box.y + box.height - 8, { steps: 10 })

    await expect
      .poll(() => viewport.evaluate((el) => el.scrollTop), { timeout: 4000 })
      .toBeGreaterThan(0)

    await page.mouse.up()
  })

  test('the scroll stops once the drag is released', async ({ page }) => {
    await setup(page)
    const viewport = page.locator('.sv-grid-container').first()
    await selectRange(page, 0, 1, 1, 1)

    const grab = await page.locator(cell(0, 1)).boundingBox()
    const box = await viewport.boundingBox()
    if (!grab || !box) throw new Error('not laid out')
    await page.mouse.move(grab.x + grab.width / 2, grab.y + 2)
    await page.mouse.down()
    await page.mouse.move(grab.x + grab.width / 2, box.y + box.height - 8, { steps: 10 })
    await expect
      .poll(() => viewport.evaluate((el) => el.scrollTop), { timeout: 4000 })
      .toBeGreaterThan(0)
    await page.mouse.up()

    // A loop that kept running past pointerup would keep scrolling forever.
    const settled = await viewport.evaluate((el) => el.scrollTop)
    await page.waitForTimeout(400)
    expect(await viewport.evaluate((el) => el.scrollTop)).toBe(settled)
  })

  test('undo walks the whole move back', async ({ page }) => {
    await setup(page)
    const before = [await text(page, 0, 1), await text(page, 1, 1)]

    await selectRange(page, 0, 1, 1, 1)
    await dragBorder(page, 0, 1, 3, 0)
    expect(await text(page, 0, 1)).toBe('')

    // Four writes: two source cells blanked, two destination cells written.
    for (let i = 0; i < 4; i += 1) await page.keyboard.press('Control+z')

    expect(await text(page, 0, 1)).toBe(before[0])
    expect(await text(page, 1, 1)).toBe(before[1])
    expect(await text(page, 3, 1)).toBe('')
    expect(await text(page, 4, 1)).toBe('')
  })

  test('moveCells={false} puts the border back to starting a selection', async ({ page }) => {
    await setup(page)
    await page.getByRole('checkbox').first().uncheck()

    await selectRange(page, 0, 1, 1, 1)
    const before = await text(page, 0, 1)
    await dragBorder(page, 0, 1, 3, 0)

    // The gesture rubber-banded a new selection instead of moving anything.
    expect(await text(page, 0, 1)).toBe(before)
    expect(await text(page, 3, 1)).toBe('')
    await expect(page.locator('.sv-grid-root').first()).not.toHaveAttribute('data-move-grab', 'true')
  })
})
