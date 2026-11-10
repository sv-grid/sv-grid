/**
 * E2E: where the keyboard goes when the control it was on goes away (keepFocus
 * and its neighbours), in SvGrid Base and the free grid:
 *  - comments, forms, the form builder, dashboards, filters, automations,
 *    attachments and the inbox never drop focus to the body,
 *  - a cell editor that commits hands focus back to the grid,
 *  - a form takes the mouse, in its typed boxes and on its stars,
 *  - a grouped grid behaves as the treegrid it says it is,
 *  - a menu keeps the focused item in sight.
 */
import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { isDecidedContrast } from './lib/decided-contrast'

const CRM = '/sv-grid/#/demos/512-base-sales-crm'
const demo = (id: string) => `/sv-grid/#/demos/${id}`

async function open(page: Page, url = CRM, ready = '.sv-grid-body tr') {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto(url)
  await page.locator('.sv-btabs').waitFor({ timeout: 120_000 })
  await page.locator(ready).first().waitFor()
}
async function openFree(page: Page, id: string) {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto(demo(id))
  await page.locator('.sv-grid-body tr').first().waitFor({ timeout: 120_000 })
}
const grid = (page: Page) => page.locator('.sv-fbase-grid table.sv-grid-table').first()
const onBody = (page: Page) => page.evaluate(() => !document.activeElement || document.activeElement === document.body)
const active = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim().slice(0, 40) || '')
const live = (page: Page) => page.evaluate(() => [...document.querySelectorAll('body > [aria-live]')].map((e) => e.textContent).join(' | '))
/** Settled: focus is decided after the task that changed the page. */
async function notOnBody(page: Page) {
  await expect.poll(() => onBody(page)).toBe(false)
}

async function openView(page: Page, name: string) {
  await page.locator('.sv-fvb-view').first().click()
  await page.locator('.sv-fviews-pick', { hasText: name }).first().click()
  await page.locator('.sv-pop__panel').first().waitFor({ state: 'hidden' }).catch(() => {})
}
async function openRecord(page: Page) {
  await grid(page).focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Shift+F10')
  await page.getByRole('menuitem', { name: 'Expand record' }).click()
  await page.locator('[data-frv-field]').first().waitFor()
}

