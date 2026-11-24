/**
 * E2E: a double-click opens a cell's dialog and leaves it open. On a cell that
 * is already selected, the first click opens the editor, so the dialog (files)
 * appears under the mouse before the second press, which landed outside it and
 * closed it at once. The second press of a double-click is not a click away.
 */
import { expect, test, type Page } from '@playwright/test'

const HIRING = '/sv-grid/#/demos/514-base-hiring-tracker'

async function resumeCell(page: Page) {
  await page.setViewportSize({ width: 2400, height: 900 })
  await page.goto(HIRING)
  await page.locator('.sv-btabs').waitFor({ timeout: 120_000 })
  // The demo opens on its Kanban view.
  await page.getByRole('button', { name: /Hiring pipeline/ }).first().click()
  await page.getByText('All candidates', { exact: true }).first().click()
  const cell = page.locator('.sv-grid-body td').filter({ hasText: '-resume.pdf' }).first()
  await cell.waitFor({ timeout: 60_000 })
  const box = (await cell.boundingBox())!
  return { x: box.x + 30, y: box.y + box.height / 2 }
}

test.describe('a double-click opens a cell\'s dialog, and it stays open', () => {
  test.setTimeout(120_000)

  test('on a file cell that is already selected', async ({ page }) => {
    const at = await resumeCell(page)
    await page.mouse.click(at.x, at.y)
    await page.waitForTimeout(400)
    await page.mouse.dblclick(at.x, at.y)
    await page.waitForTimeout(700)
    await expect(page.locator('.sv-attd')).toBeVisible()
  })

  test('on a file cell that was not selected', async ({ page }) => {
    const at = await resumeCell(page)
    await page.mouse.dblclick(at.x, at.y)
    await page.waitForTimeout(700)
    await expect(page.locator('.sv-attd')).toBeVisible()
  })

  test('a single click on a file of the selected cell opens it full size, not the dialog', async ({ page }) => {
    const at = await resumeCell(page)
    await page.mouse.click(at.x, at.y)
    await page.waitForTimeout(400)
    await expect(page.locator('.sv-attp')).toHaveCount(0)
    await page.mouse.click(at.x, at.y)
    await expect(page.locator('.sv-attp')).toBeVisible()
    await expect(page.locator('.sv-attd')).toHaveCount(0)
  })

  test('a press away, a moment later, still closes it', async ({ page }) => {
    const at = await resumeCell(page)
    await page.mouse.click(at.x, at.y)
    await page.waitForTimeout(400)
    await page.mouse.dblclick(at.x, at.y)
    await expect(page.locator('.sv-attd')).toBeVisible()
    await page.waitForTimeout(700)
    await page.mouse.click(20, 880)
    await expect(page.locator('.sv-attd')).toHaveCount(0)
  })
})
