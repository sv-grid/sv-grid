/**
 * E2E: real files through the base's import dialog, and a view out as a file
 * (demo 512, the sales CRM).
 *  - a semicolon file with decimal commas lands in the right columns as numbers,
 *  - a quote inside a word does not merge records,
 *  - a file that is not UTF-8, a quote never closed and a ragged row are reported,
 *  - a file that is not text is refused,
 *  - choosing another separator reads the file again,
 *  - "Download this view as CSV" writes what the cells show.
 */
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const DEMO = '/sv-grid/#/demos/512-base-sales-crm'

async function openImport(page: Page) {
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.goto(DEMO)
  await page.locator('.sv-btabs').waitFor({ timeout: 60_000 })
  await page.locator('.sv-grid-row').first().waitFor()
  await page.getByRole('button', { name: 'All tables' }).click()
  await page.getByRole('menuitem', { name: 'Import a file as a table' }).click()
}

const give = (page: Page, name: string, text: string | Buffer) =>
  page.locator('input[type=file]').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(text as string) })

test.describe('SvGrid Base import and download (real browser)', () => {
  test('a semicolon file with decimal commas', async ({ page }) => {
    await openImport(page)
    await give(page, 'prices.csv', 'name;price\nAna;1,50\nBen;2,75\n')
    await expect(page.locator('.sv-bimp-file')).toContainText('2 records, 2 columns')
    await expect(page.locator('.sv-bimp-read select').first()).toHaveValue(';')
    await page.locator('.sv-bimp-btn.is-primary').click()
    await expect(page.locator('.sv-grid-row', { hasText: 'Ana' }).first()).toContainText('1.5')
  })

  test('a quote inside a word keeps the records apart', async ({ page }) => {
    await openImport(page)
    await give(page, 'stock.csv', 'item,qty\nDell 24" monitor,1\nHP 27" monitor,2\nMouse,3\n')
    await expect(page.locator('.sv-bimp-file')).toContainText('3 records, 2 columns')
    await expect(page.locator('.sv-bimp-warn')).toHaveCount(0)
  })

  test('what is odd about a file is said before the import', async ({ page }) => {
    await openImport(page)
    await give(page, 'odd.csv', Buffer.concat([Buffer.from('a,b\n"oops,1\nJos'), Buffer.from([0xe9]), Buffer.from(',2,3\n')]))
    const warn = page.locator('.sv-bimp-warn')
    await expect(warn).toContainText('read as windows-1252')
    await expect(warn).toContainText('A quote on line 2 is never closed')
    await expect(warn).toContainText('more cells than the header row')
    await expect(page.locator('.sv-bimp-map tbody tr')).toHaveCount(3)
  })

  test('a file that is not text is refused in words', async ({ page }) => {
    await openImport(page)
    await give(page, 'fake.csv', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 13, 0, 1, 2, 3]))
    await expect(page.locator('.sv-bimp-error')).toContainText('This file is not text')
  })

  test('another separator reads the file again', async ({ page }) => {
    await openImport(page)
    await give(page, 'semi.csv', 'a;b\n1;2\n')
    await expect(page.locator('.sv-bimp-file')).toContainText('2 columns')
    await page.locator('.sv-bimp-read select').first().selectOption(',')
    await expect(page.locator('.sv-bimp-file')).toContainText('1 columns')
  })

  test('a view downloads as its cells read', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 })
    await page.goto(DEMO)
    await page.locator('.sv-btabs').waitFor({ timeout: 60_000 })
    const first = page.locator('.sv-grid-row').first()
    await first.waitFor()
    await page.getByRole('button', { name: 'All tables' }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: 'Download this view as CSV' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/\.csv$/)
    const text = readFileSync(await file.path(), 'utf8')
    expect(text).not.toContain('[object Object]')
    expect(text.split('\n').length).toBeGreaterThan(2)
  })
})