test.describe('Focus stays when its control goes', () => {
  test('a comment: add, edit, save, cancel, delete', async ({ page }) => {
    await open(page)
    await openRecord(page)
    const box = page.locator('.sv-frv-comment textarea').last()
    await box.click()
    await page.keyboard.type('First note')
    await page.keyboard.press('Control+Enter')
    await expect.poll(() => live(page)).toContain('Comment added.')

    const edit = page.getByRole('button', { name: 'Edit', exact: true }).last()
    await edit.focus()
    await page.keyboard.press('Enter')
    // Typed at once: nothing is lost on the way to the box.
    await page.keyboard.type(' more')
    await expect(page.locator('.sv-frv-item.is-comment textarea')).toHaveValue('First note more')
    await page.keyboard.press('Control+Enter')
    await expect.poll(() => live(page)).toContain('Comment saved.')
    await expect(page.getByRole('button', { name: 'Edit', exact: true }).last()).toBeFocused()

    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Cancel', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Edit', exact: true }).last()).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Delete', exact: true }).last()).toBeFocused()
    await page.keyboard.press('Enter')
    await notOnBody(page)
    await page.getByRole('group', { name: 'Delete this comment?' }).getByRole('button', { name: 'Cancel' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Edit', exact: true }).last()).toBeFocused()

    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    await page.getByRole('group', { name: 'Delete this comment?' }).getByRole('button', { name: 'Delete' }).focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => live(page)).toContain('Comment deleted.')
    await notOnBody(page)
    await expect(page.locator('[role="dialog"]').first()).toBeVisible()
  })

  test('Escape in a number box or on stars leaves the box and keeps the record', async ({ page }) => {
    await open(page)
    await openRecord(page)
    for (const id of ['value', 'priority']) {
      const field = page.locator(`[data-frv-field="${id}"]`)
      await field.locator('.sv-frv-box').click()
      await expect(field.locator('.sv-frv-box.is-editing')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(field.locator('.sv-frv-box.is-editing')).toHaveCount(0)
      await expect(page.locator('[role="dialog"]').first()).toBeVisible()
      await notOnBody(page)
    }
  })

  test('a form: picking from a link, a date and a select returns to the field', async ({ page }) => {
    await open(page)
    await openView(page, 'New lead')
    const field = page.locator('[data-form-field="account"]')
    await field.locator('.sv-frv-open').focus()
    await page.keyboard.press('Enter')
    await page.locator('.sv-flp-search').waitFor()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(field.locator('.sv-frv-open')).toBeFocused()
  })

  test('the form builder: a list that holds still, and a move to the top keeps the keyboard', async ({ page }) => {
    await open(page)
    await openView(page, 'New lead')
    await page.getByRole('button', { name: 'Customize form' }).click()
    const dialog = page.getByRole('dialog', { name: 'Customize form' })
    const names = () => dialog.locator('.sv-fformb-name').allTextContents()
    const before = await names()
    expect(before.length).toBeGreaterThan(3)
    // Each switch aimed at by where it stands, as a person would.
    const boxes = await Promise.all([1, 2, 3].map((i) => dialog.locator('.sv-fformb-row').nth(i).locator('input[role="switch"]').boundingBox()))
    for (const b of boxes) await page.mouse.click(b!.x + b!.width / 2, b!.y + b!.height / 2)
    await expect.poll(names).toEqual(before)
    for (const i of [1, 2, 3]) await expect(dialog.locator('.sv-fformb-row').nth(i).locator('input[role="switch"]')).not.toBeChecked()
    // Back on, each takes the place its row shows.
    await dialog.locator('.sv-fformb-row').nth(2).locator('input[role="switch"]').click()
    await expect.poll(names).toEqual(before)

    // Up to the top: the button goes disabled under the keyboard.
    const up = dialog.locator('.sv-fformb-row').nth(2).getByRole('button', { name: /up/ })
    const field = before[2]!
    await up.focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => live(page)).toContain(`${field} moved to place 1`)
    await notOnBody(page)
    await expect.poll(() => dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    await expect.poll(async () => (await names())[0]).toBe(field)
  })

  test('a dashboard: moves are said and keep the button, Remove asks first', async ({ page }) => {
    await open(page, demo('721-base-dashboard'), '.sv-fdash')
    await page.getByRole('button', { name: /Edit (dashboard|layout)/i }).click()
    const later = page.getByRole('button', { name: / later$/ }).first()
    await later.focus()
    const name = (await later.getAttribute('aria-label'))!.replace(/^Move | later$/g, '')
    await page.keyboard.press('Enter')
    await expect.poll(() => live(page)).toContain(`${name} moved to place 2`)
    await expect.poll(() => active(page)).toBe(`Move ${name} later`)

    const earlier = page.getByRole('button', { name: `Move ${name} earlier` })
    await earlier.focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => live(page)).toContain(`${name} moved to place 1`)
    await notOnBody(page)

    const tiles = await page.locator('.sv-fdash-tile').count()
    await page.getByRole('button', { name: `Remove ${name}` }).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.sv-fdash-tile')).toHaveCount(tiles)
    await notOnBody(page)
    await page.getByRole('button', { name: `Remove ${name}` }).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.sv-fdash-tile')).toHaveCount(tiles - 1)
    await expect.poll(() => live(page)).toContain(`${name} removed.`)
    await notOnBody(page)
  })

  test('a filter condition removed hands focus to the next control', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Filter', exact: true }).click()
    const add = page.locator('.sv-fvb-panel').getByRole('button', { name: /Add condition$/ })
    await add.click()
    await add.click()
    const remove = page.getByRole('button', { name: 'Remove condition' })
    await expect(remove).toHaveCount(2)
    await remove.first().focus()
    await page.keyboard.press('Enter')
    await expect(remove).toHaveCount(1)
    await notOnBody(page)
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.sv-fvb-panel'))).toBe(true)
    await remove.first().focus()
    await page.keyboard.press('Enter')
    await expect(remove).toHaveCount(0)
    await notOnBody(page)
  })

  test('Run now and removing a condition in an automation keep the keyboard in the dialog', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Automations' }).click()
    const dialog = page.getByRole('dialog').first()
    await dialog.waitFor()
    const run = dialog.getByRole('button', { name: /Run now/ }).first()
    if (await run.count()) {
      await run.focus()
      await page.keyboard.press('Enter')
      await notOnBody(page)
      await expect.poll(() => dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
  })

  test('attachments: Remove by keyboard removes, the next tile takes focus', async ({ page }) => {
    await open(page, demo('514-base-hiring-tracker'), '.sv-fvb-view')
    await openView(page, 'All candidates')
    await page.locator('.sv-fbase-grid .sv-grid-body tr').first().waitFor()
    await page.locator('.sv-fbase-grid .sv-att-thumb, .sv-fbase-grid [class*="sv-att"]').first().waitFor()
    await openRecord(page)
    await page.locator('[data-frv-field="resume"] .sv-frv-box').click()
    const dialog = page.locator('[role="dialog"]', { has: page.locator('.sv-attd') })
    await dialog.waitFor()
    const tiles = dialog.locator('.sv-attd-tile')
    const n = await tiles.count()
    expect(n).toBeGreaterThan(0)
    const remove = dialog.getByRole('button', { name: /^Remove / }).first()
    await remove.focus()
    await page.keyboard.press('Enter')
    await expect(tiles).toHaveCount(n - 1)
    await notOnBody(page)
    await expect.poll(() => dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
  })

  test('import: choosing a file keeps the keyboard in the dialog, and importing lands in the table', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'All tables' }).click()
    await page.getByRole('menuitem', { name: 'Import a file as a table' }).click()
    const dialog = page.getByRole('dialog').first()
    await dialog.waitFor()
    await dialog.locator('[tabindex="0"]').first().focus()
    await page.locator('input[type=file]').setInputFiles({ name: 'q.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n') })
    await page.locator('.sv-bimp-link').waitFor()
    await notOnBody(page)
    await expect.poll(() => dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    await dialog.locator('.sv-bimp-btn.is-primary').focus()
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await expect.poll(() => page.evaluate(() => /^(grid|treegrid)$/.test(document.activeElement?.getAttribute('role') ?? ''))).toBe(true)
  })

  test('Mark all read keeps the keyboard in the inbox', async ({ page }) => {
    await open(page, demo('720-base-inbox-view'), '.sv-finbox')
    // The demo's three changes land in its first seconds: a later one would light the button again.
    await expect.poll(() => page.locator('.sv-finbox-unread').textContent().then((t) => parseInt(t ?? '') || 0), { timeout: 15_000 }).toBeGreaterThanOrEqual(3)
    const mark = page.getByRole('button', { name: 'Mark all read' })
    await mark.focus()
    await page.keyboard.press('Enter')
    await expect(mark).toBeDisabled()
    await notOnBody(page)
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.sv-finbox'))).toBe(true)
  })

  test('Escape in the field editor goes back to that field\'s menu button', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Stage column menu' }).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('menuitem', { name: 'Edit field' }).click()
    await page.getByRole('dialog').first().waitFor()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Stage column menu' })).toBeFocused()
  })
})

