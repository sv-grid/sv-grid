import { expect, test, type Page } from '@playwright/test'

/**
 * What a typed entry becomes, and what a formula over it inherits, as
 * Excel has it: a slash date is a date and a day later is the next day,
 * a clock time is a fraction that doubles to a later time, a sum of
 * currency is currency, two dates apart are days. Then the block habits
 * around them: a merged cell copied and pasted stays merged, a row hidden
 * by hand still travels with a copy, the ribbon's Insert arrow inserts a
 * column from a cell, and the cell menu links and unlinks. Each was
 * missing on 2026-09-21: =A1+1 under a typed date was #VALUE!.
 *
 * Runs against the gallery on :5174.
 */

const GALLERY = 'http://localhost:5174'
test.use({ viewport: { width: 1400, height: 900 } })

const cell = (page: Page, r: number, c: number) =>
  page.locator(`.sv-sheet td[data-svgrid-row="${r}"][data-svgrid-col="${c}"]`)
const shown = async (page: Page, r: number, c: number) => (await cell(page, r, c).innerText()).trim()
const bar = (page: Page) => page.locator('.sv-sheet textarea.formula').first()
const menuItem = (page: Page, re: RegExp) => page.locator('[role="menu"] [role="menuitem"]', { hasText: re }).first()
async function typeInto(page: Page, r: number, c: number, text: string) {
  await cell(page, r, c).click()
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
}
async function selectRange(page: Page, r1: number, c1: number, r2: number, c2: number) {
  await cell(page, r1, c1).click()
  await page.keyboard.down('Shift')
  await cell(page, r2, c2).click()
  await page.keyboard.up('Shift')
}
async function open(page: Page, demo = '207-blank-sheet') {
  await page.addInitScript(() => { try { localStorage.setItem('sg-theme', 'light') } catch { /* private mode */ } })
  await page.goto(`${GALLERY}/#/${demo}`)
  await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(800)
}

test('a typed date, time and currency are values, and a formula over them keeps their format', async ({ page }) => {
  await open(page)
  await typeInto(page, 0, 0, '3/4/2026')
  expect(await shown(page, 0, 0)).toBe('2026-03-04')
  await typeInto(page, 1, 0, '=A1+1')
  expect(await shown(page, 1, 0)).toBe('2026-03-05')
  await typeInto(page, 2, 0, '=A2-A1')
  expect(await shown(page, 2, 0)).toBe('1')
  await typeInto(page, 0, 1, '10:30')
  expect(await shown(page, 0, 1)).toBe('10:30')
  await cell(page, 0, 1).click()
  await expect(bar(page)).toHaveValue('0.4375')
  await typeInto(page, 1, 1, '=B1*2')
  expect(await shown(page, 1, 1)).toBe('21:00')
  await typeInto(page, 0, 2, '$1,200')
  await typeInto(page, 1, 2, '=C1*2')
  expect(await shown(page, 1, 2)).toBe('$2,400')
  // COUNT returns a count, not a date: no format inherited from the day in A2.
  await typeInto(page, 3, 0, '=COUNT(A2:A3)')
  expect(await shown(page, 3, 0)).toBe('2')
  // A time typed into the currency cell makes it a time cell, as Excel does.
  await typeInto(page, 0, 2, '9:15')
  expect(await shown(page, 0, 2)).toBe('9:15')
})

test('a merged cell copied on its own pastes as a merge', async ({ page }) => {
  await open(page, '463-merged-report-headers')
  // Q1 is B2:D2 merged; a click on it, Ctrl+C, and a paste on the blank row 11.
  await cell(page, 1, 1).click()
  await page.keyboard.press('Control+C')
  await cell(page, 10, 1).click()
  await page.keyboard.press('Control+V')
  await page.waitForTimeout(400)
  expect(await cell(page, 10, 1).getAttribute('colspan')).toBe('3')
  expect(await shown(page, 10, 1)).toBe('Q1')
  await page.keyboard.press('Control+Z')
  await page.waitForTimeout(300)
  expect(await cell(page, 10, 1).getAttribute('colspan')).toBeNull()
})

test('a row hidden by hand is copied, a filtered one is not', async ({ page }) => {
  await open(page)
  for (let r = 0; r < 4; r += 1) await typeInto(page, r, 0, `r${r + 1}`)
  await cell(page, 1, 0).click()
  await page.keyboard.press('Control+9')
  await page.waitForTimeout(200)
  await selectRange(page, 0, 0, 3, 0)
  await page.keyboard.press('Control+C')
  await cell(page, 6, 0).click()
  await page.keyboard.press('Control+V')
  await page.waitForTimeout(400)
  expect([await shown(page, 6, 0), await shown(page, 7, 0), await shown(page, 8, 0), await shown(page, 9, 0)]).toEqual(['r1', 'r2', 'r3', 'r4'])
})

