/**
 * E2E: the keyboard paths of SvGrid Base, with real keys, in every list shape:
 *  - Escape on a keyboard move writes nothing and leaves focus on the card or
 *    the event: a board on rows in the page, a board read from a server, a
 *    calendar across the edge of its view,
 *  - a list takes Tab once and walks by arrows, held, grouped, read from a
 *    server and on a phone; Enter on a row's button opens its menu; a selected
 *    row shows it,
 *  - the selection bar, a form and a dashboard tile never drop focus to the body.
 */
import { expect, test, type Page } from '@playwright/test'

const CRM = '/sv-grid/#/demos/512-base-sales-crm'
const LIST = '/sv-grid/#/demos/719-base-list-view'
const DASH = '/sv-grid/#/demos/721-base-dashboard'
const MILLION = '/sv-grid/#/demos/723-base-million-orders'
const SCHEDULER = '/sv-grid/#/demos/46-scheduler'
const HIRING = '/sv-grid/#/demos/514-base-hiring-tracker'

test.describe.configure({ timeout: 150_000 })

async function open(page: Page, url: string, size = { width: 1400, height: 900 }) {
  await page.setViewportSize(size)
  await page.goto(url)
  await page.locator('.sv-btabs').waitFor({ timeout: 120_000 })
}
async function openView(page: Page, name: string) {
  await page.locator('.sv-fvb-view').first().click()
  await page.locator('.sv-fviews-pick', { hasText: name }).first().click()
  await page.locator('.sv-pop__panel').first().waitFor({ state: 'hidden' }).catch(() => {})
}
const onBody = (page: Page) => page.evaluate(() => !document.activeElement || document.activeElement === document.body)
const said = (page: Page) => page.evaluate(() => [...document.querySelectorAll('body > [aria-live]')].map((e) => e.textContent).join(' | '))
const laneOf = (page: Page, title: string) =>
  page.evaluate((t) => [...document.querySelectorAll('.sv-board-card')].find((c) => (c as HTMLElement).innerText.startsWith(t))?.closest('.sv-board-lane')?.querySelector('.sv-board-lane-title')?.textContent?.trim(), title)
const cardName = async (page: Page, n = 0) => (await page.locator('.sv-board-card:not(.is-loading)').nth(n).innerText()).split('\n')[0]!

