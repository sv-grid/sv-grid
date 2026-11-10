/**
 * E2E: a chart whose title the PDF's font cannot draw says so where the person looks, and the
 * grid's chart panel Export menu takes the keyboard.
 *  - demo 451: the toolbar's PDF button is marked off once pointed at or focused, and a press puts
 *    the reason in the button (it did nothing on screen),
 *  - demo 355: the panel's Export menu takes arrow keys, keeps focus and gives it back to Export,
 *    and its PDF item reads the reason.
 * The demos' titles are Latin: each test gives its chart a Cyrillic one in the served module only.
 */
import { expect, test, type Page } from '@playwright/test'

const WHY = 'No PDF: its font cannot draw "Выручка". Download PNG or SVG.'

/** Serve a demo with one string of its source changed. */
async function retitle(page: Page, demo: RegExp, from: string, to: string) {
  await page.route(demo, async (route) => {
    const res = await route.fetch()
    const text = await res.text()
    await route.fulfill({ response: res, body: text.split(from).join(to) })
  })
}

test.describe('chart PDF refusal and the panel Export menu (real browser)', () => {
  test('the toolbar PDF button says why, before and after a press', async ({ page }) => {
    await retitle(page, /451-chart-annotations\.svelte/, "'Five years of monthly active users'", "'Выручка'")
    await page.goto('/sv-grid/#/demos/451-chart-annotations')
    const tools = page.locator('.sv-grid-chart-toolbar').first().locator('.sv-grid-chart-tool')
    await tools.filter({ hasText: /^PDF$/ }).waitFor({ timeout: 60_000 })
    // The same button by its place: its text changes.
    const pdf = tools.nth(await tools.evaluateAll((els) => els.findIndex((el) => el.textContent?.trim() === 'PDF')))
    let downloads = 0
    page.on('download', () => downloads++)
    // By keyboard: focus alone fetches what it needs to know.
    await pdf.focus()
    await expect(pdf).toHaveAttribute('aria-disabled', 'true')
    await expect(pdf).toHaveAttribute('title', WHY)
    await pdf.press('Enter')
    await expect(pdf).toHaveText(WHY)
    await expect(page.locator('.sv-grid-chart-live').first()).toHaveText(WHY)
    expect(downloads).toBe(0)
  })

  test('the panel Export menu: arrows, focus in and back, and a PDF item that says why', async ({ page }) => {
    await retitle(page, /355-charting-custom-buildspec\.svelte/, "type: 'sankey',", "type: 'sankey', title: 'Выручка',")
    await page.goto('/sv-grid/#/demos/355-charting-custom-buildspec')
    const exportBtn = page.getByRole('button', { name: 'Export chart' })
    await exportBtn.waitFor({ timeout: 60_000 })
    await exportBtn.focus()
    await page.keyboard.press('Enter')
    const menu = page.locator('.sv-grid-chart-export-menu')
    const items = menu.getByRole('menuitem')
    await expect(items.first()).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(items.nth(1)).toBeFocused()
    await page.keyboard.press('End')
    await expect(items.last()).toBeFocused()
    await page.keyboard.press('Home')
    await expect(items.first()).toBeFocused()
    const pdf = items.nth(2)
    await expect(pdf).toHaveText(WHY)
    await expect(pdf).toHaveAttribute('aria-disabled', 'true')
    // It looks off, as an off CSV item does: the words alone told a sighted user.
    const look = (i: number) => items.nth(i).evaluate((el) => getComputedStyle(el).opacity)
    expect(Number(await look(2))).toBeLessThan(0.6)
    expect(Number(await look(0))).toBe(1)
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(exportBtn).toBeFocused()
    // An item chosen by keyboard: focus comes back to Export, not to the page.
    await page.keyboard.press('Enter')
    await expect(items.first()).toBeFocused()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await expect(menu).toHaveCount(0)
    await expect(exportBtn).toBeFocused()
  })
})
