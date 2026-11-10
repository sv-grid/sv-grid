/**
 * E2E: a base's Timeline by keyboard, screen reader and high contrast (demo
 * 513). Delete asks, a bar moves only once it is picked up, focus stays clear
 * of the task table, the menu takes focus, the table reads as a table, the
 * bars survive forced colors, and every word goes through the base's messages.
 */
import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { isDecidedContrast } from './lib/decided-contrast'

const ROADMAP = '/sv-grid/#/demos/513-base-product-roadmap'

async function open(page: Page) {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto(ROADMAP)
  await page.locator('.sv-btabs').waitFor({ timeout: 120_000 })
  await page.locator('.sv-fvb-view').first().click()
  await page.locator('.sv-fviews-pick', { hasText: 'Timeline' }).first().click()
  await page.locator('.sv-gantt-bar').first().waitFor()
}
const live = (page: Page) => page.evaluate(() => [...document.querySelectorAll('body > [aria-live]')].map((e) => e.textContent).join(' | '))
const count = (page: Page) => page.locator('.sv-gantt-bar').count()
/** The first bar, focused by Tab order as a keyboard user reaches it. */
async function firstBar(page: Page) {
  const bar = page.locator('.sv-gantt-bar').first()
  await page.locator('.sv-gantt-splitter').focus()
  await page.keyboard.press('Tab')
  await expect(bar).toBeFocused()
  return bar
}

