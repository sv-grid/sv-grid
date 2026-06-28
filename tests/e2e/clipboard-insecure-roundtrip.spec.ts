import { expect, test } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/05-inline-editing'
const c = (r: number, col = 0) => `td[data-svgrid-row="${r}"][data-svgrid-col="${col}"]`

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
