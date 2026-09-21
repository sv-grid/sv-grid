import { expect, test } from '@playwright/test'

/**
 * The sheet shell's chrome on a phone. The ribbon's eight tab labels are
 * wider than a 390px screen; on 2026-09-21 they shrank into each other
 * ("Page LayoutFormulasData") instead of scrolling, and a long entry in
 * the one-row formula bar folded onto a second line the box then hid.
 * Playwright's iPhone 13 metrics (see playwright.config.ts).
 *
 * Runs against the gallery on :5174, so it needs no private website submodule.
 */

test('the ribbon tabs scroll sideways rather than overlap, and a long entry stays on one line of the bar', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('sg-theme', 'light') } catch { /* private mode */ } })
  await page.goto('http://localhost:5174/#/456-sales-report-workbook')
  await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(800)
  const tabs = page.locator('.sv-ribbon .tabs[role="tablist"]')
  const boxes = await tabs.locator('button[role="tab"]').evaluateAll((els) =>
    els.map((el) => { const b = el.getBoundingClientRect(); return { left: b.left, right: b.right } }))
  expect(boxes.length).toBeGreaterThan(5)
  for (let i = 1; i < boxes.length; i += 1) expect(boxes[i]!.left).toBeGreaterThanOrEqual(boxes[i - 1]!.right - 0.5)
  expect(await tabs.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
  // The title in A1 is wider than the bar here and stays on one line of it.
  const bar = page.locator('.sv-sheet textarea.formula').first()
  await expect(bar).toHaveValue(/sales summary/)
  await expect(bar).toHaveAttribute('wrap', 'off')
  // No hidden second line: the text's height is the box's.
  expect(await bar.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1)
})
