/**
 * E2E: once he has sat down and said hello, Zazo opens his laptop and works
 * on SvGrid within a few seconds, with a note in a bubble the first time
 * (shown, not spoken). A hover puts the laptop away; left alone again, he goes
 * back to work, without repeating the note.
 *
 * The page clock is Playwright's, so the waits pass at once. He stays away
 * under automation unless the URL has `?zazo`.
 */
import { expect, test, type Page } from '@playwright/test'

async function seated(page: Page, path: string) {
  // Paused, not just installed: an installed clock still runs in real time,
  // and a slow first compile then ate into his wait before we counted.
  await page.clock.install({ time: new Date('2026-10-17T09:00:00') })
  await page.clock.pauseAt(new Date('2026-10-17T09:00:01'))
  // Not "load": on a cold dev server the home page's first compile can take
  // longer than a test, and only his own element matters here.
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  const figure = page.locator('.zazo-figure')
  // The home page loads him on an idle timer, which the paused clock holds:
  // step it half a second at a time, giving the network real time between.
  for (let i = 0; i < 120 && !(await figure.count()); i++) {
    await page.clock.runFor(500)
    await page.waitForTimeout(250)
  }
  await figure.waitFor({ state: 'attached', timeout: 5_000 })
  // His walk-in: a delay, the stroll, sitting down.
  await page.clock.runFor(6000)
  await page.mouse.move(10, 600)
  return figure
}

test.describe('Zazo, left alone', () => {
  // Room for a cold server's first compile; the half minute itself is instant.
  test.describe.configure({ timeout: 90_000 })

  test('opens his laptop soon after he sits, shows his note, and stops on hover', async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium', 'desktop only: he is hidden on phones')
    const figure = await seated(page, '/sv-grid/?zazo')

    // The hello bubble is up for 5 s after he sits; he does not work over it.
    await page.clock.runFor(10_000)
    await expect(figure).toHaveClass(/is-working/)
    await expect(page.locator('.zazo-work-note')).toHaveText(
      "OK, if you need me, I'm here. While I'm idle, I'll continue improving SvGrid.",
    )
    // The mouse, not locator.hover(): hover() waits for him to hold still, and
    // on a cold server the header can still be settling under him.
    const box = await figure.boundingBox()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 3, { steps: 4 })
    await expect(figure).not.toHaveClass(/is-working/)
    await expect(page.locator('.zazo-work-note')).toHaveCount(0)

    // Left alone again, he goes back to work, and the note is not repeated.
    await page.mouse.move(10, 600)
    await page.clock.runFor(4_000)
    await expect(figure).toHaveClass(/is-working/)
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
