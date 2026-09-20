import { expect, test, type Page } from '@playwright/test'

/**
 * File > Save As, then File > Open on what was written, in a real browser.
 *
 * The parts this exercises cannot be reached from jsdom: the zip is built by
 * jszip loaded on demand, the pictures ride in it as media rather than as
 * text, a chart part carries the references its series read, and the
 * sparklines live in the worksheet's x14 extension list. The unit tests
 * check the parts; this checks that a file written by the shell opens in the
 * shell with everything still on it.
 *
 * Runs against the gallery on :5174, so it needs no private website
 * submodule.
 */

const GALLERY = 'http://localhost:5174'

async function open(page: Page, demo: string) {
  await page.addInitScript(() => { try { localStorage.setItem('sg-theme', 'light') } catch { /* private mode */ } })
  await page.goto(`${GALLERY}/#/${demo}`)
  await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(600)
}

const ribbonTab = (page: Page, name: string) =>
  page.locator('.sv-ribbon .tabs button[role="tab"]', { hasText: name }).first()
const fileButton = (page: Page, title: string) =>
  page.locator(`.sv-ribbon .band:not(.measure) button[title^="${title}"]`).first()

/** What the shell draws over the cells, which is what a file can lose. */
const drawn = (page: Page) => page.evaluate(() => ({
  objects: document.querySelectorAll('.sheet-object').length,
  cellImages: document.querySelectorAll('img.sheet-cell-image').length,
  sparklines: document.querySelectorAll('.sv-sheet td svg').length,
}))

test.describe('a file written by the shell opens in the shell', () => {
  for (const demo of ['494-sheet-cell-images', '485-sheet-charts-objects']) {
    test(`with everything still on it: ${demo}`, async ({ page }, testInfo) => {
      test.setTimeout(180_000)
      await open(page, demo)
      const before = await drawn(page)
      expect(before.cellImages + before.objects, 'something is drawn to begin with').toBeGreaterThan(0)

      await ribbonTab(page, 'File').click()
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30_000 }),
        fileButton(page, 'Save the workbook').click(),
      ])
      const file = testInfo.outputPath(`${demo}.xlsx`)
      await download.saveAs(file)

      // A fresh shell, so what comes back comes out of the file.
      await open(page, '207-blank-sheet')
      await ribbonTab(page, 'File').click()
      const chooser = page.waitForEvent('filechooser', { timeout: 20_000 })
      await fileButton(page, 'Open an .xlsx').click()
      await (await chooser).setFiles(file)
      await page.locator('.sv-sheet .status', { hasText: /Opened/ }).first().waitFor({ timeout: 30_000 })
      await page.waitForTimeout(1200)

      expect(await drawn(page), 'the same pictures, charts and sparklines').toEqual(before)
    })
  }
})
