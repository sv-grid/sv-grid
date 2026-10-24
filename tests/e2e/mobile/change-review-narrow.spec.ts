import { expect, test } from '@playwright/test'

/**
 * Demo 702 on a phone. The demo stage has a fixed height, and the grid plus
 * the review panel stacked are taller than it: they used to paint over
 * "About this example". On a narrow screen the demo shows one at a time,
 * with the grid kept mounted so the review keeps its api.
 */

const DEMO = '/sv-grid/#/demos/702-change-review'

test('a phone shows the grid or the review, and switching keeps the proposals', async ({ page }) => {
  await page.goto(DEMO)
  await page.locator('td[data-svgrid-row="0"]').first().waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Run cleanup agent' }).click()
  await expect(page.locator('.sv-review-ghost').first()).toBeVisible()
  await expect(page.locator('.sv-review')).toBeHidden()

  await page.getByRole('button', { name: /^Review \(\d+\)$/ }).click()
  await expect(page.locator('.sv-review')).toBeVisible()
  await expect(page.locator('.sv-grid-root')).toBeHidden()

  // The panel scrolls inside its own box instead of running past the stage.
  const panel = (await page.locator('.cr-panel').boundingBox())!
  expect(panel.height).toBeLessThanOrEqual(461)

  await page.getByRole('button', { name: 'Grid', exact: true }).click()
  await expect(page.locator('.sv-review-ghost').first()).toBeVisible()
})