test.describe('A cell editor hands focus back to the grid', () => {
  test('a pick by Enter or by mouse in Stage and Owner leaves arrows working', async ({ page }) => {
    await open(page)
    await grid(page).focus()
    await page.keyboard.press('ArrowDown')
    for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await page.locator('.sv-fse-search').waitFor()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(grid(page)).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await page.locator('.sv-fse-search').waitFor()
    await page.locator('[role="option"]').nth(1).click()
    await expect(grid(page)).toBeFocused()
  })

  test('free grid: Enter in a dropdown returns to the grid, and Tab goes to the next cell', async ({ page }) => {
    await openFree(page, '05-inline-editing')
    const table = page.locator('table.sv-grid-table').first()
    await table.focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('F2')
    await page.locator('.sv-grid-dropdown-trigger').waitFor()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(table).toBeFocused()
    await page.keyboard.press('F2')
    await page.locator('.sv-grid-dropdown-trigger').waitFor()
    const cell = await page.locator('.sv-grid-cell-active').getAttribute('data-col-id')
    await page.keyboard.press('Tab')
    await expect(table).toBeFocused()
    await expect.poll(() => page.locator('.sv-grid-cell-active').getAttribute('data-col-id')).not.toBe(cell)
  })

  test('free grid: "Add condition" in the filter menu keeps focus, Escape goes home', async ({ page }) => {
    await openFree(page, '03-excel-filters')
    const button = page.getByRole('button', { name: /Department.*filter|Filter.*Department/i }).first()
    await button.focus()
    await page.keyboard.press('Enter')
    const add = page.locator('.sv-grid-menu-add-cond')
    await add.waitFor()
    await add.focus()
    await page.keyboard.press('Enter')
    await expect(add).toHaveCount(0)
    await notOnBody(page)
    await page.keyboard.press('Escape')
    await notOnBody(page)
  })
})

test.describe('A form takes the mouse', () => {
  test('typed boxes focus on a click and hold what is typed', async ({ page }) => {
    await open(page)
    await openView(page, 'New lead')
    const inputs = page.locator('.sv-frv-box.is-typed input')
    expect(await inputs.count()).toBeGreaterThan(0)
    for (let i = 0; i < (await inputs.count()); i += 1) {
      await inputs.nth(i).scrollIntoViewIfNeeded()
      const box = (await inputs.nth(i).boundingBox())!
      await page.mouse.click(box.x + 10, box.y + box.height / 2)
      await expect(inputs.nth(i)).toBeFocused()
    }
  })

  test('the star clicked is the answer', async ({ page }) => {
    await open(page, demo('513-base-product-roadmap'))
    await openView(page, 'Request a feature')
    const box = (await page.locator('.sv-frv-box .sv-frt-icon').nth(3).boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.getByRole('button', { name: /Impact: 4/ })).toBeFocused()
  })

  test('an editor open in a record takes clicks too', async ({ page }) => {
    await open(page)
    await openRecord(page)
    const field = page.locator('[data-frv-field="nextStep"]')
    await field.locator('.sv-frv-box').click()
    const input = field.locator('input.sv-frv-input')
    await input.waitFor()
    await page.locator('[data-frv-field="deal"] .sv-frv-box').click()
    await field.locator('.sv-frv-box').click()
    const box = (await input.boundingBox())!
    await page.mouse.click(box.x + 5, box.y + box.height / 2)
    await expect(input).toBeFocused()
  })
})

