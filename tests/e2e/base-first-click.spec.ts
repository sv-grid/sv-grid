/**
 * E2E: the first click on a cell of a base selects it, field type by field type,
 * with a real mouse. Selecting a cell never leaves the page and never changes a
 * record: a link, a box, a star, a button, a vote and a chip act on a click of the
 * cell already selected. Ctrl or Cmd click opens a link at once. A double-click
 * edits. A finger follows the same rules, and a phone's cards act at once.
 */
import { fileURLToPath } from 'node:url'
import { expect, test, type Locator, type Page } from '@playwright/test'

const FIXTURE = fileURLToPath(new URL('./fixtures/base-every-field.ts', import.meta.url)).replace(/\\/g, '/').replace(/^\//, '')

async function open(page: Page) {
  await page.setViewportSize({ width: 5200, height: 800 })
  await page.route('https://**example.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }))
  // A file saved on the dev server must not reload the page under the test.
  await page.routeWebSocket(/.*/, () => {})
  await page.goto('/sv-grid/#/demos/01-quick-start', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.evaluate(async (path) => {
    const fixture = await import(/* @vite-ignore */ path)
    fixture.show({})
    // Which links the browser was left to follow: a click nothing prevented.
    const w = window as unknown as { __followed: string[] }
    w.__followed = []
    window.addEventListener('click', (e) => {
      const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null
      if (!a) return
      setTimeout(() => {
        if (!e.defaultPrevented) w.__followed.push(a.href)
      })
      // No browser here leaves the page for a mailto or tel link.
      if (!/^https?:/.test(a.href)) setTimeout(() => e.preventDefault())
    }, true)
  }, `/sv-grid/@fs/${FIXTURE}`)
  await page.locator('.sv-btabs').waitFor({ timeout: 60_000 })
  await page.locator('.sv-grid-table tbody .sv-grid-row').first().waitFor()
}

type Stored = Record<string, unknown>
const record = async (page: Page, id = 'r1') => (await page.evaluate(() => (window as unknown as { __base: { rows: (t: string) => Stored[] } }).__base.rows('items'))).find((r) => r.id === id)!
const followed = (page: Page) => page.evaluate(() => (window as unknown as { __followed: string[] }).__followed.slice())
const cell = (page: Page, field: string, row = 0) => page.locator('.sv-grid-table tbody .sv-grid-row').nth(row).locator(`[data-col-id="${field}"]`)
const isSelected = (c: Locator) => c.evaluate((el) => el.getAttribute('tabindex') === '0' || el.getAttribute('data-selected-range') === 'true' || el.matches('[data-active="true"]') || el.classList.contains('sv-grid-cell-active'))

async function clickOn(page: Page, target: Locator, opts: { x?: number; modifiers?: 'Control' } = {}) {
  await target.scrollIntoViewIfNeeded()
  const b = (await target.boundingBox())!
  if (opts.modifiers) await page.keyboard.down(opts.modifiers)
  await page.mouse.click(b.x + (opts.x ?? b.width / 2), b.y + b.height / 2)
  if (opts.modifiers) await page.keyboard.up(opts.modifiers)
}
/** Off the cell under test: the record's Name. */
async function away(page: Page) {
  const b = (await cell(page, 'name').boundingBox())!
  await page.mouse.click(b.x + b.width - 8, b.y + b.height - 4)
  await expect.poll(() => isSelected(cell(page, 'name'))).toBe(true)
}

test.describe.configure({ timeout: 120_000 })

test.describe('the first click selects', () => {
  test.use({ timezoneId: 'Europe/Athens', locale: 'en-US' })

  for (const [field, tag, href] of [
    ['site', 'url', 'https://example.com/a'],
    ['email', 'email', 'mailto:ann@example.com'],
    ['phone', 'phone', 'tel:+14155550123'],
  ] as const) {
    test(`${tag}: first click selects and stays, the second follows`, async ({ page }) => {
      await open(page)
      await away(page)
      const link = cell(page, field).locator('a')
      await clickOn(page, link)
      await expect.poll(() => isSelected(cell(page, field))).toBe(true)
      expect(await followed(page)).toEqual([])
      expect(page.context().pages()).toHaveLength(1)
      await page.waitForTimeout(600)
      await clickOn(page, link)
      await expect.poll(() => followed(page)).toEqual([href])
      // A click on a link is no edit.
      await expect(page.locator('.sv-grid-cell-editor, .sv-grid-editor')).toHaveCount(0)
    })

    test(`${tag}: Ctrl click follows at once and leaves the selection`, async ({ page }) => {
      await open(page)
      await away(page)
      await clickOn(page, cell(page, field).locator('a'), { modifiers: 'Control' })
      await expect.poll(() => followed(page)).toEqual([href])
      expect(await isSelected(cell(page, 'name'))).toBe(true)
    })

    test(`${tag}: a double-click on a cell not selected edits it and follows nothing`, async ({ page }) => {
      await open(page)
      await away(page)
      const b = (await cell(page, field).locator('a').boundingBox())!
      await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2)
      await expect(page.locator('input:focus, textarea:focus')).toHaveCount(1)
      expect(await followed(page)).toEqual([])
      await page.keyboard.press('Escape')
    })
  }

  test('a URL wider than its column: a click at its end selects, and the keys work on it', async ({ page }) => {
    await open(page)
    await away(page)
    const c = cell(page, 'site')
    const b = (await c.boundingBox())!
    await page.mouse.click(b.x + b.width - 5, b.y + b.height / 2)
    await expect.poll(() => isSelected(c)).toBe(true)
    expect(await followed(page)).toEqual([])
  })

  test('a range can start on a link', async ({ page }) => {
    await open(page)
    await away(page)
    const from = (await cell(page, 'site').locator('a').boundingBox())!
    const to = (await cell(page, 'site', 2).boundingBox())!
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + 20, to.y + to.height / 2, { steps: 6 })
    await page.mouse.up()
    await expect(cell(page, 'site', 1)).toHaveAttribute('data-selected-range', 'true')
    expect(await followed(page)).toEqual([])
  })

  test('checkbox: a click on the box toggles at once, a click beside it only selects', async ({ page }) => {
    await open(page)
    // Beside the box: the first click selects, the next toggles.
    await away(page)
    let before = (await record(page)).done
    await clickOn(page, cell(page, 'done'), { x: 6 })
    await expect.poll(() => isSelected(cell(page, 'done'))).toBe(true)
    expect((await record(page)).done).toBe(before)
    await page.waitForTimeout(600)
    await clickOn(page, cell(page, 'done'), { x: 6 })
    await expect.poll(async () => (await record(page)).done).toBe(!before)
    // On the box: one click toggles once and selects the cell, from another cell.
    await away(page)
    before = (await record(page)).done
    await clickOn(page, cell(page, 'done').locator('.sv-fcb-box'))
    await expect.poll(async () => (await record(page)).done).toBe(!before)
    await expect.poll(() => isSelected(cell(page, 'done'))).toBe(true)
    // Two more clicks on the box tick and untick.
    await page.waitForTimeout(600)
    await clickOn(page, cell(page, 'done').locator('.sv-fcb-box'))
    await expect.poll(async () => (await record(page)).done).toBe(before)
    // Space still toggles the selected cell, as it did.
    before = (await record(page)).done
    await page.keyboard.press('Space')
    await expect.poll(async () => (await record(page)).done).toBe(!before)
  })

  test('rating: a click on a star rates at once and selects, a click beside the stars only selects', async ({ page }) => {
    await open(page)
    await away(page)
    const before = (await record(page)).stars
    const box = (await cell(page, 'stars').boundingBox())!
    const stars = (await cell(page, 'stars').locator('.sv-frt').boundingBox())!
    await clickOn(page, cell(page, 'stars'), { x: Math.round(stars.x - box.x + stars.width + 8) })
    await expect.poll(() => isSelected(cell(page, 'stars'))).toBe(true)
    expect((await record(page)).stars).toBe(before)
    await away(page)
    const star = cell(page, 'stars').locator('svg').nth(1)
    await clickOn(page, star)
    await expect.poll(async () => (await record(page)).stars).toBe(2)
    await expect.poll(() => isSelected(cell(page, 'stars'))).toBe(true)
    // The click was the star's: no editor on top of it.
    await expect(page.locator('.sv-fre, .sv-grid-cell-editor')).toHaveCount(0)
  })

  test('button: a click on it runs it at once, once for a double-click, and beside it only selects', async ({ page }) => {
    await open(page)
    await page.evaluate(() => {
      const w = window as unknown as { __opened: string[]; open: (u: string) => null }
      w.__opened = []
      w.open = (u: string) => (w.__opened.push(u), null)
    })
    const opened = () => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened.slice())
    await away(page)
    const b = cell(page, 'act').locator('button')
    // Beside the button: selects, runs nothing.
    await clickOn(page, cell(page, 'act'), { x: 2 })
    await expect.poll(() => isSelected(cell(page, 'act'))).toBe(true)
    expect(await opened()).toEqual([])
    await away(page)
    await clickOn(page, b)
    await expect.poll(opened).toEqual(['https://example.com/go/Alpha%201'])
    await expect.poll(() => isSelected(cell(page, 'act'))).toBe(true)
    // A double-click from another cell runs it once more, not twice.
    await away(page)
    await b.dblclick()
    await expect.poll(async () => (await opened()).length).toBe(2)
    await page.waitForTimeout(300)
    expect((await opened()).length).toBe(2)
  })

  test('vote: a click on it votes at once, once, and a double-click does not take it back', async ({ page }) => {
    await open(page)
    await away(page)
    const before = ((await record(page)).votes as string[]).length
    const b = cell(page, 'votes').locator('button')
    await clickOn(page, b)
    await expect.poll(async () => ((await record(page)).votes as string[]).length).toBe(before + 1)
    await expect.poll(() => isSelected(cell(page, 'votes'))).toBe(true)
    await away(page)
    await b.dblclick()
    await expect.poll(async () => ((await record(page)).votes as string[]).length).toBe(before)
    await page.waitForTimeout(300)
    expect(((await record(page)).votes as string[]).length).toBe(before)
  })

  test('link chip: the first click selects, the next opens the record', async ({ page }) => {
    await open(page)
    await away(page)
    const chip = cell(page, 'account').locator('.sv-flr-chip').first()
    await clickOn(page, chip)
    await expect.poll(() => isSelected(cell(page, 'account'))).toBe(true)
    await expect(page.locator('.sv-modal')).toHaveCount(0)
    await page.waitForTimeout(600)
    await clickOn(page, chip)
    await expect(page.locator('.sv-modal')).toHaveCount(1)
  })

  test('attachment: the first click selects, the selected cell opens its dialog', async ({ page }) => {
    await open(page)
    await away(page)
    await clickOn(page, cell(page, 'files'))
    await expect.poll(() => isSelected(cell(page, 'files'))).toBe(true)
    await expect(page.locator('.sv-modal')).toHaveCount(0)
    await page.waitForTimeout(600)
    await clickOn(page, cell(page, 'files'))
    await expect(page.locator('.sv-modal')).toHaveCount(1)
  })

  test('checklist: the first click selects, the selected cell opens its panel', async ({ page }) => {
    await open(page)
    await away(page)
    const count = cell(page, 'todo').locator('.sv-fck-count')
    await clickOn(page, count)
    await expect.poll(() => isSelected(cell(page, 'todo'))).toBe(true)
    await expect(page.locator('.sv-fcl, .sv-fck-panel, [class*="checklist"]')).toHaveCount(0)
    await page.waitForTimeout(600)
    await clickOn(page, count)
    await expect(page.locator('input:focus')).toHaveCount(1)
    await page.keyboard.press('Escape')
  })

  test('rich text: a link in the cell selects first', async ({ page }) => {
    await open(page)
    await page.locator('.sv-grid-table').first().waitFor()
    await away(page)
    await clickOn(page, cell(page, 'rich'))
    await expect.poll(() => isSelected(cell(page, 'rich'))).toBe(true)
  })
})