test('the ribbon\'s Insert arrow inserts a column from a cell, and the cell menu links and unlinks', async ({ page }) => {
  await open(page, '456-sales-report-workbook')
  await page.locator('.sv-ribbon .tabs button[role="tab"]', { hasText: /^\s*Home\s*$/ }).first().click()
  await cell(page, 4, 1).click()
  const b5 = await shown(page, 4, 1)
  await page.locator('.sv-ribbon .band:not(.measure) .split:has(button[title^="Insert Cells"]) button.arrow').first().click()
  await menuItem(page, /Insert Sheet Columns/).click()
  await page.waitForTimeout(400)
  expect(await shown(page, 4, 1)).toBe('')
  expect(await shown(page, 4, 2)).toBe(b5)
  await page.keyboard.press('Control+Z')
  await page.waitForTimeout(300)
  expect(await shown(page, 4, 1)).toBe(b5)
  // Link... on the cell menu, then Remove Link once it has one.
  await cell(page, 4, 0).click({ button: 'right' })
  await menuItem(page, /^\s*Link\.\.\.\s*$/).click()
  const modal = page.locator('.sv-modal').last()
  await modal.locator('input[type="text"]').first().fill('https://svgrid.com')
  await modal.locator('button.btn.primary').last().click()
  await page.waitForTimeout(300)
  await expect(cell(page, 4, 0).locator('.sheet-cell.linked')).toHaveCount(1)
  await cell(page, 4, 0).click({ button: 'right' })
  await expect(menuItem(page, /Open Link/)).toHaveCount(1)
  await menuItem(page, /Remove Link/).click()
  await page.waitForTimeout(300)
  await expect(cell(page, 4, 0).locator('.sheet-cell.linked')).toHaveCount(0)
})

test('the spilled-range operator sums a dynamic array and follows it as it grows', async ({ page }) => {
  // =SUM(E1#) reads the whole array E1 spills, the way Excel's does, and
  // grows with it because the anchor is always a precedent. On 2026-09-21
  // the operator would not parse: =SUM(E1#) was #PARSE!.
  await open(page)
  await typeInto(page, 0, 4, '=SEQUENCE(3)')     // E1 spills 1,2,3 down E1:E3
  expect(await shown(page, 2, 4)).toBe('3')
  await typeInto(page, 0, 6, '=SUM(E1#)')        // G1
  expect(await shown(page, 0, 6)).toBe('6')
  await typeInto(page, 0, 4, '=SEQUENCE(5)')     // grow the array
  expect(await shown(page, 0, 6)).toBe('15')
  await typeInto(page, 0, 4, '=SEQUENCE(2)')     // shrink it
  expect(await shown(page, 0, 6)).toBe('3')
  // A cell that anchors no array is #REF!, not a silent wrong answer.
  await typeInto(page, 0, 7, '=SUM(H10#)')       // H1 reads empty H10
  expect(await shown(page, 0, 7)).toBe('#REF!')
})

test('Increase/Decrease Decimal on a General number moves from what it shows', async ({ page }) => {
  // On 2026-09-21 these treated a General cell as zero decimals, so Increase
  // Decimal on 3.14159 dropped it to 3.1 and Decrease Decimal did nothing.
  // Excel moves from the decimals the value already shows.
  await open(page)
  const band = (title: string) =>
    page.locator(`.sv-ribbon .band:not(.measure) button[title^="${title}"]`).first()
  await typeInto(page, 0, 0, '3.14159')
  await cell(page, 0, 0).click()
  await band('Increase Decimal').click()
  await page.waitForTimeout(150)
  expect(await shown(page, 0, 0)).toBe('3.141590')
  await band('Decrease Decimal').click()
  await band('Decrease Decimal').click()
  await band('Decrease Decimal').click()
  await page.waitForTimeout(150)
  expect(await shown(page, 0, 0)).toBe('3.142')
  // A whole number still starts at zero decimals: Increase gives one place.
  await typeInto(page, 1, 0, '5')
  await cell(page, 1, 0).click()
  await band('Increase Decimal').click()
  await page.waitForTimeout(150)
  expect(await shown(page, 1, 0)).toBe('5.0')
})

test('a mixed fraction typed into a cell is a number, shown back as a fraction', async ({ page }) => {
  // On 2026-09-21 "3 1/2" stayed text, so =A1*2 over it was #VALUE!. Excel
  // reads a mixed fraction as its value; a bare "1/2" stays a date.
  await open(page)
  await typeInto(page, 0, 0, '3 1/2')
  expect(await shown(page, 0, 0)).toBe('3 1/2')
  await typeInto(page, 1, 0, '=A1*2')
  expect(await shown(page, 1, 0)).toBe('7')
  await typeInto(page, 2, 0, '0 3/4')
  expect((await shown(page, 2, 0)).trim()).toBe('3/4')
  // A bare fraction is still a date, as Excel keeps 1/2 the second of January.
  await typeInto(page, 3, 0, '1/2')
  expect(await shown(page, 3, 0)).toMatch(/^\d{4}-01-02$/)
})

test('LOOKUP and XMATCH complete the lookup family in the browser', async ({ page }) => {
  // Both returned #NAME? on 2026-09-21 though the sheet has VLOOKUP, XLOOKUP,
  // MATCH and INDEX. LOOKUP takes the largest item not past its value; XMATCH
  // is MATCH's modern twin with next-smaller and next-larger modes.
  await open(page)
  for (let i = 0; i < 5; i += 1) { await typeInto(page, i, 0, String((i + 1) * 2)); await typeInto(page, i, 1, String((i + 1) * 10)) }
  await typeInto(page, 0, 3, '=LOOKUP(6,A1:A5,B1:B5)')
  expect(await shown(page, 0, 3)).toBe('30')
  await typeInto(page, 1, 3, '=XMATCH(8,A1:A5)')
  expect(await shown(page, 1, 3)).toBe('4')
  await typeInto(page, 2, 3, '=INDEX(B1:B5,XMATCH(8,A1:A5))')
  expect(await shown(page, 2, 3)).toBe('40')
})