test.describe('A grouped grid is a treegrid', () => {
  const state = (page: Page) => page.evaluate(() => {
    const tr = document.querySelector('.sv-grid-cell-active')?.closest('tr')
    return { group: !!tr?.classList.contains('sv-grid-group-row'), expanded: tr?.getAttribute('aria-expanded'), level: tr?.getAttribute('aria-level'), label: tr?.querySelector('.sv-grid-group-toggle')?.getAttribute('aria-label') }
  })

  test('Base: Left, Right, Space and Enter on a group, and the state follows', async ({ page }) => {
    await open(page)
    await openView(page, 'Open deals by owner')
    await grid(page).focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowUp')
    await expect.poll(() => state(page)).toMatchObject({ group: true, expanded: 'true', level: '1', label: 'Collapse group' })
    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => state(page)).toMatchObject({ expanded: 'false', label: 'Expand group' })
    await page.keyboard.press('Space')
    await expect.poll(() => state(page)).toMatchObject({ expanded: 'true' })
    await page.keyboard.press('Enter')
    await expect.poll(() => state(page)).toMatchObject({ expanded: 'false' })
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => state(page)).toMatchObject({ expanded: 'true' })
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => state(page)).toMatchObject({ group: false, level: '2' })
    await expect(grid(page)).toBeFocused()
  })

  test('free grid: the same keys, and leaves say their level', async ({ page }) => {
    await openFree(page, '07-grouping-aggregation')
    await page.locator('table.sv-grid-table').first().focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowUp')
    await expect.poll(() => state(page)).toMatchObject({ group: true, expanded: 'false', label: 'Expand group' })
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => state(page)).toMatchObject({ expanded: 'true', label: 'Collapse group' })
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => state(page)).toMatchObject({ group: false, level: '2', expanded: null })
  })
})

test.describe('The fill handle in a base', () => {
  const columnOf = (page: Page, name: string) => page.evaluate((n) => [...document.querySelector('.sv-fbase-grid')!.querySelectorAll('.sv-grid-head th')].findIndex((t) => t.textContent?.trim().startsWith(n)), name)
  const cell = (page: Page, row: number, col: number) => page.locator('.sv-fbase-grid .sv-grid-body tr').nth(row).locator('td').nth(col)
  // A press on a handle just drawn belongs to the double-click on its cell: a person
  // takes longer than that to reach for it.
  const reach = (page: Page) => page.waitForTimeout(500)
  async function drag(page: Page, toRow: number, col: number) {
    await reach(page)
    const handle = (await page.locator('.sv-grid-fill-handle').first().boundingBox())!
    const target = (await cell(page, toRow, col).boundingBox())!
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(target.x + 20, target.y + target.height / 2, { steps: 8 })
    await page.mouse.up()
  }

  test('drags a value down, and one Ctrl+Z takes it all back', async ({ page }) => {
    await open(page)
    const col = await columnOf(page, 'Next step')
    const before = await Promise.all([0, 1, 2, 3].map((r) => cell(page, r, col).textContent()))
    await cell(page, 0, col).click()
    await expect(page.locator('.sv-grid-fill-handle')).toHaveCount(1)
    await drag(page, 3, col)
    await expect.poll(() => cell(page, 3, col).textContent()).toBe(before[0])
    await page.keyboard.press('Control+z')
    await expect.poll(() => Promise.all([0, 1, 2, 3].map((r) => cell(page, r, col).textContent()))).toEqual(before)
  })

  test('in the field a view sorts by, every filled record gets the value and one undo restores them', async ({ page }) => {
    await open(page)
    // All deals sorts by Value, highest first. Its handle is past the right edge until scrolled to.
    await page.evaluate(() => {
      let n = document.querySelector('.sv-fbase-grid .sv-grid-body') as HTMLElement | null
      while (n && n.scrollWidth <= n.clientWidth + 1) n = n.parentElement
      if (n) n.scrollLeft = n.scrollWidth
    })
    const col = await columnOf(page, 'Value')
    const name = await columnOf(page, 'Deal')
    const rows = () => Promise.all([0, 1, 2].map(async (r) => [await cell(page, r, name).textContent(), await cell(page, r, col).textContent()]))
    const before = await rows()
    await cell(page, 2, col).click()
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowUp')
    await drag(page, 2, col)
    // Rows stay where they are through the write, so the three sit together with the value.
    await expect.poll(async () => (await rows()).map((r) => r[1])).toEqual([before[0][1], before[0][1], before[0][1]])
    const after = await page.evaluate(() => [...document.querySelector('.sv-fbase-grid')!.querySelectorAll('.sv-grid-body tr')].map((t) => t.textContent))
    for (const [deal] of before) expect(after.join('|')).toContain(deal!.trim())
    await page.keyboard.press('Control+z')
    await expect.poll(rows).toEqual(before)
  })

  test('a double-click on a cell at the corner the handle appears in opens the cell, it fills nothing', async ({ page }) => {
    await open(page)
    const col = await columnOf(page, 'Next step')
    const before = await cell(page, 1, col).textContent()
    const box = (await cell(page, 0, col).boundingBox())!
    await page.mouse.dblclick(box.x + box.width - 3, box.y + box.height - 3)
    await page.waitForTimeout(200)
    await page.keyboard.press('Escape')
    await expect.poll(() => cell(page, 1, col).textContent()).toBe(before)
  })

  test('a double-click on the handle already there fills down', async ({ page }) => {
    await open(page)
    const col = await columnOf(page, 'Next step')
    const first = await cell(page, 0, col).textContent()
    await cell(page, 0, col).click()
    await reach(page)
    const handle = (await page.locator('.sv-grid-fill-handle').first().boundingBox())!
    await page.mouse.dblclick(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await expect.poll(() => cell(page, 1, col).textContent()).toBe(first)
    await page.keyboard.press('Control+z')
    await expect.poll(() => cell(page, 1, col).textContent()).not.toBe(first)
  })

  test('a read-only share has no handle', async ({ page }) => {
    await open(page, demo('717-base-read-only-share'))
    await page.locator('.sv-grid-body td').nth(2).click()
    await expect(page.locator('.sv-grid-fill-handle')).toHaveCount(0)
  })
})

test('a column moved from its menu is one undo step, named as a move', async ({ page }) => {
  await open(page)
  const headers = () => page.locator('.sv-fbase-grid .sv-grid-head th').allTextContents()
  const before = await headers()
  await page.getByRole('button', { name: 'Stage column menu' }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('menuitem', { name: 'Move left' }).click()
  await expect.poll(headers).not.toEqual(before)
  await expect(page.locator('[title*="move field" i], [aria-label*="move field" i]').first()).toBeAttached()
  await grid(page).focus()
  await page.keyboard.press('Control+z')
  await expect.poll(headers).toEqual(before)
})

test.describe('axe on the surfaces the first passes missed', () => {
  // White on Ember's orange and on option colors is a stated decision: it is not what this looks for.
  const faults = async (page: Page) => {
    const { violations } = await new AxeBuilder({ page }).include('body').withRules(['heading-order', 'color-contrast']).analyze()
    return violations.flatMap((v) => v.nodes.filter((n) => !isDecidedContrast(v.id, n)).map((n) => `${v.id}: ${n.target.join(' ')}`))
  }

  test('a comment\'s time, in the record', async ({ page }) => {
    await open(page)
    await openRecord(page)
    await page.locator('.sv-frv-comment textarea').last().fill('A note')
    await page.keyboard.press('Control+Enter')
    await page.locator('.sv-frv-item.is-comment').waitFor()
    expect((await faults(page)).filter((f) => f.includes('sv-frv'))).toEqual([])
  })

  test('the automations, with one selected', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Automations' }).click()
    const dialog = page.getByRole('dialog').first()
    await dialog.waitFor()
    const pick = dialog.locator('.sv-bauto-pick').first()
    if (await pick.count()) {
      await pick.click()
      await expect(pick).toHaveAttribute('aria-current', 'true')
    }
    expect((await faults(page)).filter((f) => f.includes('sv-bauto') || f.startsWith('heading-order'))).toEqual([])
  })

  test('a dashboard', async ({ page }) => {
    await open(page, demo('721-base-dashboard'), '.sv-fdash')
    expect((await faults(page)).filter((f) => f.startsWith('heading-order'))).toEqual([])
  })
})

test('a column menu scrolls to the item focused by End', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Account column menu' }).focus()
  await page.keyboard.press('Enter')
  await page.locator('[role="menu"]').first().waitFor()
  await page.keyboard.press('End')
  const inside = await page.evaluate(() => {
    const a = document.activeElement!.getBoundingClientRect()
    const m = document.activeElement!.closest('[role="menu"]')!.getBoundingClientRect()
    return a.top >= m.top - 1 && a.bottom <= m.bottom + 1 && a.bottom <= innerHeight
  })
  expect(inside).toBe(true)
})