test.describe('Timeline, for everyone', () => {
  test('Delete on a bar asks, Cancel keeps the record and the focus, and the answer deletes it', async ({ page }) => {
    await open(page)
    const bar = await firstBar(page)
    const before = await count(page)
    await page.keyboard.press('Delete')
    const dialog = page.getByRole('dialog', { name: /Delete/ })
    await expect(dialog).toBeVisible()
    expect(await count(page)).toBe(before)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    await expect(bar).toBeFocused()

    await page.keyboard.press('Backspace')
    await dialog.getByRole('button', { name: /Delete/ }).click()
    await expect.poll(() => count(page)).toBe(before - 1)
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.sv-gantt-bar'))).toBe(true)
  })

  test('a bar moves only once picked up: one write, said aloud, and Escape puts it back', async ({ page }) => {
    await open(page)
    const bar = await firstBar(page)
    const left = await bar.evaluate((el) => (el as HTMLElement).style.left)
    await page.keyboard.press('ArrowRight')
    expect(await bar.evaluate((el) => (el as HTMLElement).style.left)).toBe(left)

    await page.keyboard.press('Space')
    await expect.poll(() => live(page)).toContain('picked up')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => bar.evaluate((el) => (el as HTMLElement).style.left)).not.toBe(left)
    await page.keyboard.press('Escape')
    await expect.poll(() => live(page)).toContain('Move cancelled.')
    await expect.poll(() => bar.evaluate((el) => (el as HTMLElement).style.left)).toBe(left)

    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Space')
    await expect.poll(() => live(page)).toContain(' moved to ')
    expect(await live(page)).not.toContain('cells changed')
    await expect(page.locator('.sv-gantt-bar').first()).toBeFocused()
    // One Ctrl+Z takes the move back.
    await page.keyboard.press('Control+z')
    await expect.poll(() => page.locator('.sv-gantt-bar').first().evaluate((el) => (el as HTMLElement).style.left)).toBe(left)
  })

  test('a focused bar stands clear of the task table and the scale', async ({ page }) => {
    await open(page)
    await page.locator('.sv-gantt-scroll').evaluate((el) => (el.scrollLeft = el.scrollWidth))
    await firstBar(page)
    const clear = await page.evaluate(() => {
      const bar = document.activeElement!.getBoundingClientRect()
      const table = document.querySelector('.sv-gantt-table')!.getBoundingClientRect()
      const axis = document.querySelector('.sv-gantt-axis')!.getBoundingClientRect()
      return { left: bar.left >= table.right, top: bar.top >= axis.bottom }
    })
    expect(clear).toEqual({ left: true, top: true })
  })

  // Focus stays on the bar as it moves, and focus() does not scroll: the bar carried off the chart.
  test('a bar carried by the arrows stays in view', async ({ page }) => {
    await open(page)
    await firstBar(page)
    await page.keyboard.press('Space')
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Shift+ArrowRight')
      const seen = await page.evaluate(() => {
        const bar = document.activeElement!.getBoundingClientRect()
        const table = document.querySelector('.sv-gantt-table')!.getBoundingClientRect()
        const pane = document.querySelector('.sv-gantt-scroll')!.getBoundingClientRect()
        return bar.left >= table.right - 1 && bar.left < pane.right
      })
      expect(seen).toBe(true)
    }
    await page.keyboard.press('Escape')
  })

  test('Shift+F10 opens the menu with focus in it, arrows walk it, Escape goes back to the bar', async ({ page }) => {
    await open(page)
    const bar = await firstBar(page)
    await page.keyboard.press('Shift+F10')
    const menu = page.locator('.sv-gantt-menu')
    await expect(menu).toBeVisible()
    await expect.poll(() => menu.evaluate((m) => m.contains(document.activeElement))).toBe(true)
    const first = await page.evaluate(() => document.activeElement?.textContent?.trim())
    await page.keyboard.press('ArrowDown')
    await expect.poll(() => page.evaluate(() => document.activeElement?.textContent?.trim())).not.toBe(first)
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(bar).toBeFocused()
  })

  test('the task table reads as a table', async ({ page }) => {
    await open(page)
    const table = page.getByRole('table', { name: 'Records' })
    await expect(table).toBeVisible()
    expect(await table.getByRole('columnheader').count()).toBeGreaterThan(0)
    expect(await table.getByRole('row').count()).toBeGreaterThan(1)
    expect(await table.getByRole('cell').count()).toBeGreaterThan(1)
  })

  test('under right to left it opens on today, as it does otherwise', async ({ page }) => {
    await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => (document.documentElement.dir = 'rtl')))
    await open(page)
    await expect.poll(() => page.evaluate(() => {
      const today = document.querySelector('.sv-gantt-today')?.getBoundingClientRect()
      const box = document.querySelector('.sv-gantt-scroll')!.getBoundingClientRect()
      return !!today && today.left >= box.left && today.right <= box.right
    })).toBe(true)
  })

  test('axe finds nothing in the view, the Ember accent pair aside', async ({ page }) => {
    await open(page)
    await firstBar(page)
    const { violations } = await new AxeBuilder({ page }).include('.sv-gantt').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    const faults = violations.flatMap((v) => v.nodes.filter((n) => !isDecidedContrast(v.id, n)).map((n) => `${v.id}: ${n.target.join(' ')}`))
    expect(faults).toEqual([])
  })

  test('a bar keeps its shape in forced colors', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' })
    await open(page)
    const look = await page.locator('.sv-gantt-bar-task').first().evaluate((el) => {
      const s = getComputedStyle(el)
      return { border: parseFloat(s.borderTopWidth), bg: s.backgroundColor }
    })
    expect(look.border).toBeGreaterThan(0)
    expect(look.bg).not.toBe('rgba(0, 0, 0, 0)')
  })

  test('a drop on a Sunday stays on the Sunday: a record\'s date is its own', async ({ page }) => {
    await open(page)
    const bar = await firstBar(page)
    await page.keyboard.press('Space')
    // Day by day, working days included: with working time on, Saturday and Sunday were skipped.
    const seen: string[] = []
    for (let i = 0; i < 7; i += 1) {
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => live(page)).not.toBe(seen.at(-1) ?? '')
      seen.push(await live(page))
    }
    expect(new Set(seen).size).toBe(7)
    await page.keyboard.press('Escape')
    await expect(bar).toBeFocused()
  })
})
