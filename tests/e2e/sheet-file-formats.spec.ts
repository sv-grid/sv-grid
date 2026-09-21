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
 * and the .xls leg that the compound file the BIFF writer lays out is one a
 * reader can walk, which no unit test over strings can say.
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

for (const [label, title] of [
  ['xlsx', 'Save the workbook as an .xlsx'],
  ['ods', 'Save the workbook as an .ods'],
  // '.xls file', not '.xls': the prefix alone also matches the .xlsx
  // button, which comes first, and this leg tested .xlsx twice for a while.
  ['xls', 'Save the workbook as an .xls file'],
] as const) {
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

/**
 * A sheet saved while FILTERED. The region alone went into the files once,
 * so 34 of 40 rows on screen came back as 40 in Excel, in LibreOffice and
 * here. The rows a filter folds now go out hidden and the criteria beside
 * the region (.xlsx and .ods); an .xls carries the hidden rows only.
 */
test.describe('a filtered sheet in a file', () => {
  // Tall enough that every row of the demo is rendered, since the check
  // counts the collapsed rows in the DOM.
  test.use({ viewport: { width: 1400, height: 900 } })
  for (const [label, title, keepsCriteria] of [
  ['xlsx', 'Save the workbook as an .xlsx', true],
  ['ods', 'Save the workbook as an .ods', true],
  ['xls', 'Save the workbook as an .xls file', false],
] as const) {
  test(`a filtered sheet saved as ${label} reopens showing the same rows`, async ({ page }) => {
    await open(page, '464-ticket-log-autofilter')
    await expect(page.locator('.sv-sheet .status')).toContainText('34 of 40 records found')
    const collapsed = () => page.evaluate(() =>
      [...document.querySelectorAll('.sv-sheet td[data-svgrid-col="0"]')].filter((td) => td.getBoundingClientRect().height === 0).length)

    await page.locator('.sv-ribbon .tabs button[role="tab"]', { hasText: 'File' }).first().click()
    await page.waitForTimeout(300)
    const download = page.waitForEvent('download', { timeout: 30_000 })
    await page.locator(`.sv-ribbon .band:not(.measure) button[title^="${title}"]`).first().click()
    const file = await download
    const path = join(mkdtempSync(join(tmpdir(), 'svgrid-')), `tickets.${label}`)
    await file.saveAs(path)
    await page.setInputFiles('.sv-sheet input.sheet-file-input[accept*="xlsx"]', path)
    await page.waitForTimeout(1800)

    // The six Closed tickets are folded away again.
    expect(await collapsed()).toBe(6)
    if (keepsCriteria) {
      // The filter came back as a filter: a funnel on Status, and Clear
      // Filter brings the rows back.
      await expect(page.locator('.sv-sheet .sheet-filter-arrow.filtered')).toHaveCount(1)
      await page.locator('.sv-sheet .sheet-filter-arrow.filtered').click()
      await page.locator('.sv-sheet-filter-menu button.row', { hasText: /Clear Filter/ }).first().click()
      await page.waitForTimeout(400)
      expect(await collapsed()).toBe(0)
    } else {
      // BIFF has no place for the criteria this writes: the rows are hidden by hand.
      await expect(page.locator('.sv-sheet .sheet-filter-arrow.filtered')).toHaveCount(0)
    }
  })
}

  test('a filtered sheet prints without the rows the filter folds away', async ({ page }) => {
    await open(page, '464-ticket-log-autofilter')
    await expect(page.locator('.sv-sheet .status')).toContainText('34 of 40 records found')
    // File > Print writes the page into a window it opens; a stand-in
    // collects the markup instead of printing it.
    await page.evaluate(() => {
      const w = window as unknown as { __printed: string; open: () => unknown }
      w.__printed = ''
      w.open = () => ({
        document: { open() {}, write(html: string) { w.__printed += html }, close() {} },
        focus() {}, print() {}, close() {}, addEventListener() {},
      })
    })
    await page.locator('.sv-ribbon .tabs button[role="tab"]', { hasText: 'File' }).first().click()
    await page.waitForTimeout(300)
    await page.locator('.sv-ribbon .band:not(.measure) button[title^="Print"]').first().click()
    await page.waitForTimeout(800)
    const html = await page.evaluate(() => (window as unknown as { __printed: string }).__printed)
    // 34 tickets under one header row; the six Closed ones stay out, so
    // the only "Closed" on the page is the legend's label under the log.
    expect((html.match(/<tr\b/g) ?? []).length).toBeLessThanOrEqual(40)
    expect((html.match(/>Closed</g) ?? []).length).toBe(1)
    expect(html).toContain('>Open<')
  })
})