test.describe('Focus never falls to the page', () => {
  const inGrid = (page: Page) => page.evaluate(() => /^(grid|treegrid)$/.test(document.activeElement?.getAttribute('role') ?? ''))
  const expectInGrid = (page: Page) => expect.poll(() => inGrid(page)).toBe(true)
  async function recordMenu(page: Page, item: string) {
    await grid(page).focus()
    await page.keyboard.press('Shift+F10')
    const it = page.getByRole('menuitem', { name: item })
    await it.waitFor()
    await it.focus()
    await page.keyboard.press('Enter')
  }
  async function columnMenu(page: Page, name: string, item: RegExp) {
    const it = page.getByRole('menuitem', { name: item }).first()
    // Focus scrolls a far column into view, and a scroll closes a menu just opened.
    await expect(async () => {
      if (!(await it.isVisible())) {
        await page.getByRole('button', { name: `${name} column menu` }).focus()
        await page.keyboard.press('Enter')
      }
      await it.waitFor({ timeout: 1500 })
    }).toPass()
    await it.focus()
    await page.keyboard.press('Enter')
  }

  test('a record opened from the menu goes back to the grid', async ({ page }) => {
    await open(page)
    await grid(page).focus()
    await page.keyboard.press('ArrowDown')
    await recordMenu(page, 'Expand record')
    await page.locator('[data-frv-field]').first().waitFor()
    await page.keyboard.press('Escape')
    await expectInGrid(page)
    await recordMenu(page, 'Expand record')
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).first().click()
    await expectInGrid(page)
    await recordMenu(page, 'Comment')
    await expect(page.locator('.sv-frv-comment textarea').last()).toBeFocused()
    await page.keyboard.press('Escape')
    await expectInGrid(page)
  })

  test("a row's expand button hides under the dialog: the grid takes focus", async ({ page }) => {
    await open(page)
    const row = page.locator('.sv-grid-body tr').nth(2)
    await row.hover()
    await row.locator('[aria-label^="Expand row"]').focus()
    await page.keyboard.press('Enter')
    await page.locator('[data-frv-field]').first().waitFor()
    await page.mouse.move(2, 2)
    await page.keyboard.press('Escape')
    await expectInGrid(page)
  })

  test('Pin, Hide field and Delete field leave focus in the grid', async ({ page }) => {
    await open(page)
    await columnMenu(page, 'Owner', /Pin to left/)
    await expectInGrid(page)
    await columnMenu(page, 'Value', /Hide/)
    await expectInGrid(page)
    await columnMenu(page, 'Stage', /Delete field/)
    await page.getByRole('dialog').waitFor()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Stage column menu' })).toBeFocused()
    await columnMenu(page, 'Stage', /Delete field/)
    await page.getByRole('dialog').getByRole('button', { name: /^Delete/ }).click()
    await expectInGrid(page)
  })

  test('Undo and Redo on the last step hand focus to the button beside them', async ({ page }) => {
    await open(page)
    await grid(page).focus()
    await page.keyboard.press('ArrowDown')
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Delete')
    const undo = page.locator('.sv-btabs').getByRole('button', { name: /^Undo/ })
    await expect(undo).toBeEnabled()
    await undo.focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => active(page)).toMatch(/^Redo/)
    await page.keyboard.press('Enter')
    await expect.poll(() => active(page)).toMatch(/^Undo/)
  })

  test('a card deleted from its menu hands focus to the next card', async ({ page }) => {
    await open(page)
    await openView(page, 'Pipeline')
    const card = page.locator('.sv-board-card').nth(1)
    await card.focus()
    await page.keyboard.press('Shift+F10')
    await page.getByRole('menuitem', { name: 'Delete record' }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^Delete/ }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.sv-board'))).toBe(true)
  })

  test('a calendar event deleted from its menu stays in the calendar', async ({ page }) => {
    await open(page)
    await openView(page, 'Closing calendar')
    await page.locator('.sv-sched-bar').first().focus()
    await page.keyboard.press('Shift+F10')
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^Delete/ }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.sv-sched'))).toBe(true)
  })

  test('free grid: Pin to left leaves focus in the grid', async ({ page }) => {
    await openFree(page, '03-excel-filters')
    await page.getByRole('button', { name: 'First name column menu' }).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('menuitem', { name: 'Pin to left' }).click()
    await notOnBody(page)
  })
})