test.describe('Escape on a keyboard board move', () => {
  test('rows in the page: nothing is written, and focus stays on the card', async ({ page }) => {
    await open(page, CRM)
    await openView(page, 'Pipeline')
    const card = page.locator('.sv-board-card').first()
    await card.waitFor()
    const name = await cardName(page)
    const from = await laneOf(page, name)
    await card.focus()
    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => laneOf(page, name)).not.toBe(from)
    await page.keyboard.press('Escape')
    await expect.poll(() => laneOf(page, name)).toBe(from)
    await expect(page.locator('.sv-board-card:focus')).toContainText(name)
    // The record agrees with the board.
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-frv-field="stage"]')).toContainText(from!)
    await page.keyboard.press('Escape')
    await expect(page.locator('.sv-board-card:focus')).toContainText(name)
    // And so does a view drawn again.
    await openView(page, 'All deals')
    await openView(page, 'Pipeline')
    await page.locator('.sv-board-card').first().waitFor()
    expect(await laneOf(page, name)).toBe(from)
  })

  test('the drop is one write and one Undo, however many lanes it crossed', async ({ page }) => {
    await open(page, CRM)
    await openView(page, 'Pipeline')
    const card = page.locator('.sv-board-card').first()
    await card.waitFor()
    const name = await cardName(page)
    const from = await laneOf(page, name)
    await card.focus()
    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.sv-board-card:focus')).toContainText(name)
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.sv-board-card:focus')).toContainText(name)
    await page.keyboard.press('Space')
    await expect(page.locator('.sv-board-sr')).toContainText('Dropped')
    const to = await laneOf(page, name)
    expect(to).not.toBe(from)
    await expect(page.locator('.sv-board-card:focus')).toContainText(name)
    await page.keyboard.press('Control+z')
    await expect.poll(() => laneOf(page, name)).toBe(from)
    // Focus goes back with the card, not to the card that took its place.
    await expect(page.locator('.sv-board-card:focus')).toContainText(name)
  })

  test('Tab away puts the card back', async ({ page }) => {
    await open(page, CRM)
    await openView(page, 'Pipeline')
    const card = page.locator('.sv-board-card').first()
    await card.waitFor()
    const name = await cardName(page)
    const from = await laneOf(page, name)
    await card.focus()
    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => laneOf(page, name)).not.toBe(from)
    await page.keyboard.press('Tab')
    await expect.poll(() => laneOf(page, name)).toBe(from)
    expect(await onBody(page)).toBe(false)
  })

  test('a board read from a server: the card waits for the drop, Escape writes nothing', async ({ page }) => {
    await open(page, MILLION)
    await openView(page, 'Board')
    const card = page.locator('.sv-board-card:not(.is-loading)').first()
    await card.waitFor({ timeout: 30_000 })
    const counts = () => page.locator('.sv-board-lane-count').allInnerTexts()
    await expect.poll(async () => (await counts()).join()).toMatch(/\d/)
    const before = await counts()
    const name = await cardName(page)
    const from = await laneOf(page, name)
    await card.focus()
    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.sv-board-drop-marker')).toHaveCount(1)
    expect(await laneOf(page, name)).toBe(from)
    await page.keyboard.press('Escape')
    await expect(page.locator('.sv-board-drop-marker')).toHaveCount(0)
    await expect(page.locator('.sv-board-card:focus')).toContainText(name)
    expect(await counts()).toEqual(before)
    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Space')
    await expect.poll(() => laneOf(page, name)).not.toBe(from)
    await expect(page.locator('.sv-board-card:focus')).toContainText(name)
    await page.keyboard.press('Control+z')
    await expect.poll(() => laneOf(page, name), { timeout: 30_000 }).toBe(from)
    await expect(page.locator('.sv-board-card:focus')).toContainText(name, { timeout: 15_000 })
  })
})

