import { expect, test, type Page } from '@playwright/test'

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