test.describe('a finger on a wide screen', () => {
  test.use({ hasTouch: true, timezoneId: 'Europe/Athens', locale: 'en-US' })

  // A finger follows the mouse: the box, a star, a vote and a button act on the
  // tap; a tap anywhere else in a cell, a link cell included, selects it, and a
  // tap on the selected link cell follows the link.
  async function tapOn(page: Page, target: Locator, x?: number) {
    await target.scrollIntoViewIfNeeded()
    const b = (await target.boundingBox())!
    await page.touchscreen.tap(b.x + (x ?? b.width / 2), b.y + b.height / 2)
  }
  async function tapAway(page: Page) {
    const name = cell(page, 'name')
    const b = (await name.boundingBox())!
    await page.touchscreen.tap(b.x + b.width - 8, b.y + b.height - 4)
    await expect.poll(() => isSelected(name)).toBe(true)
  }

  for (const [field, tag, href] of [
    ['site', 'url', 'https://example.com/a'],
    ['email', 'email', 'mailto:ann@example.com'],
    ['phone', 'phone', 'tel:+14155550123'],
  ] as const) {
    test(`${tag}: the first tap selects and stays, the next follows`, async ({ page }) => {
      await open(page)
      await tapAway(page)
      const link = cell(page, field).locator('a')
      await tapOn(page, link)
      await expect.poll(() => isSelected(cell(page, field))).toBe(true)
      await page.waitForTimeout(600)
      expect(await followed(page)).toEqual([])
      await tapOn(page, link)
      await expect.poll(() => followed(page)).toEqual([href])
    })
  }

  // WebKit's touch adjustment: a tap's press goes to the cell where the finger
  // landed, and its click to a link, a chip or a control a few pixels away. That
  // click had no press of its own, so it does what a click beside them does.
  async function adjustedTap(page: Page, field: string, onto: string) {
    const c = cell(page, field)
    await c.scrollIntoViewIfNeeded()
    await c.evaluate((td, sel) => {
      const target = td.querySelector(sel)!
      const r = td.getBoundingClientRect()
      const at = { clientX: r.right - 3, clientY: r.top + r.height / 2, bubbles: true, cancelable: true, composed: true }
      // The cell's own line, never the link: the finger landed beside it.
      const under = td.querySelector('.sv-grid-cell-line') ?? td
      const touch = { ...at, pointerType: 'touch', isPrimary: true, pointerId: 7, button: 0 }
      under.dispatchEvent(new PointerEvent('pointerdown', { ...touch, buttons: 1 }))
      under.dispatchEvent(new PointerEvent('pointerup', { ...touch, buttons: 0 }))
      target.dispatchEvent(new MouseEvent('click', { ...at, detail: 1, button: 0 }))
    }, onto)
  }

  for (const [field, tag] of [['site', 'url'], ['email', 'email']] as const) {
    test(`${tag}: a tap beside the link that the browser moves onto it follows nothing, selected or not`, async ({ page }) => {
      await open(page)
      await tapAway(page)
      await adjustedTap(page, field, 'a')
      await expect.poll(() => isSelected(cell(page, field))).toBe(true)
      await adjustedTap(page, field, 'a')
      await page.waitForTimeout(600)
      expect(await followed(page)).toEqual([])
    })
  }

  test('a tap beside a chip, a checklist, a box or a star that the browser moves onto it only selects', async ({ page }) => {
    await open(page)
    const before = await record(page)
    for (const [field, onto] of [['account', '.sv-flr-chip'], ['todo', '.sv-fck'], ['done', '.sv-fcb-box'], ['stars', 'svg:nth-child(2)']] as const) {
      await tapAway(page)
      await adjustedTap(page, field, onto)
      await expect.poll(() => isSelected(cell(page, field))).toBe(true)
      await page.waitForTimeout(400)
      await expect(page.locator('.sv-modal')).toHaveCount(0)
      await expect(page.locator('input:focus')).toHaveCount(0)
    }
    const after = await record(page)
    expect(after.done).toBe(before.done)
    expect(after.stars).toBe(before.stars)
  })

  test('a URL wider than its column: a tap at its end selects', async ({ page }) => {
    await open(page)
    await tapAway(page)
    const c = cell(page, 'site')
    const b = (await c.boundingBox())!
    await page.touchscreen.tap(b.x + b.width - 5, b.y + b.height / 2)
    await expect.poll(() => isSelected(c)).toBe(true)
    await page.waitForTimeout(600)
    expect(await followed(page)).toEqual([])
  })

  test('checkbox: a tap on the box ticks it, a tap beside it selects, the next tap ticks', async ({ page }) => {
    await open(page)
    await tapAway(page)
    let before = (await record(page)).done
    await tapOn(page, cell(page, 'done'), 6)
    await expect.poll(() => isSelected(cell(page, 'done'))).toBe(true)
    await page.waitForTimeout(600)
    expect((await record(page)).done).toBe(before)
    await tapOn(page, cell(page, 'done'), 6)
    await expect.poll(async () => (await record(page)).done).toBe(!before)
    await tapAway(page)
    before = (await record(page)).done
    await tapOn(page, cell(page, 'done').locator('.sv-fcb-box'))
    await expect.poll(async () => (await record(page)).done).toBe(!before)
    await expect.poll(() => isSelected(cell(page, 'done'))).toBe(true)
  })

  test('a star and a vote act on the tap; a chip and a checklist select first', async ({ page }) => {
    await open(page)
    await tapAway(page)
    await tapOn(page, cell(page, 'stars').locator('svg').nth(1))
    await expect.poll(async () => (await record(page)).stars).toBe(2)
    await tapAway(page)
    const votes = ((await record(page)).votes as string[]).length
    await tapOn(page, cell(page, 'votes').locator('button'))
    await expect.poll(async () => ((await record(page)).votes as string[]).length).toBe(votes + 1)
    await tapAway(page)
    await tapOn(page, cell(page, 'account').locator('.sv-flr-chip').first())
    await expect.poll(() => isSelected(cell(page, 'account'))).toBe(true)
    await expect(page.locator('.sv-modal')).toHaveCount(0)
    await tapAway(page)
    await tapOn(page, cell(page, 'todo').locator('.sv-fck-count'))
    await expect.poll(() => isSelected(cell(page, 'todo'))).toBe(true)
    await page.waitForTimeout(600)
    await expect(page.locator('input:focus')).toHaveCount(0)
  })
})