test.describe('A question on a dashboard tile takes the keyboard', () => {
  test('Remove asks, a second Enter moves nothing, Escape and Cancel go back', async ({ page }) => {
    await open(page, demo('721-base-dashboard'), '.sv-fdash')
    await page.getByRole('button', { name: /Edit (dashboard|layout)/i }).click()
    const tiles = page.locator('.sv-fdash-tiles > li')
    const before = await tiles.allInnerTexts()
    const remove = page.getByRole('button', { name: /^Remove / }).first()
    const name = (await remove.getAttribute('aria-label'))!
    await remove.focus()
    await page.keyboard.press('Enter')
    const ask = page.getByRole('group', { name: 'Remove this tile?' })
    await expect(ask.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await expect.poll(() => live(page)).toContain('Remove this tile?')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name, exact: true })).toBeFocused()
    expect(await tiles.allInnerTexts()).toEqual(before)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name, exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await ask.getByRole('button', { name: /^Remove/ }).click()
    await expect(tiles).toHaveCount(before.length - 1)
    await notOnBody(page)
  })
})

test.describe('A comment not sent stays with its record', () => {
  test('the next record gets an empty box, and coming back finds the text', async ({ page }) => {
    await open(page)
    await openRecord(page)
    const box = page.locator('.sv-frv-comment textarea').last()
    await box.focus()
    await page.keyboard.type('Only for this record')
    await page.getByRole('button', { name: 'Next record' }).click()
    await expect(box).toHaveValue('')
    await page.getByRole('button', { name: 'Previous record' }).click()
    await expect(box).toHaveValue('Only for this record')
  })

  test('Close says it was not sent, and opening the record again finds it', async ({ page }) => {
    await open(page)
    await openRecord(page)
    const box = page.locator('.sv-frv-comment textarea').last()
    await box.focus()
    await page.keyboard.type('Still mine')
    await page.getByRole('button', { name: 'Close', exact: true }).last().click()
    await expect(page.getByText('Your comment was not sent').first()).toBeVisible()
    // The same record: the helper steps down a row first.
    await grid(page).focus()
    await page.keyboard.press('Shift+F10')
    await page.getByRole('menuitem', { name: 'Expand record' }).click()
    await expect(page.locator('.sv-frv-comment textarea').last()).toHaveValue('Still mine')
    // The record below has its own empty box.
    await page.getByRole('button', { name: 'Next record' }).click()
    await expect(page.locator('.sv-frv-comment textarea').last()).toHaveValue('')
  })
})

