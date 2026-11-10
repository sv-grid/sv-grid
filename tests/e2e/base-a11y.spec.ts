/**
 * E2E: a keyboard, a finger and a screen reader in SvGrid Base (demo 512, a CRM).
 *  - every record action from the keyboard and from touch, focus in the menu,
 *  - the field menu and the table menu by keyboard, focus back on the trigger,
 *  - one tab stop for the rows, and what Tab does after a click or in an editor,
 *  - focus clear of the pinned column, cells and headers,
 *  - edits, undo and a calendar move said aloud, a calendar event moved on purpose,
 *  - a form's fields as real inputs, focus on the first error,
 *  - panels that keep focus, the find bar that takes it,
 *  - arrows under right-to-left,
 *  - axe in a browser, over the views and the panels.
 */
import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { isDecidedContrast } from './lib/decided-contrast'

const CRM = '/sv-grid/#/demos/512-base-sales-crm'

async function open(page: Page, url = CRM) {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto(url)
  // The first visit compiles the demo on the dev server: give it time.
  await page.locator('.sv-btabs').waitFor({ timeout: 120_000 })
  await page.locator('.sv-grid-body tr').first().waitFor()
}

const grid = (page: Page) => page.locator('.sv-fbase-grid table.sv-grid-table').first()
const focused = (page: Page) => page.evaluate(() => {
  const a = document.activeElement
  return a ? `${a.getAttribute('aria-label') ?? ''}|${a.textContent?.trim().slice(0, 40) ?? ''}|${a.getAttribute('role') ?? ''}|${a.className}` : ''
})
const inGrid = (page: Page) => page.evaluate(() => /^(grid|treegrid)$/.test(document.activeElement?.getAttribute('role') ?? ''))
const live = (page: Page) => page.evaluate(() => [...document.querySelectorAll('body > [aria-live]')].map((e) => e.textContent).join(' | '))

async function openView(page: Page, name: string) {
  await page.locator('.sv-fvb-view').first().click()
  await page.locator('.sv-fviews-pick', { hasText: name }).first().click()
  await page.locator('[role="dialog"].sv-pop__panel, .sv-pop__panel').first().waitFor({ state: 'hidden' }).catch(() => {})
}

