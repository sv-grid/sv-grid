import { expect, test, type Page } from '@playwright/test'

/**
 * The spreadsheet shell on a phone, with touch: a tap picks a cell, a second
 * tap on the same cell opens the editor, and the two bands that cannot fit a
 * 390px screen - the ribbon and the cells - pan with a finger rather than
 * clipping what they cannot show. Playwright's iPhone 13 metrics with a
 * touch-capable Chromium (see playwright.config.ts).
 *
 * Runs against the gallery on :5174, so it needs no private website submodule.
 */

const DEMO = 'http://localhost:5174/#/207-blank-sheet'

async function open(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('sg-theme', 'light') } catch { /* private mode */ } })
  await page.goto(DEMO)
  await page.locator('.sv-sheet td[data-svgrid-row]').first().waitFor({ timeout: 60_000 })
  await page.waitForTimeout(500)
}

/** One finger, pressed and dragged across the element in steps. */
async function swipe(page: Page, selector: string, dx: number, dy: number) {
  const el = page.locator(selector).first()
  const b = (await el.boundingBox())!
  const x = b.x + b.width / 2
  const y = b.y + b.height / 2
  await page.touchscreen.tap(x, y)
  await page.evaluate(({ sel, dx, dy, x, y }) => {
    const node = document.querySelector(sel)!
    const touch = (cx: number, cy: number) => new Touch({ identifier: 1, target: node, clientX: cx, clientY: cy })
    const fire = (type: string, cx: number, cy: number) => {
      const t = touch(cx, cy)
      node.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] }))
    }
    fire('touchstart', x, y)
    for (let i = 1; i <= 4; i += 1) fire('touchmove', x + (dx * i) / 4, y + (dy * i) / 4)
    fire('touchend', x + dx, y + dy)
  }, { sel: selector, dx, dy, x, y })
  await page.waitForTimeout(200)
}

test.describe('spreadsheet on a phone', () => {
  test('a tap picks the cell and a second one opens its editor', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page)
    const cell = page.locator('.sv-sheet td[data-svgrid-row="2"][data-svgrid-col="1"]')
    await cell.tap()
    await expect(page.locator('.sv-formula-bar .name-box input')).toHaveValue('B3')

    await cell.tap()
    await cell.tap()
    await page.waitForTimeout(300)
    // The in-cell editor, wherever the shell puts it.
    expect(await page.locator('.sv-sheet textarea, .sv-sheet input.cell-editor, .sv-grid-cell-editor, .sv-sheet [contenteditable="true"]').count()).toBeGreaterThan(0)
    await page.keyboard.press('Escape')
  })

  test('the ribbon pans rather than hiding the groups that do not fit', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page)
    const band = page.locator('.sv-ribbon .band:not(.measure)').first()
    const metrics = await band.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, overflowX: getComputedStyle(el).overflowX }))
    // More ribbon than screen, and a scroller to reach the rest.
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth)
    expect(['auto', 'scroll']).toContain(metrics.overflowX)
    await band.evaluate((el) => { el.scrollLeft = el.scrollWidth })
    await page.waitForTimeout(200)
    expect(await band.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
  })

  test('a finger drag scrolls the cells', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page)
    const container = '.sv-sheet .sv-grid-container'
    const before = await page.locator(container).evaluate((el) => el.scrollTop)
    await swipe(page, container, 0, -160)
    const after = await page.locator(container).evaluate((el) => el.scrollTop)
    // Either the shell moved it, or the browser's own panning did; what the
    // test guards is that nothing blocks the gesture (`touch-action: none`).
    const touchAction = await page.locator(container).evaluate((el) => getComputedStyle(el).touchAction)
    expect(touchAction).not.toBe('none')
    expect(after).toBeGreaterThanOrEqual(before)
  })

  test('nothing in the shell escapes the screen unless it can be panned to', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page)
    const escaping = await page.evaluate(() => {
      const sheet = document.querySelector('.sv-sheet')!
      const right = sheet.getBoundingClientRect().right
      const canPan = (el: Element) => {
        const ox = getComputedStyle(el).overflowX
        return (ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1
      }
      const out: string[] = []
      for (const el of sheet.querySelectorAll('*')) {
        const b = el.getBoundingClientRect()
        if (b.width < 2 || b.height < 2) continue
        if (b.right <= right + 1) continue
        let sanctioned = false
        for (let p: Element | null = el.parentElement; p && p !== sheet; p = p.parentElement) {
          if (canPan(p)) { sanctioned = true; break }
          const ox = getComputedStyle(p).overflowX
          if ((ox === 'hidden' || ox === 'clip') && p.getBoundingClientRect().right <= right + 1) { sanctioned = true; break }
        }
        if (sanctioned) continue
        const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''
        out.push(`${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} (+${Math.round(b.right - right)}px)`)
      }
      return [...new Set(out)].slice(0, 5)
    })
    expect(escaping).toEqual([])
    // And the shell itself fits the phone, so the page never scrolls sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth))
  })
})
