import { expect, test, type Page } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * The files the shell writes, opened again by the shell.
 *
 * A round trip through the browser rather than through the part builders:
 * the zip is made by jszip loaded on demand, the download goes through the
 * browser, and File > Open reads the bytes back with no name to go on. The
 * .ods leg also proves the ODF writer produces a package a reader accepts,
 * which no unit test over strings can say.
 *
 * Runs against the gallery on :5174.
 */

const GALLERY = 'http://localhost:5174'

const cell = (page: Page, r: number, c: number) =>
  page.locator(`.sv-sheet td[data-svgrid-row="${r}"][data-svgrid-col="${c}"]`)
const shown = async (page: Page, r: number, c: number) =>
  (await cell(page, r, c).innerText().catch(() => '')).trim()

async function open(page: Page, demo: string) {
  await page.addInitScript(() => { try { localStorage.setItem('sg-theme', 'light') } catch { /* private mode */ } })
  await page.goto(`${GALLERY}/#/${demo}`)
  await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(800)
}

/** The block a sheet shows, as text, for comparing before and after. */
async function block(page: Page, rows: number, cols: number): Promise<string[]> {
  const out: string[] = []
  for (let r = 0; r < rows; r += 1) {
    const line: string[] = []
    for (let c = 0; c < cols; c += 1) line.push(await shown(page, r, c))
    out.push(line.join(' | '))
  }
  return out
}

for (const [label, title] of [['xlsx', 'Save the workbook as an .xlsx'], ['ods', 'Save the workbook as an .ods']] as const) {
  test(`a ${label} written by the shell opens in the shell`, async ({ page }) => {
    await open(page, '456-sales-report-workbook')
    const before = await block(page, 8, 5)

    await page.locator('.sv-ribbon .tabs button[role="tab"]', { hasText: 'File' }).first().click()
    await page.waitForTimeout(300)
    const download = page.waitForEvent('download', { timeout: 30_000 })
    await page.locator(`.sv-ribbon .band:not(.measure) button[title^="${title}"]`).first().click()
    const file = await download
    const path = join(mkdtempSync(join(tmpdir(), 'svgrid-')), `book.${label}`)
    await file.saveAs(path)

    // Back in through File > Open, which reads the bytes rather than the name.
    await page.setInputFiles('.sv-sheet input.sheet-file-input[accept*="xlsx"]', path)
    await page.waitForTimeout(1500)
    expect(await block(page, 8, 5)).toEqual(before)
  })
}

test('a CSV the shell exports opens in the shell', async ({ page }) => {
  await open(page, '456-sales-report-workbook')
  const before = await block(page, 8, 5)

  await page.locator('.sv-ribbon .tabs button[role="tab"]', { hasText: 'File' }).first().click()
  await page.waitForTimeout(300)
  const download = page.waitForEvent('download', { timeout: 30_000 })
  await page.locator('.sv-ribbon .band:not(.measure) button[title^="Export the active sheet as CSV"]').first().click()
  const file = await download
  const path = join(mkdtempSync(join(tmpdir(), 'svgrid-')), 'sheet.csv')
  await file.saveAs(path)

  await page.setInputFiles('.sv-sheet input.sheet-file-input[accept*="csv"]', path)
  await page.waitForTimeout(1200)
  // A CSV carries what the cells SHOW, so the text comes back as it looked.
  expect(await block(page, 8, 5)).toEqual(before)
})