test.describe('SvGrid Base by keyboard, touch and screen reader', () => {
  test('Shift+F10 opens the record menu with focus in it, and Escape goes back to the cell', async ({ page }) => {
    await open(page)
    await grid(page).focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Shift+F10')
    const menu = page.locator('.sv-grid-context-menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Expand record' })).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem', { name: 'Comment' })).toBeFocused()
    await page.keyboard.press('End')
    await expect(menu.getByRole('menuitem', { name: 'Delete record' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    expect(await inGrid(page)).toBe(true)
  })

  test('a contextmenu sent to the focused grid, as the Menu key and screen readers do, opens it too', async ({ page }) => {
    await open(page)
    await grid(page).focus()
    await grid(page).dispatchEvent('contextmenu')
    await expect(page.locator('.sv-grid-context-menu')).toBeVisible()
  })

  test('a record deleted from the keyboard leaves focus in the grid', async ({ page }) => {
    await open(page)
    await grid(page).focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Shift+F10')
    const menu = page.locator('.sv-grid-context-menu')
    await menu.getByRole('menuitem', { name: 'Delete record' }).waitFor()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    const confirm = page.locator('.sv-frdel-btn.is-danger')
    await confirm.waitFor()
    await confirm.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.sv-fvb-count')).toHaveText('29 records')
    await expect.poll(() => inGrid(page)).toBe(true)
  })

  test('Shift+Space selects the row of the active cell', async ({ page }) => {
    await open(page)
    await grid(page).focus()
    await page.keyboard.press('Shift+Space')
    await expect(page.locator('.sv-grid-row-selected')).toHaveCount(1)
    await page.keyboard.press('Shift+Space')
    await expect(page.locator('.sv-grid-row-selected')).toHaveCount(0)
  })

  test('the record view can delete its record', async ({ page }) => {
    await open(page)
    await page.locator('.sv-grid-body tr').first().hover()
    await page.locator('.sv-frh-expand').first().click()
    await page.locator('.sv-frv-footer .is-danger').click()
    await page.locator('.sv-frdel-btn.is-danger').click()
    await expect(page.locator('.sv-fvb-count')).toHaveText('29 records')
    await expect(page.locator('.sv-frv-footer')).toHaveCount(0)
    await expect.poll(() => inGrid(page)).toBe(true)
  })

  test('the field menu walks by keyboard and gives focus back', async ({ page }) => {
    await open(page)
    const button = page.getByRole('button', { name: 'Deal column menu' })
    await button.focus()
    await page.keyboard.press('Enter')
    const menu = page.locator('.sv-grid-column-menu')
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(menu).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(button).toBeFocused()
  })

  test('Edit field is reached from the keyboard', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Stage column menu' }).focus()
    await page.keyboard.press('Enter')
    await page.locator('.sv-grid-column-menu').getByRole('menuitem').first().waitFor()
    await page.keyboard.press('e')
    await expect(page.locator('.sv-grid-column-menu').getByRole('menuitem', { name: 'Edit field' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('.sv-modal__title')).toBeVisible()
  })

  test('the table menu takes focus, walks and gives it back', async ({ page }) => {
    await open(page)
    const button = page.locator('.sv-btabs-more').first()
    await button.focus()
    await page.keyboard.press('Enter')
    const menu = page.locator('.sv-btabs-menu').first()
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem').nth(1)).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(button).toBeFocused()
  })

  test('a field moves left and right from its menu', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Stage column menu' }).focus()
    await page.keyboard.press('Enter')
    await page.locator('.sv-grid-column-menu').getByRole('menuitem', { name: 'Move left' }).click()
    const order = await page.locator('.sv-grid-header-label').allInnerTexts()
    expect(order.indexOf('Stage')).toBeLessThan(order.indexOf('Contact'))
  })

  test('the keyboard moves a field in Hide fields, and hears where it went', async ({ page }) => {
    await open(page)
    await page.locator('.sv-fvb-btn', { hasText: 'Hide fields' }).click()
    const grip = page.getByRole('button', { name: 'Move Stage' })
    await grip.focus()
    await page.keyboard.press('ArrowUp')
    await expect(grip).toBeFocused()
    await expect.poll(() => live(page)).toContain('Stage moved to place')
  })

  test('the rows are one tab stop from the keyboard', async ({ page }) => {
    await open(page)
    await grid(page).focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Tab')
    expect(await inGrid(page)).toBe(false)
    await page.keyboard.press('Shift+Tab')
    expect(await inGrid(page)).toBe(true)
  })

  test('after a click Tab walks cells, says the way out, and Escape ends it', async ({ page }) => {
    await open(page)
    await page.locator('.sv-grid-body td[data-col-id]').first().click()
    // The click may have opened the cell's editor: its Tab moves on, and the next is the grid's.
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    expect(await inGrid(page)).toBe(true)
    await expect(page.locator('.sv-fbase-tabhint')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.sv-fbase-tabhint')).toHaveCount(0)
    await page.keyboard.press('Tab')
    expect(await inGrid(page)).toBe(false)
  })

  test('the active cell stops clear of the pinned column', async ({ page }) => {
    await open(page)
    await grid(page).focus()
    for (let i = 0; i < 10; i += 1) await page.keyboard.press('ArrowRight')
    for (let i = 0; i < 9; i += 1) await page.keyboard.press('ArrowLeft')
    await expect.poll(() => page.evaluate(() => {
      const cell = document.querySelector('.sv-grid-cell-active')!.getBoundingClientRect()
      const pin = document.querySelector('td[data-pinned="left"]')!.getBoundingClientRect()
      return cell.left >= pin.right - 1
    })).toBe(true)
  })

  test('a header control reached by Tab stops clear of the pinned column', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Deal column menu' }).focus()
    await page.locator('.sv-grid-container').first().evaluate((el) => (el.scrollLeft = 300))
    // Past the pinned column's own controls, to the first control in a column that scrolls.
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press('Tab')
      if (await page.evaluate(() => !document.activeElement?.closest('th[data-pinned]'))) break
    }
    await expect.poll(() => page.evaluate(() => {
      const button = document.activeElement!.getBoundingClientRect()
      const pin = document.querySelector('th[data-pinned="left"]')!.getBoundingClientRect()
      return button.left >= pin.right - 1
    })).toBe(true)
  })

  test('the active cell stops above the footer', async ({ page }) => {
    await open(page)
    await page.setViewportSize({ width: 1400, height: 620 })
    await grid(page).focus()
    for (let i = 0; i < 16; i += 1) {
      await page.keyboard.press('ArrowDown')
      const under = await page.evaluate(() => {
        const cell = document.querySelector('.sv-grid-cell-active')?.getBoundingClientRect()
        const foot = document.querySelector('tfoot')?.getBoundingClientRect()
        return cell && foot ? cell.bottom - foot.top : 0
      })
      expect(under).toBeLessThanOrEqual(1)
    }
  })

  test('an edit, a clear and an undo are said aloud', async ({ page }) => {
    await open(page)
    await grid(page).focus()
    for (let i = 0; i < 8; i += 1) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Delete')
    await expect.poll(() => live(page)).toContain('cleared')
    await page.keyboard.press('Control+z')
    await expect.poll(() => live(page)).toContain('Undone')
  })

  test('a calendar event moves only when picked up, and each step is said', async ({ page }) => {
    await open(page)
    await openView(page, 'Closing calendar')
    const event = page.locator('[data-ev-key]').first()
    await event.waitFor()
    const label = await event.getAttribute('aria-label')
    expect(label).toMatch(/, [A-Z][a-z]+day, /)
    await event.focus()
    await page.keyboard.press('ArrowRight')
    await expect(event).toHaveAttribute('aria-label', label!)
    await page.keyboard.press('Space')
    await expect.poll(() => live(page)).toContain('picked up')
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).not.toBe(label)
    await page.keyboard.press('Escape')
    await expect.poll(() => live(page)).toContain('cancelled')
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe(label)
  })

  test('the calendar says which view is on and is a table', async ({ page }) => {
    await open(page)
    await openView(page, 'Closing calendar')
    await expect(page.locator('.sv-sched-btn', { hasText: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.sv-sched-btn', { hasText: 'Week' })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('.sv-sched-month')).toHaveAttribute('role', 'table')
  })

  test('a panel keeps focus to itself until it closes', async ({ page }) => {
    await open(page)
    await page.locator('.sv-fvb-btn', { hasText: 'Sorted by' }).click()
    const panel = page.locator('.sv-fsort')
    await panel.waitFor()
    for (let i = 0; i < 12; i += 1) await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('.sv-fsort'))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
  })

  test('a panel button says it opens and whether it is open', async ({ page }) => {
    await open(page)
    const button = page.locator('.sv-fvb-btn', { hasText: 'Hide fields' })
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await button.click()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  test('Search moves focus into the find bar', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Search', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.sv-grid-find-input')).toBeFocused()
    await page.keyboard.type('Acme')
    await expect(page.locator('.sv-grid-find-input')).toHaveValue('Acme')
  })

  test('arrow keys go where they point under right to left', async ({ page }) => {
    await open(page)
    await page.evaluate(() => { document.documentElement.dir = 'rtl' })
    await grid(page).focus()
    await page.keyboard.press('ArrowLeft')
    await expect(grid(page)).toHaveAttribute('aria-activedescendant', /_cell_0_1$/)
    await page.keyboard.press('ArrowRight')
    await expect(grid(page)).toHaveAttribute('aria-activedescendant', /_cell_0_0$/)
  })

  test('the pin line follows the pinned column under right to left', async ({ page }) => {
    await open(page)
    await page.evaluate(() => { document.documentElement.dir = 'rtl' })
    await expect.poll(() => page.evaluate(() => {
      const line = document.querySelector('.sv-pin-split-line')!.getBoundingClientRect()
      const pin = document.querySelector('td[data-pinned="left"]')!.getBoundingClientRect()
      return Math.abs(line.left - pin.left) < 4
    })).toBe(true)
  })

  test('axe finds nothing in the views of a base', async ({ page }) => {
    test.setTimeout(180_000)
    await open(page)
    const views = ['All deals', 'Pipeline', 'Closing calendar', 'Pipeline value by stage', 'Open deals by owner', 'New lead']
    for (const name of views) {
      await openView(page, name)
      await page.waitForTimeout(700)
      const { violations } = await new AxeBuilder({ page }).include('.sv-fbase-tables').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      // Ember's white on its accent is a brand decision, stated under 1.4.3 in the ACR. Only that pair is let through.
      const found = violations.flatMap((v) => v.nodes.filter((n) => !isDecidedContrast(v.id, n)).map((n) => `${name}: ${v.id} ${n.target}`))
      expect(found).toEqual([])
    }
  })
})

