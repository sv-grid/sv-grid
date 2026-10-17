/**
 * E2E: left alone for 30 seconds, Zazo opens his laptop and works on SvGrid,
 * with a note in a bubble (shown, not spoken). A hover puts the laptop away.
 *
 * The page clock is Playwright's, so the half minute passes at once. He stays
 * away under automation unless the URL has `?zazo`.
 */
import { expect, test, type Page } from '@playwright/test'

async function seated(page: Page, path: string) {
  await page.clock.install()
  await page.goto(path)
  const figure = page.locator('.zazo-figure')
  await figure.waitFor({ state: 'attached' })
  // His walk-in: a delay, the stroll, sitting down.
  await page.clock.runFor(6000)
  await page.mouse.move(10, 600)
  return figure
}

test.describe('Zazo, left alone', () => {
  test('opens his laptop after 30 s, shows his note, and stops on hover', async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium', 'desktop only: he is hidden on phones')
    const figure = await seated(page, '/sv-grid/?zazo')

    await page.clock.runFor(25_000)
    await expect(figure).not.toHaveClass(/is-working/)

    await page.clock.runFor(6_000)
    await expect(figure).toHaveClass(/is-working/)
    await expect(page.locator('.zazo-work-note')).toHaveText(
      "OK, if you need me, I'm here. While I'm idle, I'll continue improving SvGrid.",
    )
    await figure.hover()
    await expect(figure).not.toHaveClass(/is-working/)
    await expect(page.locator('.zazo-work-note')).toHaveCount(0)
  })

  test('does not start while his popup is open', async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium', 'desktop only: he is hidden on phones')
    const figure = await seated(page, '/sv-grid/?zazo')
    await figure.click()
    await expect(page.locator('#zazo-panel')).toBeVisible()
    await page.mouse.move(10, 600)
    await page.clock.runFor(40_000)
    await expect(figure).not.toHaveClass(/is-working/)
  })
})
