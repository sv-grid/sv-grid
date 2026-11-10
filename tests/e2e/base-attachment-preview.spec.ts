/**
 * E2E: what a PDF preview puts in its frame. An attachment's type is only what a client
 * said, and a page in that frame can draw a sign-in form under the base's title and move
 * the whole tab. So a file is framed only when its bytes were read and are a PDF.
 */
import { expect, test, type Page, type Route } from '@playwright/test'

const HIRING = '/sv-grid/#/demos/514-base-hiring-tracker'
const EVIL = `<!doctype html><h1>Your session expired</h1><script>window.top.location = 'https://example.com/moved'</script>`
const PDF = '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'

/** Open the first candidate's resume, as a person does: the grid view, the cell, Enter, then the tile. */
async function openResume(page: Page) {
  await page.setViewportSize({ width: 2400, height: 900 })
  await page.goto(HIRING)
  await page.locator('.sv-btabs').waitFor({ timeout: 120_000 })
  // The demo opens on its Kanban view.
  await page.getByRole('button', { name: /Hiring pipeline/ }).first().click()
  await page.getByText('All candidates', { exact: true }).first().click()
  const cell = page.locator('.sv-grid-body td').filter({ hasText: '-resume.pdf' }).first()
  await cell.waitFor({ timeout: 60_000 })
  const box = (await cell.boundingBox())!
  await page.mouse.click(box.x + 30, box.y + box.height / 2)
  await page.keyboard.press('Enter')
  const face = page.locator('.sv-attd-face').first()
  await face.waitFor()
  const tile = (await face.boundingBox())!
  await page.mouse.click(tile.x + tile.width / 2, tile.y + tile.height / 2)
  await page.locator('.sv-attp').waitFor()
}

const serve = (page: Page, answer: (route: Route) => Promise<void>) => page.route('https://example.com/cv/**', answer)

test.describe('a PDF preview frames only what it read', () => {
  test.setTimeout(120_000)

  test('a page on another origin that calls itself a PDF offers a download, and the tab stays', async ({ page }) => {
    await serve(page, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: EVIL }))
    await openResume(page)
    await expect(page.locator('.sv-attp-download')).toBeVisible()
    await expect(page.locator('iframe.sv-attp-pdf')).toHaveCount(0)
    expect(page.url()).not.toContain('moved')
  })

  test('the same page, readable from here, is read and refused', async ({ page }) => {
    await serve(page, (r) => r.fulfill({ status: 200, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: EVIL }))
    await openResume(page)
    await expect(page.locator('.sv-attp-download')).toBeVisible()
    await expect(page.locator('iframe.sv-attp-pdf')).toHaveCount(0)
  })

  test('a real PDF whose host allows the read goes in as our own copy', async ({ page }) => {
    await serve(page, (r) => r.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'access-control-allow-origin': '*' }, body: PDF }))
    await openResume(page)
    await expect(page.locator('iframe.sv-attp-pdf')).toHaveAttribute('src', /^blob:/)
  })

  test('a real PDF whose host does not allow the read offers a download', async ({ page }) => {
    // Playwright adds an allow header to a fulfilled response that has none, so this one names another site.
    await serve(page, (r) => r.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'access-control-allow-origin': 'https://elsewhere.example' }, body: PDF }))
    await openResume(page)
    await expect(page.locator('.sv-attp-download')).toBeVisible()
    await expect(page.locator('iframe.sv-attp-pdf')).toHaveCount(0)
  })
})
