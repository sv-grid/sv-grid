import { expect, test } from '@playwright/test'

/**
 * Demo 704: a scripted agent works through createGridTools, a person reviews.
 * Covers the whole loop in a browser: the agent's steps land with their tool
 * calls, its edits wait as proposals, an accept writes and is logged through
 * onDecision, and Revert run proposes undoing what was accepted.
 */

const DEMO = '/sv-grid/#/demos/704-agent-review-desk'

test('the agent proposes, a person accepts, the log records it, a revert is proposed', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto(DEMO)
  await page.locator('td[data-svgrid-row="0"]').first().waitFor({ timeout: 30_000 })
  await expect(page.locator('.ard-status')).toHaveText(/Waiting for review/, { timeout: 30_000 })

  // Every step done, each with the tool call it made.
  await expect(page.locator('.ard-step.is-done')).toHaveCount(9)
  await expect(page.locator('.ard-step').first()).toHaveAttribute('title', /grid_describe\(\)/)

  // Nothing written yet: row 0's company still carries its trailing spaces.
  const company = page.locator('td[data-svgrid-row="0"][data-col-id="company"]')
  await expect(company.locator('.sv-review-ghost-after')).toHaveText('Acme Robotics')

  await page.getByRole('button', { name: /^Accept \d+: Trim spaces in Company/ }).click()
  await expect(company.locator('.sv-review-ghost')).toHaveCount(0)
  await expect(page.locator('.ard-stats dd.is-good')).not.toHaveText('0')

  await page.getByRole('tab', { name: /^Log/ }).click()
  await expect(page.locator('.ard-log li').first()).toContainText(/Accepted \d+ changes to Company/)

  await page.getByRole('button', { name: 'Revert run' }).click()
  await expect(page.locator('.ard-note')).toContainText('reverts proposed')
  await page.getByRole('tab', { name: 'Review', exact: true }).click()
  await expect(page.locator('.sv-review-label', { hasText: 'Company' }).first()).toBeVisible()
})

test('Accept rule groups leaves only the groups that need a person', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto(DEMO)
  await page.locator('td[data-svgrid-row="0"]').first().waitFor({ timeout: 30_000 })
  await expect(page.locator('.ard-status')).toHaveText(/Waiting for review/, { timeout: 30_000 })
  await page.getByRole('button', { name: /^Accept rule groups/ }).click()
  // The demo's rule groups hold more changes than confirmOver (50): it asks first.
  await expect(page.locator('.sv-review-confirm')).toContainText('rule groups')
  await page.locator('.sv-review-confirm').getByRole('button', { name: /^Yes/ }).click()
  await expect(page.locator('.sv-review-badge')).toHaveCount(0)
  await expect(page.locator('.sv-review-group').first()).toBeVisible()
})

test('a sample line takes the grid to its row and lights it', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto(DEMO)
  await page.locator('td[data-svgrid-row="0"]').first().waitFor({ timeout: 30_000 })
  await expect(page.locator('.ard-status')).toHaveText(/Waiting for review/, { timeout: 30_000 })
  await page.locator('.sv-review-group-head').first().click()
  await page.locator('.sv-review-sample-row').first().click()
  await expect(page.locator('.sv-grid-cf-bg[style*="--sg-review-flash-bg"]').first()).toBeVisible()
  await expect(page.locator('.sv-grid-cf-bg[style*="--sg-review-flash-bg"]')).toHaveCount(0, { timeout: 5000 })
})
