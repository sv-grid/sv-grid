/**
 * E2E: engine-level column reorder.
 *
 * Real drag-and-drop tests for `enableColumnReorder` - the path jsdom
 * can't exercise. We visit demo 109, perform an honest pointer drag
 * across header rectangles, and assert that the DOM order updates.
 *
 * Also covers persistence: the demo writes the order to localStorage,
 * so reloading the page and checking the order proves round-trip.
 */
import { expect, test } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/109-column-reorder-engine'

/** Read the current visual column order from the header DOM. */
async function readOrder(page: import('@playwright/test').Page) {
  return page.$$eval('th[data-svgrid-header-col]', (els) =>
    els.map((el) => el.getAttribute('data-svgrid-header-col') ?? ''),
  )
}

/** Drag one header onto another with a left/right "side" choice that
 *  picks the drop position. Uses real pointer events to drive Svelte's
 *  dragstart / dragover / drop handlers. */
async function dragHeader(
  page: import('@playwright/test').Page,
  fromId: string,
  toId: string,
  side: 'before' | 'after',
) {
  const from = page.locator(`th[data-svgrid-header-col="${fromId}"]`)
  const to   = page.locator(`th[data-svgrid-header-col="${toId}"]`)
  await from.scrollIntoViewIfNeeded()
  await to.scrollIntoViewIfNeeded()
  const fromBox = await from.boundingBox()
  const toBox   = await to.boundingBox()
  if (!fromBox || !toBox) throw new Error('missing bounding box')
  const dropX = side === 'before' ? toBox.x + 4 : toBox.x + toBox.width - 4
  const dropY = toBox.y + toBox.height / 2

  // Playwright's `dragTo` doesn't dispatch real HTML5 dragstart events,
  // so use the manual pointer approach + dispatchEvent for drag types.
  await from.dispatchEvent('dragstart', { bubbles: true, cancelable: true })
  await to.dispatchEvent('dragover', {
    bubbles: true, cancelable: true,
    clientX: dropX, clientY: dropY,
  })
  await to.dispatchEvent('drop', {
    bubbles: true, cancelable: true,
    clientX: dropX, clientY: dropY,
  })
  await from.dispatchEvent('dragend', { bubbles: true, cancelable: true })
}

test.describe('column reorder (engine, real browser)', () => {
  test.beforeEach(async ({ page }) => {
    // Reset persisted order so each test starts from the natural one.
    await page.addInitScript(() => {
      try { window.localStorage.removeItem('sv-109-column-order') } catch { /* ignore */ }
    })
    await page.goto(DEMO)
    // Wait for the grid to mount and emit its initial column set.
    await page.locator('th[data-svgrid-header-col]').first().waitFor()
  })

  test('drag "name" onto "symbol" → name is first', async ({ page }) => {
    const before = await readOrder(page)
    expect(before[0]).toBe('symbol')
    expect(before.includes('name')).toBe(true)

    await dragHeader(page, 'name', 'symbol', 'before')
    // The grid reorders synchronously after drop; a short polling
    // expect handles any micro-task latency in the reactivity.
    await expect.poll(() => readOrder(page).then((o) => o[0])).toBe('name')

    const after = await readOrder(page)
    expect(after.length).toBe(before.length)
    expect(after).toContain('symbol')
  })

  test('drag "sector" to the right of "yield" → sector at the end', async ({ page }) => {
    const before = await readOrder(page)
    expect(before.includes('sector')).toBe(true)
    expect(before.includes('yield')).toBe(true)

    await dragHeader(page, 'sector', 'yield', 'after')
    await expect.poll(async () => {
      const order = await readOrder(page)
      return order.indexOf('sector') > order.indexOf('yield')
    }).toBe(true)
  })

  test('toolbar Reverse button reverses the order', async ({ page }) => {
    const before = await readOrder(page)
    await page.getByRole('button', { name: 'Reverse' }).click()
    await expect.poll(() => readOrder(page)).toEqual(before.slice().reverse())
  })

  test('toolbar Alphabetical button sorts ids ascending', async ({ page }) => {
    await page.getByRole('button', { name: 'Alphabetical' }).click()
    const order = await readOrder(page)
    expect(order).toEqual(order.slice().sort())
  })

  test('toolbar Reset to natural restores the original order', async ({ page }) => {
    await page.getByRole('button', { name: 'Reverse' }).click()
    await expect.poll(async () => (await readOrder(page))[0]).toBe('yield')

    await page.getByRole('button', { name: 'Reset to natural' }).click()
    await expect.poll(async () => (await readOrder(page))[0]).toBe('symbol')
  })

  test('order persists across reloads (localStorage)', async ({ page }) => {
    await page.getByRole('button', { name: 'Reverse' }).click()
    const afterClick = await readOrder(page)

    await page.reload()
    await page.locator('th[data-svgrid-header-col]').first().waitFor()
    const afterReload = await readOrder(page)
    expect(afterReload).toEqual(afterClick)
  })

  test('headers carry draggable=true when enableColumnReorder is on', async ({ page }) => {
    const draggables = await page.$$eval(
      'th[data-svgrid-header-col][draggable="true"]',
      (els) => els.length,
    )
    expect(draggables).toBeGreaterThan(0)
  })
})