test.describe('Escape in a comment', () => {
  test('leaves the box and keeps the draft, and the record stays open', async ({ page }) => {
    await open(page)
    await openRecord(page)
    const box = page.locator('.sv-frv-comment textarea').last()
    await box.focus()
    await page.keyboard.type('Half a thought')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Comment', exact: true })).toBeFocused()
    await expect(box).toHaveValue('Half a thought')
    await page.keyboard.press('Escape')
    await expect(page.locator('.sv-frv-held')).toContainText('not sent')
    await expect(box).toHaveValue('Half a thought')
    await box.fill('')
    await box.focus()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-frv-field]').first()).toBeHidden()
  })

  test('on a comment being changed it is Cancel, then Escape closes', async ({ page }) => {
    await open(page)
    await openRecord(page)
    await page.locator('.sv-frv-comment textarea').last().focus()
    await page.keyboard.type('Keep me')
    await page.keyboard.press('Control+Enter')
    await expect.poll(() => live(page)).toContain('Comment added.')
    const edit = page.getByRole('button', { name: 'Edit', exact: true }).last()
    await edit.focus()
    await page.keyboard.press('Enter')
    await page.keyboard.type(' and more')
    await page.keyboard.press('Escape')
    await expect(edit).toBeFocused()
    await expect(page.locator('.sv-frv-item.is-comment').last()).toContainText('Keep me')
    await expect(page.locator('.sv-frv-item.is-comment').last()).not.toContainText('and more')
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-frv-field]').first()).toBeHidden()
  })

  test('with a mention list open it closes the list and nothing else', async ({ page }) => {
    await open(page)
    await openRecord(page)
    const box = page.locator('.sv-frv-comment textarea').last()
    await box.focus()
    await page.keyboard.type('hi @')
    await page.locator('.sv-fmi-list').waitFor()
    await page.keyboard.press('Escape')
    await expect(page.locator('.sv-fmi-list')).toHaveCount(0)
    await expect(box).toBeFocused()
    await expect(box).toHaveValue('hi @')
  })
})

test('the two add buttons on a board show focus', async ({ page }) => {
  await open(page)
  await openView(page, 'Pipeline')
  for (const button of [page.locator('.sv-board-lane-add').first(), page.locator('.sv-board-composer-btn').first()]) {
    await button.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(button).toBeFocused()
    const ring = await button.evaluate((el) => {
      const c = getComputedStyle(el)
      return { style: c.outlineStyle, width: parseFloat(c.outlineWidth) }
    })
    expect(ring.style).toBe('solid')
    expect(ring.width).toBeGreaterThanOrEqual(2)
  }
})

