import { expect, test, type Page } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Pictures on the sheet, in a real browser: what is PAINTED, not what is in
 * the DOM.
 *
 * A QA round found every `=IMAGE(...)` cell in demo 494 blank while jsdom
 * counted its `<img>` as present: the cell's value is the data URL, a long
 * string, so the text span spilled over the empty neighbour and painted its
 * opaque background over the picture. Only a pixel says whether a picture
 * shows, so these read one from a screenshot. The same round found the
 * sort writing formulas verbatim, so a sorted thumbnail read the row that
 * took its place; the formula bar's chevron sizing the bar by line breaks
 * rather than wrapped lines; and an SVG dropped from the .xlsx without a
 * word.
 *
 * Runs against the gallery on :5174.
 */

const GALLERY = 'http://localhost:5174'

// Tall enough for the demo's rows to fit: a click on a lower cell must not
// scroll the thumbnails under the frozen header before a pixel is read.
test.use({ viewport: { width: 1400, height: 900 } })

const cell = (page: Page, r: number, c: number) =>
  page.locator(`.sv-sheet td[data-svgrid-row="${r}"][data-svgrid-col="${c}"]`)
const tab = (page: Page, name: string) =>
  page.locator('.sv-ribbon .tabs button[role="tab"]', { hasText: name }).first()
const button = (page: Page, title: string) =>
  page.locator(`.sv-ribbon .band:not(.measure) button[title^="${title}"]`).first()

async function open(page: Page, demo: string, theme: 'light' | 'dark' = 'light') {
  await page.addInitScript((m) => { try { localStorage.setItem('sg-theme', m) } catch { /* private mode */ } }, theme)
  await page.goto(`${GALLERY}/#/${demo}`)
  await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(800)
}

/** The composite colour at a point inside an element, from a screenshot. */
async function pixelAt(page: Page, selector: string, fx: number, fy: number): Promise<[number, number, number]> {
  const target = page.locator(selector).first()
  // A picture that has just been (re)rendered is blank until it decodes.
  await target.evaluate(async (el) => { if (el instanceof HTMLImageElement) await el.decode().catch(() => {}) })
  await page.waitForTimeout(100)
  const box = await target.boundingBox()
  if (!box) throw new Error(`${selector} has no box`)
  const clip = { x: Math.round(box.x + box.width * fx), y: Math.round(box.y + box.height * fy), width: 1, height: 1 }
  const png = await page.screenshot({ clip, type: 'png' })
  return page.evaluate(async (b64) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + b64
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const g = canvas.getContext('2d')!
    g.drawImage(img, 0, 0)
    const [r, gr, b] = g.getImageData(0, 0, 1, 1).data
    return [r, gr, b] as [number, number, number]
  }, png.toString('base64'))
}
const near = (px: number[], hex: string, tolerance = 24) => {
  const want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return px.every((v, i) => Math.abs(v - want[i]!) <= tolerance)
}
/** Demo 494's swatches, by product. */
const SWATCH: Record<string, string> = { Licence: '#2563eb', Support: '#16a34a', Training: '#ea580c', Hosting: '#a855f7' }
const thumb = (r: number) => `.sv-sheet td[data-svgrid-row="${r}"][data-svgrid-col="4"] img.sheet-cell-image`

test.describe('IMAGE cells (demo 494)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`every thumbnail is painted with its swatch colour on the ${theme} theme`, async ({ page }) => {
      await open(page, '494-sheet-cell-images', theme)
      for (let r = 1; r <= 4; r += 1) {
        const name = (await cell(page, r, 0).innerText()).trim()
        // Off centre, past the letter drawn in the middle of the swatch.
        const px = await pixelAt(page, thumb(r), 0.3, 0.5)
        expect(near(px, SWATCH[name]!), `${name} at E${r + 1}: ${px} vs ${SWATCH[name]}`).toBe(true)
        // The span shows no text and does not spill: the picture is the cell.
        await expect(cell(page, r, 4).locator('.sheet-cell.spill')).toHaveCount(0)
      }
      // A source a browser will not load stays text.
      await expect(cell(page, 6, 4)).toContainText('ftp://example.com/a.png')
      await expect(cell(page, 6, 4).locator('img')).toHaveCount(0)
    })
  }

  test('a sort by price takes each picture along with its row', async ({ page }) => {
    await open(page, '494-sheet-cell-images')
    await cell(page, 1, 1).click()
    await tab(page, 'Data').click()
    await button(page, 'Sort A to Z').click()
    await page.waitForTimeout(400)
    // Off the block, so the selection's tint is not in the pixels.
    await cell(page, 6, 6).click()
    const order: string[] = []
    for (let r = 1; r <= 4; r += 1) order.push((await cell(page, r, 0).innerText()).trim())
    expect(order).toEqual(['Hosting', 'Support', 'Training', 'Licence'])
    for (let r = 1; r <= 4; r += 1) {
      const name = order[r - 1]!
      // The formula moved as a copy would: it still reads its own row.
      await expect(cell(page, r, 4).locator('.sheet-cell')).toHaveAttribute('title', new RegExp(`^=IMAGE\\(C${r + 1}, ?D${r + 1}\\)$`))
      const px = await pixelAt(page, thumb(r), 0.3, 0.5)
      expect(near(px, SWATCH[name]!), `${name} now at row ${r + 1}: ${px}`).toBe(true)
    }
  })

  test('a typed =IMAGE() shows at once, and the pictures survive an .xlsx round trip', async ({ page }) => {
    await open(page, '494-sheet-cell-images')
    await cell(page, 1, 6).click()
    await page.keyboard.type('=IMAGE(C2)')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    const typed = `.sv-sheet td[data-svgrid-row="1"][data-svgrid-col="6"] img.sheet-cell-image`
    await expect(page.locator(typed)).toHaveAttribute('alt', '')
    expect(near(await pixelAt(page, typed, 0.3, 0.5), SWATCH.Licence!)).toBe(true)

    await tab(page, 'File').click()
    const download = page.waitForEvent('download', { timeout: 30_000 })
    await button(page, 'Save the workbook as an .xlsx').click()
    const file = await download
    const path = join(mkdtempSync(join(tmpdir(), 'svgrid-')), 'images.xlsx')
    await file.saveAs(path)
    await page.setInputFiles('.sv-sheet input.sheet-file-input[accept*="xlsx"]', path)
    await page.waitForTimeout(1500)
    await expect(page.locator('.sv-sheet img.sheet-cell-image')).toHaveCount(5)
    await expect(cell(page, 1, 4).locator('.sheet-cell')).toHaveAttribute('title', /^=IMAGE\(C2, ?D2\)$/)
    expect(near(await pixelAt(page, thumb(1), 0.3, 0.5), SWATCH.Licence!)).toBe(true)
  })
})

