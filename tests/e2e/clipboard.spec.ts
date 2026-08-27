import { expect, test, type Page } from '@playwright/test'

/**
 * Clipboard round-trips, secure and insecure context.
 *
 * These live in ONE file, and run SERIALLY, on purpose. Every test here drives
 * the real OS clipboard through the same demo, and `fullyParallel: true` in
 * playwright.config.ts will otherwise spread them across workers - where two
 * browser contexts copy into the shared system clipboard at the same time and
 * each reads back the other's value. That produced a flake that moved between
 * the two tests run to run, which reads as "the clipboard feature is broken"
 * rather than "the tests raced".
 *
 * Serial mode is what pins them to one worker in sequence; splitting them back
 * into separate files would reintroduce the race even with this annotation,
 * because serial mode does not reach across files.
 *
 * Each test also calls `page.bringToFront()`. Chromium refuses clipboard reads
 * on an unfocused document - correct behaviour, not a grid bug - and with
 * several workers running, the page under test frequently is not the focused
 * one. The paste then silently no-ops and the destination cell keeps its old
 * value, which looks exactly like a broken paste. A real user is always on a
 * focused page, so the test is given the same condition.
 */
test.describe.configure({ mode: 'serial' })

const DEMO = '/sv-grid/#/demos/05-inline-editing'

async function setup(page: Page) {
  await page.locator('td[data-svgrid-row="0"][data-svgrid-col="0"]').waitFor({ timeout: 30_000 })
}
const c = (r: number, col = 0) =>
  `td[data-svgrid-row="${r}"][data-svgrid-col="${col}"]`

test.describe('clipboard commands (regression: missing ctx getters)', () => {
  test('Ctrl+C then Ctrl+V copies a cell value into another row', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    // Surface any thrown handler errors (e.g. "pasteFromClipboard is not a function").
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))

    await page.goto(DEMO)
  await page.bringToFront() // clipboard reads need a focused document
    await setup(page)

    const src = (await page.locator(c(0)).innerText()).trim()
    const dstBefore = (await page.locator(c(1)).innerText()).trim()
    expect(src).not.toBe(dstBefore) // pick rows that actually differ

    await page.locator(c(0)).click()
    await page.keyboard.press('Control+c')
    await page.waitForTimeout(120)
    await page.locator(c(1)).click()
    await page.keyboard.press('Control+v')
    await page.waitForTimeout(200)

    const dstAfter = (await page.locator(c(1)).innerText()).trim()
    expect(errors, errors.join('\n')).toHaveLength(0)
    expect(dstAfter).toBe(src)
  })

  test('Ctrl+X cuts: copies the value and clears the source cell', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))

    await page.goto(DEMO)
  await page.bringToFront() // clipboard reads need a focused document
    await setup(page)

    const src = (await page.locator(c(2)).innerText()).trim()
    expect(src.length).toBeGreaterThan(0)

    await page.locator(c(2)).click()
    await page.keyboard.press('Control+x')
    await page.waitForTimeout(200)

    const after = (await page.locator(c(2)).innerText()).trim()
    expect(errors, errors.join('\n')).toHaveLength(0)
    expect(after).toBe('') // source cleared by cut

    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip).toContain(src) // value made it to the clipboard
  })
})

// Plain HTTP / XAMPP simulation: navigator.clipboard removed entirely.
// Copy must fall back to execCommand; paste must fall back to the native
// `paste` event. Full round-trip across two cells, no async Clipboard API.
test('insecure context: copy (execCommand) + paste (native event) round-trips', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
  })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto(DEMO)
  await page.bringToFront() // clipboard reads need a focused document
  await page.locator(c(0)).waitFor({ timeout: 30_000 })
  expect(await page.evaluate(() => Boolean(navigator.clipboard))).toBe(false)

  const src = (await page.locator(c(0)).innerText()).trim()
  const dstBefore = (await page.locator(c(1)).innerText()).trim()
  expect(src).not.toBe(dstBefore)

  await page.locator(c(0)).click()
  await page.keyboard.press('Control+c') // -> legacyCopyText / execCommand
  await page.waitForTimeout(120)
  await page.locator(c(1)).click()
  await page.keyboard.press('Control+v') // -> native paste event -> onGridPaste
  await page.waitForTimeout(200)

  const dstAfter = (await page.locator(c(1)).innerText()).trim()
  expect(errors, errors.join('\n')).toHaveLength(0)
  expect(dstAfter).toBe(src)
})