test.describe('Escape on a calendar across the edge of its view', () => {
  const event = (page: Page) => page.locator('.sv-sched-event[aria-label^="Annual check"]').first()
  const title = (page: Page) => page.locator('.sv-sched-title').first().innerText()

  test('the view goes with the event, and Escape brings both back with focus on it', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto(SCHEDULER)
    await event(page).waitFor({ timeout: 120_000 })
    const day = await title(page)
    const place = await event(page).getAttribute('aria-label')
    await event(page).focus()
    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => title(page)).not.toBe(day)
    await expect(page.locator('.sv-sched-event:focus')).toHaveAttribute('aria-label', /^Annual check/)
    await expect(page.locator('.sv-sched-event:focus')).not.toHaveAttribute('aria-label', place!)
    await page.keyboard.press('Escape')
    await expect.poll(() => title(page)).toBe(day)
    await expect(page.locator('.sv-sched-event:focus')).toHaveAttribute('aria-label', place!)
    expect(await said(page)).toContain('Move cancelled')
  })

  for (const [name, url, viewName] of [['rows in the page', CRM, 'Closing calendar'], ['read from a server', MILLION, 'Calendar']] as const) {
    test(`a base's week, ${name}: Escape past the edge brings the week and the event back`, async ({ page }) => {
      await open(page, url)
      await openView(page, viewName)
      await page.locator('.sv-sched').first().waitFor({ timeout: 30_000 })
      await page.getByRole('button', { name: 'Week', exact: true }).click()
      const events = page.locator('.sv-sched-event, .sv-sched-bar')
      for (let i = 0; i < 12 && !(await events.count()); i += 1) {
        await page.getByRole('button', { name: 'Next', exact: true }).first().click()
        await page.waitForTimeout(400)
      }
      await events.first().waitFor({ timeout: 30_000 })
      const week = await title(page)
      const place = (await events.first().getAttribute('aria-label'))!
      await events.first().focus()
      await page.keyboard.press('Space')
      for (let i = 0; i < 7 && (await title(page)) === week; i += 1) {
        await page.keyboard.press('ArrowRight')
        await expect(page.locator('[data-carried]:focus').first()).toBeVisible()
      }
      expect(await title(page)).not.toBe(week)
      await page.keyboard.press('Escape')
      await expect.poll(() => title(page)).toBe(week)
      await expect(page.locator(':focus')).toHaveAttribute('aria-label', place, { timeout: 15_000 })
      await expect(page.locator('[data-carried]')).toHaveCount(0)
    })
  }

  // A month drawn in five weeks: the sixth week of the six the view reads is
  // not on screen, so a carry into it used to leave the event where nobody
  // could see it, focus went to another record, and Space picked that one up.
  // In a zone whose clocks change in late October, a week carried over that
  // day used to be 7 x 24 hours and land on the evening before.
  test.describe('in a zone with summer time', () => {
    test.use({ timezoneId: 'Europe/Sofia' })
    for (const [name, url, viewName] of [['rows in the page', CRM, 'Closing calendar'], ['read from a server', MILLION, 'Calendar']] as const) {
      test(`a base's month of five weeks, ${name}: the event stays in sight and in hand to the drop`, async ({ page }) => {
        await open(page, url)
        await openView(page, viewName)
        await page.locator('.sv-sched-month').first().waitFor({ timeout: 30_000 })
        const weeks = page.locator('.sv-sched-week')
        const lastBar = () => weeks.last().locator('.sv-sched-bar').first()
        // A month of five weeks with an event in its last week, searched from the one shown.
        let found = false
        // A server sends a month's events after the month is drawn.
        const loaded = () => page.locator('.sv-sched-month .sv-sched-bar').first().waitFor({ timeout: url === MILLION ? 30_000 : 1_000 }).catch(() => {})
        for (const dir of ['Previous', 'Next'] as const) {
          for (let i = 0; i < 14 && !found; i += 1) {
            await loaded()
            found = (await weeks.count()) === 5 && (await lastBar().count()) > 0
            if (!found) {
              await page.getByRole('button', { name: dir, exact: true }).first().click()
              await page.waitForTimeout(300)
            }
          }
          if (found) break
        }
        expect(found).toBe(true)
        const month = await title(page)
        const label = (await lastBar().getAttribute('aria-label'))!
        const what = label.split(', ')[0]!
        await lastBar().focus()
        await page.keyboard.press('Space')
        await page.keyboard.press('ArrowDown')
        // The view goes with the event, and focus stays on it: not on another record.
        await expect.poll(() => title(page)).not.toBe(month)
        const carriedBar = page.locator('[data-carried]')
        await expect(carriedBar).toBeFocused({ timeout: 15_000 })
        await expect(carriedBar).toHaveAttribute('aria-label', new RegExp(`^${what.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},`))
        const place = (await carriedBar.getAttribute('aria-label'))!
        // A week down is the same weekday.
        expect(place.split(', ')[1]).toBe(label.split(', ')[1])
        // Space puts this event down, and does not pick another one up.
        await page.keyboard.press('Space')
        await expect(page.locator('[data-carried]')).toHaveCount(0)
        await expect.poll(() => said(page)).toContain(`${what} moved to`)
        await expect(page.locator(':focus')).toHaveAttribute('aria-label', place, { timeout: 15_000 })
        if (url === CRM) {
          // The record holds the date the screen shows.
          const day = place.split(', ')[2]!
          await page.keyboard.press('Enter')
          await expect(page.locator('[data-frv-field="close"]')).toContainText(day)
        }
      })
    }
  })
})