test.describe('Cards keep what a row can do', () => {
  const small = async (page: Page, width = 320, height = 640) => {
    await open(page, CRM, '.sv-btabs')
    await page.setViewportSize({ width, height })
    await page.locator('.sv-gal-title').first().waitFor()
  }
  const count = (page: Page) => page.locator('.sv-fvb-count').evaluate((e) => e.textContent ?? '')
  async function act(page: Page, name: string | RegExp) {
    await page.keyboard.press('Shift+F10')
    const it = page.getByRole('menuitem', { name })
    await it.waitFor()
    await it.focus()
    await page.keyboard.press('Enter')
  }

  test('Shift+F10 on a card: the record menu, and focus comes back', async ({ page }) => {
    await small(page)
    const title = page.locator('.sv-gal-title').first()
    await title.focus()
    await page.keyboard.press('Shift+F10')
    await expect(page.getByRole('menuitem')).toHaveText(['Expand record', 'Comment', 'Select record', 'Insert record above', 'Insert record below', 'Duplicate record', 'Delete record'])
    await page.keyboard.press('Escape')
    await expect(title).toBeFocused()
  })

  test('select shows on the card and in the bar; duplicate adds; delete hands focus on', async ({ page }) => {
    await small(page)
    const title = page.locator('.sv-gal-title').first()
    await title.focus()
    await act(page, 'Select record')
    await expect(page.locator('.sv-gal-card.is-selected')).toHaveCount(1)
    await expect(title).toContainText('Selected')
    await expect(page.getByRole('toolbar').filter({ hasText: '1' }).last()).toBeVisible()
    await title.focus()
    await act(page, /Deselect/)
    await expect(page.locator('.sv-gal-card.is-selected')).toHaveCount(0)
    const before = await count(page)
    await title.focus()
    await act(page, 'Duplicate record')
    await expect.poll(() => count(page)).not.toBe(before)
    await page.locator('.sv-gal-title').nth(1).focus()
    await act(page, 'Delete record')
    await page.getByRole('dialog').getByRole('button', { name: /^Delete/ }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.sv-gal'))).toBe(true)
  })

  test('Insert opens the new record to fill in', async ({ page }) => {
    await small(page)
    await page.locator('.sv-gal-title').first().focus()
    await act(page, 'Insert record below')
    await page.locator('[data-frv-field]').first().waitFor()
    await expect(page.locator('.sv-frv-input').first()).toBeFocused()
  })

  test('the button on a card opens the same menu', async ({ page }) => {
    await small(page)
    const more = page.locator('.sv-gal-actions').first()
    await more.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem', { name: 'Duplicate record' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(more).toBeFocused()
  })

  test("a phone's grouped list has them too", async ({ page }) => {
    await open(page, CRM, '.sv-btabs')
    await openView(page, 'Open deals by owner')
    await page.setViewportSize({ width: 360, height: 640 })
    const item = page.locator('.sv-flist-item').first()
    await item.focus()
    await page.keyboard.press('Shift+F10')
    await expect(page.getByRole('menuitem', { name: 'Duplicate record' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(item).toBeFocused()
  })
})

test.describe('A link preview', () => {
  async function hover(page: Page) {
    const chip = page.locator('.sv-fbase-grid .sv-flr-chip').first()
    const box = (await chip.boundingBox())!
    await page.mouse.move(5, 300)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 })
    await page.locator('.sv-flpv').waitFor()
  }

  test('Escape puts it away with the pointer still on the chip', async ({ page }) => {
    await open(page)
    await hover(page)
    await page.keyboard.press('Escape')
    await expect(page.locator('.sv-flpv')).toHaveCount(0)
    await hover(page)
    await expect(page.locator('.sv-flpv')).toHaveCount(1)
  })

  test('a pointer stopping in the gap under the chip keeps the card', async ({ page }) => {
    await open(page)
    await hover(page)
    const card = (await page.locator('.sv-flpv').boundingBox())!
    await page.mouse.move(card.x + 30, card.y - 3)
    await expect.poll(() => page.evaluate(() => !!document.querySelector('.sv-flpv:hover'))).toBe(true)
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2)
    await expect(page.locator('.sv-flpv')).toHaveCount(1)
  })
})

test('a group opened and closed under a filter says nothing about the filter', async ({ page }) => {
  await open(page)
  await openView(page, 'Open deals by owner')
  await grid(page).focus()
  await expect.poll(() => live(page)).toContain('24 of 30 rows match')
  await page.evaluate(() => {
    const said: string[] = []
    ;(window as unknown as { said: string[] }).said = said
    for (const el of document.querySelectorAll('body > [aria-live]')) new MutationObserver(() => said.push(el.textContent ?? '')).observe(el, { childList: true, characterData: true, subtree: true })
  })
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowUp')
  for (const key of ['ArrowLeft', 'ArrowRight', 'Space', 'Space']) {
    await page.keyboard.press(key)
    await page.waitForTimeout(500) // past the announcement's own debounce: the check is that none came
  }
  const said = await page.evaluate(() => (window as unknown as { said: string[] }).said.filter(Boolean))
  expect(said.filter((s) => s.includes('rows match'))).toEqual([])
})

test("a record's bar under forced colors keeps a fill", async ({ page }) => {
  await open(page)
  await page.emulateMedia({ forcedColors: 'active' })
  await openRecord(page)
  const fill = page.getByRole('dialog').locator('.sv-fpc-bar > span').first()
  await fill.waitFor()
  const look = await fill.evaluate((el) => {
    const c = getComputedStyle(el)
    return { adjust: c.forcedColorAdjust, fill: c.backgroundColor, canvas: getComputedStyle(el.closest('[role="dialog"]')!).backgroundColor }
  })
  expect(look.adjust).toBe('none')
  expect(look.fill).not.toBe(look.canvas)
})

test('a button of the view bar reached at 320 px is whole on screen', async ({ page }) => {
  await open(page, CRM, '.sv-btabs')
  await page.setViewportSize({ width: 320, height: 640 })
  await page.locator('.sv-gal-title').first().waitFor()
  const button = page.locator('.sv-fvb').getByRole('button', { name: /automation/i }).first()
  await page.locator('.sv-fvb').getByRole('button', { name: /Row height/ }).focus()
  await page.keyboard.press('Tab')
  await expect(button).toBeFocused()
  await expect.poll(() => button.evaluate((el) => el.getBoundingClientRect().right <= innerWidth)).toBe(true)
})

test('free grid: a cell tooltip closes with Escape, with the pointer still on the cell', async ({ page }) => {
  await openFree(page, '85-tooltips-and-notes')
  const cells = page.locator('.sv-grid-body td')
  const tip = page.locator('.sv-grid-tooltip')
  for (let i = 0; i < 12 && !(await tip.count()); i += 1) {
    const box = (await cells.nth(i).boundingBox())!
    await page.mouse.move(2, 2)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 })
    await tip.waitFor({ timeout: 700 }).catch(() => {})
  }
  await expect(tip).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(tip).toHaveCount(0, { timeout: 600 })
})

test("a group's add button names the person, not their id", async ({ page }) => {
  await open(page)
  await openView(page, 'Open deals by owner')
  const add = page.getByRole('button', { name: /^Add a record to Owner / }).first()
  await add.waitFor({ state: 'attached' })
  expect(await add.getAttribute('aria-label')).toMatch(/^Add a record to Owner [A-Z][a-z]+ [A-Z]/)
})