test.describe('the formula bar chevron', () => {
  test('expands to the lines a long formula wraps to, and scrolls past six', async ({ page }) => {
    await open(page, '494-sheet-cell-images')
    const long = '=' + Array.from({ length: 12 }, (_, i) =>
      `IF(B${(i % 4) + 2}>100, "price ${i} is above one hundred in this catalogue sheet", "price ${i} is below")`).join(' & ')
    await cell(page, 9, 0).click()
    // The first key opens the editor; the rest goes in as one insert, since
    // typing 1,100 characters one keystroke at a time ran past the timeout
    // on a busy machine and proves nothing the insert does not.
    await page.keyboard.type('=')
    await page.keyboard.insertText(long.slice(1))
    await page.keyboard.press('Enter')
    await cell(page, 9, 0).click()
    await page.waitForTimeout(200)
    const bar = page.locator('.sv-sheet textarea.formula')
    const state = () => bar.evaluate((t) => ({ rows: (t as HTMLTextAreaElement).rows, client: t.clientHeight, scroll: t.scrollHeight }))
    // Collapsed: one line, the rest out of sight.
    expect((await state()).rows).toBe(1)
    await page.locator('.sv-sheet button.expand').click()
    await page.waitForTimeout(300)
    const expanded = await state()
    // The formula wraps to more than six lines at this width: the bar
    // grows to six, not to the two that counting line breaks gave it.
    expect(expanded.rows).toBe(6)
    expect(expanded.scroll).toBeGreaterThan(expanded.client)
    await expect(bar).toHaveCSS('overflow-y', 'auto')
    await page.locator('.sv-sheet button.expand').click()
    expect((await state()).rows).toBe(1)
  })
})

test.describe('Insert > Picture (demo 485)', () => {
  test('an SVG picture is painted, and comes back from the .xlsx as a PNG', async ({ page }) => {
    await open(page, '485-sheet-charts-objects')
    const dir = mkdtempSync(join(tmpdir(), 'svgrid-pic-'))
    const svg = join(dir, 'mark.svg')
    writeFileSync(svg, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#dc2626"/></svg>')

    await cell(page, 6, 1).click()
    await tab(page, 'Insert').click()
    const chooser = page.waitForEvent('filechooser', { timeout: 10_000 })
    await button(page, 'Put a picture on the sheet').click()
    await (await chooser).setFiles(svg)
    await page.waitForTimeout(600)
    const picture = '.sv-sheet .sheet-object img.sheet-object-image'
    await expect(page.locator(picture)).toHaveCount(1)
    await expect(page.locator(picture)).toHaveAttribute('alt', 'mark.svg')
    expect(near(await pixelAt(page, picture, 0.5, 0.5), '#dc2626')).toBe(true)
    // Rasterised on the way in, so the file can carry it.
    await expect(page.locator(picture)).toHaveAttribute('src', /^data:image\/png/)

    await tab(page, 'File').click()
    const download = page.waitForEvent('download', { timeout: 30_000 })
    await button(page, 'Save the workbook as an .xlsx').click()
    const file = await download
    const path = join(dir, 'objects.xlsx')
    await file.saveAs(path)
    await page.setInputFiles('.sv-sheet input.sheet-file-input[accept*="xlsx"]', path)
    await page.waitForTimeout(2000)
    // Two charts and the picture, the picture painted where it was.
    await expect(page.locator('.sv-sheet .sheet-object')).toHaveCount(3)
    await expect(page.locator(picture)).toHaveCount(1)
    expect(near(await pixelAt(page, picture, 0.5, 0.5), '#dc2626')).toBe(true)
  })

  test('the seeded charts sit clear of the frozen column', async ({ page }) => {
    await open(page, '485-sheet-charts-objects')
    const charts = page.locator('.sv-sheet .sheet-object')
    await expect(charts).toHaveCount(2)
    const colA = (await cell(page, 1, 0).boundingBox())!
    for (const chart of await charts.all()) {
      const box = (await chart.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(colA.x + colA.width)
    }
  })
})