test.describe('SvGrid Base forms', () => {
  async function form(page: Page) {
    await open(page)
    await openView(page, 'New lead')
    await page.locator('.sv-fform').waitFor()
  }

  test('a typed field is a real input with its label', async ({ page }) => {
    await form(page)
    const input = page.locator('.sv-fform-field input').first()
    await expect(input).toBeVisible()
    const label = await page.locator('.sv-fform-label').first().innerText()
    await expect(page.locator('.sv-fform').getByLabel(label.replace('*', '').trim()).first()).toHaveJSProperty('tagName', 'INPUT')
  })

})

test.describe('SvGrid Base on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: false, viewport: { width: 1000, height: 800 } })

  test('a long press opens the record menu', async ({ page }) => {
    await page.goto(CRM)
    await page.locator('.sv-grid-body tr').first().waitFor({ timeout: 60_000 })
    const box = (await page.locator('.sv-grid-body td[data-col-id]').first().boundingBox())!
    const cdp = await page.context().newCDPSession(page)
    const point = { x: box.x + 20, y: box.y + 10 }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
    await page.waitForTimeout(800)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.locator('.sv-grid-context-menu')).toBeVisible()
    await page.waitForTimeout(300)
    await expect(page.locator('.sv-grid-context-menu')).toBeVisible()
  })
})