test.describe('A list and the keyboard', () => {
  test('held: one Tab in, arrows walk records, Tab reaches the row button, Enter on it opens the menu', async ({ page }) => {
    await open(page, LIST)
    await openView(page, 'Planned')
    const first = page.locator('.sv-flist-item').first()
    await first.waitFor()
    await expect(page.locator('.sv-flist-item[tabindex="0"]')).toHaveCount(1)
    await first.focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('.sv-flist-item').nth(1)).toBeFocused()
    await page.keyboard.press('Tab')
    const actions = page.locator('.sv-flist-actions').nth(1)
    await expect(actions).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem', { name: 'Duplicate record' })).toBeVisible()
    await expect(page.locator('[data-frv-field]')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(actions).toBeFocused()
  })

  test('a phone: a grouped list, Enter on the row button opens the menu', async ({ page }) => {
    await open(page, CRM)
    await openView(page, 'Open deals by owner')
    await page.setViewportSize({ width: 360, height: 640 })
    const actions = page.locator('.sv-flist-actions').first()
    await actions.waitFor()
    // A row is one button: a chip in it is text, with a link's look.
    await expect(page.locator('.sv-flist-item .sv-flr-chip').first()).toBeVisible()
    await expect(page.locator('.sv-flist-item button, .sv-flist-item a')).toHaveCount(0)
    await actions.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem', { name: 'Duplicate record' })).toBeVisible()
    // The Menu key says contextmenu once focus is in the menu: the browser's own must not open over it.
    const prevented = await page.evaluate(() => !(document.activeElement ?? document.body).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))
    expect(prevented).toBe(true)
    await expect(page.locator('[data-frv-field]')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(actions).toBeFocused()
  })

  test('read from a server: Tab lands on the first record, arrows walk records, its button comes next', async ({ page }) => {
    await open(page, MILLION)
    await openView(page, 'List')
    const item = page.locator('.sv-flist-item')
    await item.first().waitFor({ timeout: 30_000 })
    await expect(page.locator('.sv-flist-item[tabindex="0"]')).toHaveCount(1)
    await page.locator('.sv-fvb-btn').last().focus()
    // Whatever stands between the view bar and the list, the list is one stop and a record is it.
    let found = false
    for (let i = 0; i < 6 && !found; i += 1) {
      await page.keyboard.press('Tab')
      found = await page.evaluate(() => !!document.activeElement?.classList.contains('sv-flist-item'))
      expect(await page.evaluate(() => !!document.activeElement?.classList.contains('sv-fvlist'))).toBe(false)
    }
    expect(found).toBe(true)
    await expect(item.first()).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(item.nth(1)).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.locator('.sv-flist-actions').nth(1)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Shift+Tab')
    await expect(item.nth(1)).toBeFocused()
    await page.keyboard.press('End')
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[data-place]')?.getAttribute('data-place'))).toBe('999999')
    await page.keyboard.press('Home')
    await expect(item.first()).toBeFocused()
  })

  test('grouped on a server: one stop, arrows skip the row buttons, Right and Left open and fold', async ({ page }) => {
    await open(page, MILLION)
    await openView(page, 'List by region')
    const heads = page.locator('[data-head] .sv-flist-ghead')
    await heads.first().waitFor({ timeout: 30_000 })
    const stops = () => page.locator('.sv-fglist [tabindex="0"]').count()
    await expect.poll(stops).toBe(1)
    await heads.first().focus()
    await page.keyboard.press('ArrowRight')
    await expect(heads.first()).toHaveAttribute('aria-expanded', 'true')
    await expect(heads.first()).toBeFocused()
    await page.locator('[data-row] .sv-flist-item').first().waitFor({ timeout: 30_000 })
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press('ArrowDown')
      await expect(page.locator('.sv-flist-item:focus')).toHaveCount(1)
    }
    await expect(page.locator('.sv-flist-item').nth(2)).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(heads.first()).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(heads.first()).toHaveAttribute('aria-expanded', 'false')
    await expect(heads.first()).toBeFocused()
  })

  test('held and grouped: one stop on the first header, and Enter on a record opens it', async ({ page }) => {
    await open(page, LIST)
    const head = page.locator('.sv-flist-ghead').first()
    await head.waitFor()
    await expect(page.locator('.sv-flist [tabindex="0"]')).toHaveCount(1)
    await head.focus()
    await page.keyboard.press('ArrowDown')
    const item = page.locator('.sv-flist-item').first()
    await expect(item).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-frv-field]').first()).toBeVisible()
  })

  // Selected is not focused: the ring is focus, and a selected row has a fill and
  // a tick that the row in focus has not, so the rows Delete will take can be told
  // from the one the keys are on.
  const look = (el: Element) => {
    const s = getComputedStyle(el)
    return { fill: s.backgroundColor, ring: s.outlineStyle, tick: (el.querySelector('.sv-flist-title svg')?.getBoundingClientRect().width ?? 0) > 0 }
  }
  test('a selected row shows it in a fill and a tick, not in the focus ring, and says so', async ({ page }) => {
    await open(page, LIST)
    const row = page.locator('.sv-flist-item').nth(1)
    await row.waitFor()
    const plain = await page.locator('.sv-flist-item').nth(3).evaluate(look)
    await row.focus()
    await page.keyboard.press('Shift+F10')
    await page.getByRole('menuitem', { name: 'Select record', exact: true }).click()
    await expect(row).toHaveClass(/is-selected/)
    await expect(row).toContainText('Selected')
    const focused = page.locator('.sv-flist-item').nth(3)
    // The keys move focus there: the ring is for focus the keys moved. Shift+Tab from the
    // row's button brings the keyboard in; WebKit gives no ring to focus a script placed.
    await page.locator('.sv-flist-actions').nth(1).focus()
    await page.keyboard.press('Shift+Tab')
    await expect(row).toBeFocused()
    for (let i = 0; i < 6 && !(await focused.evaluate((el) => el === document.activeElement)); i += 1) await page.keyboard.press('ArrowDown')
    await expect(focused).toBeFocused()
    await expect(focused).not.toHaveClass(/is-selected/)
    await page.mouse.move(0, 0)
    const sel = await row.evaluate(look)
    const foc = await focused.evaluate(look)
    expect(sel.tick).toBe(true)
    expect(foc.tick).toBe(false)
    expect(sel.fill).not.toBe(plain.fill)
    expect(foc.fill).toBe(plain.fill)
    // The ring is the focused row's alone.
    expect(sel.ring).toBe('none')
    expect(foc.ring).toBe('solid')
  })

  test('a selected gallery card shows it in a fill and a tick, not in the focus ring', async ({ page }) => {
    await open(page, HIRING)
    await openView(page, 'Faces')
    const titles = page.locator('.sv-gal-title')
    await titles.nth(1).waitFor()
    const card = (n: number) => page.locator('.sv-gal-card').filter({ has: page.locator('.sv-gal-title') }).nth(n)
    const plain = await card(2).evaluate((el) => getComputedStyle(el).backgroundColor)
    await titles.nth(1).focus()
    await page.keyboard.press('Shift+F10')
    await page.getByRole('menuitem', { name: 'Select record', exact: true }).click()
    await expect(card(1)).toHaveClass(/is-selected/)
    // Tab to the next card's title: the ring is for focus the keys moved.
    await titles.nth(1).focus()
    for (let i = 0; i < 4 && !(await titles.nth(2).evaluate((el) => el === document.activeElement)); i += 1) await page.keyboard.press('Tab')
    await expect(titles.nth(2)).toBeFocused()
    await page.mouse.move(0, 0)
    await expect(card(1).locator('.sv-gal-title svg')).toBeVisible()
    await expect(card(2).locator('.sv-gal-title svg')).toHaveCount(0)
    expect(await card(1).evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(plain)
    expect(await card(1).evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none')
    expect(await card(2).evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid')
  })
})

test.describe('The selection bar', () => {
  async function select(page: Page, shape: 'grid' | 'list' | 'gallery' | 'phone') {
    if (shape === 'grid') {
      await open(page, CRM)
      const cell = page.locator('.sv-fbase-grid tbody td[role="gridcell"]').first()
      await cell.waitFor()
      await cell.click()
      await page.keyboard.press('Shift+F10')
    } else {
      await open(page, shape === 'list' ? LIST : shape === 'phone' ? CRM : HIRING, shape === 'phone' ? { width: 360, height: 640 } : undefined)
      if (shape === 'gallery') await openView(page, 'Faces')
      const item = page.locator(shape === 'list' ? '.sv-flist-item' : '.sv-gal-title').first()
      await item.waitFor()
      await item.focus()
      await page.keyboard.press('Shift+F10')
    }
    await page.getByRole('menuitem', { name: 'Select record', exact: true }).click()
    await page.locator('.sv-selbar:visible').waitFor()
  }
  const bar = (page: Page) => page.locator('.sv-selbar:visible')
  const del = (page: Page) => bar(page).locator('[data-action="deleteRows"]')
  /** Focus is back among the records, so the next Tab goes on from there and not from the top of the page. */
  async function kept(page: Page) {
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.sv-flist, .sv-gal, table.sv-grid-table'))).toBe(true)
  }

  for (const shape of ['grid', 'list', 'gallery', 'phone'] as const) {
    test(`${shape}: Escape on the question and Cancel go back to Delete`, async ({ page }) => {
      await select(page, shape)
      await del(page).focus()
      await page.keyboard.press('Enter')
      await expect(bar(page).getByRole('alert')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(del(page)).toBeFocused()
      await page.keyboard.press('Enter')
      await bar(page).getByRole('button', { name: 'Cancel' }).focus()
      await page.keyboard.press('Enter')
      await expect(del(page)).toBeFocused()
    })

    test(`${shape}: Clear keeps focus among the records`, async ({ page }) => {
      await select(page, shape)
      await bar(page).locator('.sv-selbar-clear').focus()
      await page.keyboard.press('Enter')
      await expect(bar(page)).toHaveCount(0)
      await kept(page)
    })

    test(`${shape}: Escape on the bar keeps focus among the records`, async ({ page }) => {
      await select(page, shape)
      await del(page).focus()
      await page.keyboard.press('Escape')
      await expect(bar(page)).toHaveCount(0)
      await kept(page)
    })

    test(`${shape}: a confirmed Delete keeps focus among the records`, async ({ page }) => {
      await select(page, shape)
      await del(page).focus()
      await page.keyboard.press('Enter')
      await page.keyboard.press('Enter')
      await expect(bar(page)).toHaveCount(0)
      await kept(page)
    })
  }

  test('list: a confirmed Delete puts focus on the next record, not on its group', async ({ page }) => {
    await select(page, 'list')
    const next = (await page.locator('.sv-flist-item').nth(1).locator('.sv-flist-title').innerText()).trim()
    await del(page).focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await expect(bar(page)).toHaveCount(0)
    await expect(page.locator('.sv-flist-item:focus .sv-flist-title')).toHaveText(next)
  })

  // The last record of a group: focus used to go up to that group's header.
  for (const how of ['the selection bar', 'the record menu'] as const) {
    test(`list: deleting the last record of a group by ${how} puts focus on the record after it`, async ({ page }) => {
      await open(page, LIST)
      const first = page.locator('.sv-flist-group').first()
      await first.locator('.sv-flist-item').first().waitFor()
      const last = first.locator('.sv-flist-item').last()
      const gone = (await last.locator('.sv-flist-title').innerText()).trim()
      const after = (await page.locator('.sv-flist-group').nth(1).locator('.sv-flist-item').first().locator('.sv-flist-title').innerText()).trim()
      await last.focus()
      await page.keyboard.press('Shift+F10')
      if (how === 'the selection bar') {
        await page.getByRole('menuitem', { name: 'Select record', exact: true }).click()
        await bar(page).waitFor()
        await del(page).focus()
        await page.keyboard.press('Enter')
        await page.keyboard.press('Enter')
        await expect(bar(page)).toHaveCount(0)
      } else {
        await page.getByRole('menuitem', { name: /^Delete record/ }).first().focus()
        await page.keyboard.press('Enter')
        await page.getByRole('button', { name: /^Delete/ }).last().focus()
        await page.keyboard.press('Enter')
      }
      await expect(page.locator('.sv-flist-item', { hasText: gone })).toHaveCount(0)
      await expect(page.locator('.sv-flist-item:focus .sv-flist-title')).toHaveText(after)
    })
  }

  test('list: deleting the very last record puts focus on the record before it', async ({ page }) => {
    await open(page, LIST)
    const items = page.locator('.sv-flist-item')
    await items.first().waitFor()
    const last = items.last()
    const before = (await items.nth((await items.count()) - 2).locator('.sv-flist-title').innerText()).trim()
    await last.focus()
    await page.keyboard.press('Shift+F10')
    await page.getByRole('menuitem', { name: 'Select record', exact: true }).click()
    await bar(page).waitFor()
    await del(page).focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await expect(bar(page)).toHaveCount(0)
    await expect(page.locator('.sv-flist-item:focus .sv-flist-title')).toHaveText(before)
  })

  test('list read from a server: Clear and Escape go back to the record', async ({ page }) => {
    await open(page, MILLION)
    await openView(page, 'List')
    const row = page.locator('.sv-flist-item').nth(1)
    await row.waitFor({ timeout: 30_000 })
    await row.focus()
    await page.keyboard.press('Shift+F10')
    await page.getByRole('menuitem', { name: 'Select record', exact: true }).click()
    await bar(page).waitFor()
    await expect(row).toHaveClass(/is-selected/)
    await bar(page).locator('.sv-selbar-clear').focus()
    await page.keyboard.press('Enter')
    await expect(bar(page)).toHaveCount(0)
    await expect(row).toBeFocused()
    await expect(row).not.toHaveClass(/is-selected/)
  })

  test('list read from a server: the question goes back to Delete, and a confirmed Delete to the records', async ({ page }) => {
    await open(page, MILLION)
    await openView(page, 'List')
    const row = page.locator('.sv-flist-item').nth(1)
    await row.waitFor({ timeout: 30_000 })
    await row.focus()
    await page.keyboard.press('Shift+F10')
    await page.getByRole('menuitem', { name: 'Select record', exact: true }).click()
    await bar(page).waitFor()
    await del(page).focus()
    await page.keyboard.press('Enter')
    await expect(bar(page).getByRole('alert')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(del(page)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(bar(page).getByRole('alert')).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(bar(page)).toHaveCount(0, { timeout: 30_000 })
    await kept(page)
  })
})

test.describe('A form', () => {
  test('sent: focus lands on the thank-you, it is said, and Submit another goes to the new form', async ({ page }) => {
    await open(page, CRM)
    await openView(page, 'New lead')
    await page.locator('[data-form-field] input').first().focus()
    await page.keyboard.type('Keyboard lead')
    await page.locator('.sv-fform-submit').focus()
    await page.keyboard.press('Enter')
    const done = page.locator('.sv-fform-done .sv-fform-title')
    await expect(done).toBeFocused()
    await expect.poll(() => said(page)).toContain('The record was added')
    await page.keyboard.press('Tab')
    await expect(page.locator('.sv-fform-done .sv-fform-submit')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('form.sv-fform .sv-fform-title')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-form-field]').first().locator(':focus')).toHaveCount(1)
  })
})

test.describe('A comment in a record', () => {
  async function comment(page: Page) {
    await open(page, CRM)
    const table = page.locator('.sv-fbase-grid table.sv-grid-table').first()
    await page.locator('.sv-fbase-grid tbody td[role="gridcell"]').first().waitFor()
    await table.focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Shift+F10')
    await page.getByRole('menuitem', { name: 'Expand record' }).click()
    const box = page.locator('.sv-frv-comment textarea').last()
    await box.waitFor()
    await box.focus()
    await page.keyboard.type('Keep me')
    await page.keyboard.press('Control+Enter')
    await expect(page.locator('.sv-frv-item.is-comment').last()).toContainText('Keep me')
  }

  test('Escape on "Delete this comment?" leaves the question, not the record, and starts on Cancel', async ({ page }) => {
    await comment(page)
    const del = page.getByRole('button', { name: 'Delete', exact: true }).last()
    await del.focus()
    await page.keyboard.press('Enter')
    const ask = page.getByRole('group', { name: 'Delete this comment?' })
    await expect(ask.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(ask).toHaveCount(0)
    await expect(page.locator('[data-frv-field]').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit', exact: true }).last()).toBeFocused()
    await expect(page.locator('.sv-frv-item.is-comment').last()).toContainText('Keep me')
  })

  test('Next waits for a comment being changed, and says so', async ({ page }) => {
    await comment(page)
    await page.getByRole('button', { name: 'Edit', exact: true }).last().click()
    await page.keyboard.type(' and more')
    const title = await page.locator('.sv-modal__title, [role="dialog"] h2').first().innerText()
    await page.getByRole('button', { name: 'Next record' }).click()
    await expect(page.locator('.sv-frv-held')).toContainText('Save or cancel it')
    await expect(page.locator('.sv-frv-comment textarea').first()).toHaveValue(/and more/)
    await expect(page.locator('.sv-frv-comment textarea').first()).toBeFocused()
    expect(await page.locator('.sv-modal__title, [role="dialog"] h2').first().innerText()).toBe(title)
  })

  // The note is said as it appears: a status region added with its text already in it goes unread.
  test('Escape with a comment not sent keeps the record open and says why, aloud', async ({ page }) => {
    await comment(page)
    const box = page.locator('.sv-frv-comment textarea').last()
    await box.fill('Not sent')
    await box.focus()
    await page.keyboard.press('Escape')
    await expect(page.locator('.sv-frv-held')).toContainText('not sent')
    await expect.poll(() => said(page)).toContain('This comment is not sent')
    await expect(page.locator('[data-frv-field]').first()).toBeVisible()
  })

  test('a click outside with a comment not sent says why the record stays', async ({ page }) => {
    await comment(page)
    await page.locator('.sv-frv-comment textarea').last().fill('Not sent')
    await page.mouse.click(4, 4)
    await expect(page.locator('.sv-frv-held')).toContainText('not sent')
    await expect(page.locator('[data-frv-field]').first()).toBeVisible()
  })
})

test.describe('A dashboard tile moved by its buttons', () => {
  const order = (page: Page) => page.locator('.sv-fdash-tiles > li .sv-fdash-title').allInnerTexts()

  test('focus goes with the tile, to either end, and a second Enter does not undo the move', async ({ page }) => {
    await open(page, DASH)
    await page.getByRole('button', { name: /Edit dashboard/ }).click()
    const titles = await order(page)
    const second = titles[1]!
    const earlier = page.getByRole('button', { name: `Move ${second} earlier`, exact: true })
    await earlier.focus()
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await order(page))[0]).toBe(second)
    // First place: Earlier is off, and keeps the focus, so a second Enter moves nothing.
    await expect(earlier).toBeFocused()
    await expect(earlier).toHaveAttribute('aria-disabled', 'true')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    expect((await order(page))[0]).toBe(second)
    await expect(earlier).toBeFocused()

    const last = titles[titles.length - 1]!
    const before = titles[titles.length - 2]!
    const toEnd = page.getByRole('button', { name: `Move ${before} later`, exact: true })
    await toEnd.focus()
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await order(page)).at(-1)).toBe(before)
    await expect(toEnd).toBeFocused()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    expect((await order(page)).at(-1)).toBe(before)
    expect((await order(page)).at(-2)).toBe(last)

    // In the middle the same button keeps the focus.
    const mid = (await order(page))[2]!
    const midEarlier = page.getByRole('button', { name: `Move ${mid} earlier`, exact: true })
    await midEarlier.focus()
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await order(page))[1]).toBe(mid)
    await expect(midEarlier).toBeFocused()
  })
})
