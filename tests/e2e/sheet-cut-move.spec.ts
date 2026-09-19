import { expect, test, type Page } from '@playwright/test'

/**
 * Excel's cut and paste, in a real browser.
 *
 * Two things a QA round found broken here, neither reachable from jsdom
 * because both ride on the clipboard: Ctrl+X emptied the cells at once, so
 * Escape lost the data and a move took two undos; and a move left every
 * formula that read the cells pointing at the emptied ones, which turns a
 * total into a plausible wrong number rather than an error.
 *
 * Runs against the gallery on :5174.
 */

const GALLERY = 'http://localhost:5174'

async function open(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('sg-theme', 'light') } catch { /* private mode */ } })
  await page.goto(`${GALLERY}/#/207-blank-sheet`)
  await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(600)
}

const cell = (page: Page, r: number, c: number) =>
  page.locator(`.sv-sheet td[data-svgrid-row="${r}"][data-svgrid-col="${c}"]`)
const shown = async (page: Page, r: number, c: number) =>
  (await cell(page, r, c).innerText().catch(() => '')).trim()
const formulaOf = async (page: Page, r: number, c: number) => {
  await cell(page, r, c).click()
  await page.waitForTimeout(150)
  return page.locator('.sv-formula-bar textarea.formula').first().inputValue()
}
async function type(page: Page, r: number, c: number, text: string) {
  await cell(page, r, c).click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(90)
}

test.describe('cut and paste moves cells the way Excel does', () => {
  test('leaves the cells alone until the paste, and Escape cancels', async ({ page }) => {
    await open(page)
    await type(page, 0, 0, '10')
    await cell(page, 0, 0).click()
    await page.keyboard.press('Control+x')
    await page.waitForTimeout(300)
    expect(await shown(page, 0, 0)).toBe('10')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    expect(await shown(page, 0, 0)).toBe('10')
  })

  test('repoints the formulas that read the moved cells, and undoes in one step', async ({ page }) => {
    await open(page)
    await type(page, 0, 0, '10')
    await type(page, 1, 0, '20')
    await type(page, 4, 0, '=A1*2')
    await type(page, 4, 1, '=SUM(A1:A2)')

    // Move A1:A2 to C1:C2.
    await cell(page, 0, 0).click()
    await page.keyboard.down('Shift')
    await cell(page, 1, 0).click()
    await page.keyboard.up('Shift')
    await page.keyboard.press('Control+x')
    await page.waitForTimeout(200)
    await cell(page, 0, 2).click()
    await page.keyboard.press('Control+v')
    await page.waitForTimeout(500)

    expect(await shown(page, 0, 2)).toBe('10')
    expect(await shown(page, 0, 0)).toBe('')
    expect(await formulaOf(page, 4, 0)).toBe('=C1*2')
    expect(await formulaOf(page, 4, 1)).toBe('=SUM(C1:C2)')
    expect(await shown(page, 4, 0)).toBe('20')
    expect(await shown(page, 4, 1)).toBe('30')

    // One Ctrl+Z puts the cells and the formulas back together.
    await cell(page, 8, 3).click()
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(500)
    expect(await shown(page, 0, 0)).toBe('10')
    expect(await shown(page, 0, 2)).toBe('')
    expect(await formulaOf(page, 4, 0)).toBe('=A1*2')
    expect(await shown(page, 4, 0)).toBe('20')
  })
})

test.describe('a copy leaves out the rows nobody can see', () => {
  test('a hidden row is not carried, and the block closes up', async ({ page }) => {
    await open(page)
    for (let r = 0; r < 5; r += 1) await type(page, r, 0, String((r + 1) * 11))
    // Ctrl+9 hides the row the way Excel does.
    await cell(page, 2, 0).click()
    await page.keyboard.press('Control+9')
    await page.waitForTimeout(400)
    const height = await cell(page, 2, 0).evaluate((el) => el.getBoundingClientRect().height)
    expect(height).toBe(0)

    await cell(page, 0, 0).click()
    await page.keyboard.down('Shift')
    await cell(page, 4, 0).click()
    await page.keyboard.up('Shift')
    await page.keyboard.press('Control+c')
    await page.waitForTimeout(250)
    await cell(page, 0, 2).click()
    await page.keyboard.press('Control+v')
    await page.waitForTimeout(500)

    const pasted: string[] = []
    for (let r = 0; r < 5; r += 1) pasted.push(await shown(page, r, 2))
    expect(pasted).toEqual(['11', '22', '44', '55', ''])
  })

  test('Delete over the block leaves the hidden row holding its value', async ({ page }) => {
    await open(page)
    for (let r = 0; r < 5; r += 1) await type(page, r, 0, String((r + 1) * 11))
    await cell(page, 2, 0).click()
    await page.keyboard.press('Control+9')
    await page.waitForTimeout(400)

    await cell(page, 0, 0).click()
    await page.keyboard.down('Shift')
    await cell(page, 4, 0).click()
    await page.keyboard.up('Shift')
    // The status bar counts what can be seen: 11 + 22 + 44 + 55.
    const status = (await page.locator('.sv-sheet .status').first().innerText()).replace(/\n/g, ' ')
    expect(status).toContain('132')
    await page.keyboard.press('Delete')
    await page.waitForTimeout(500)

    const left: string[] = []
    for (let r = 0; r < 5; r += 1) left.push(await shown(page, r, 0))
    expect(left).toEqual(['', '', '33', '', ''])
  })
})