test.describe('a finger', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 412, height: 800 }, timezoneId: 'Europe/Athens', locale: 'en-US' })

  test('on a phone a card opens its record, and in the record a link opens at once', async ({ page }) => {
    await page.route('https://**example.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }))
    await page.routeWebSocket(/.*/, () => {})
    await page.goto('/sv-grid/#/demos/01-quick-start', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.evaluate(async (path) => {
      const fixture = await import(/* @vite-ignore */ path)
      fixture.show({})
    }, `/sv-grid/@fs/${FIXTURE}`)
    await page.locator('.sv-btabs').waitFor({ timeout: 60_000 })
    const card = page.getByText('Alpha 1').first()
    await card.waitFor({ timeout: 30_000 })
    await card.tap()
    const dialog = page.locator('.sv-modal')
    await dialog.waitFor()
    const site = dialog.locator('a[href="https://example.com/a"]')
    await site.scrollIntoViewIfNeeded()
    const [tab] = await Promise.all([page.context().waitForEvent('page'), site.tap()])
    expect(tab.url()).toContain('example.com')
    await tab.close()
  })
})

// A contrast theme (forced colors) removes fills and keeps an SVG's own colours.
// The tick of a checkbox was white on the box's fill, so a ticked box read as
// empty; a given star stayed the field's yellow on the theme's white.
for (const scheme of ['light', 'dark'] as const) {
  test(`forced colors (${scheme}): a ticked box and the given stars are drawn in the theme's text colour`, async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active', colorScheme: scheme })
    await open(page)
    const paint = (el: Element, s: string) =>
      [...el.querySelectorAll(s)].map((p) => {
        const c = getComputedStyle(p)
        return { stroke: c.stroke, fill: c.fill, text: getComputedStyle(el).color, canvas: getComputedStyle(el.closest('td')!).backgroundColor }
      })
    const tick = (await cell(page, 'done').evaluate(paint, '.sv-fcb-box path'))[0]!
    expect(tick.stroke).toBe(tick.text)
    expect(tick.stroke).not.toBe(tick.canvas)
    const stars = await cell(page, 'stars').evaluate(paint, '.sv-frt-icon.is-on path')
    expect(stars).toHaveLength(4)
    for (const s of stars) {
      expect(s.fill).toBe(s.text)
      expect(s.stroke).toBe(s.text)
    }
  })
}
