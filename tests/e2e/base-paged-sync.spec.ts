/**
 * E2E: a paged table and a teammate's change, with a real mouse (fixtures/base-paged-sync.ts).
 *  - Grouped, two groups open: a feed that names only the table shows the new value in its
 *    open group, moves a record to its new group, and the counts follow. A feed with the
 *    changed fields does the same for a grouped field.
 *  - A failed block's Retry under the pinned column divider takes the pointer: hover, cursor
 *    and click are the button's, and off the button the divider still drags.
 *  - The top bar's line, cut short at 1100 px, is whole in its tooltip.
 *  - "All tables" says which table is shown; each Restore in the trash says which record.
 */
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const FIXTURE = fileURLToPath(new URL('./fixtures/base-paged-sync.ts', import.meta.url)).replace(/\\/g, '/').replace(/^\//, '')
type Paged = { store: Array<Record<string, unknown>>; fail: boolean; failFrom: number; reads: number[]; send(changes?: unknown): void }

async function open(page: Page, o: { grouped?: boolean; count?: number } = {}) {
  await page.setViewportSize({ width: 1100, height: 800 })
  // A file saved on the dev server must not reload the page under the test.
  await page.routeWebSocket(/.*/, () => {})
  await page.goto('/sv-grid/#/demos/01-quick-start', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.evaluate(async ([path, opts]) => {
    const fixture = await import(/* @vite-ignore */ path)
    fixture.show(opts)
  }, [`/sv-grid/@fs/${FIXTURE}`, o] as const)
  await page.locator(o.grouped ? 'button.sv-group-cell' : '.sv-grid-row', o.grouped ? {} : { hasText: 'Task 5' }).first().waitFor({ timeout: 60_000 })
  await page.evaluate(() => document.querySelectorAll('[data-svgrid-enterprise-upgrade]').forEach((n) => n.remove()))
}
/** `change` run in the page on `window.__paged`. */
const paged = (page: Page, change: string) => page.evaluate(`((p) => { ${change} })(window.__paged)`)
async function middle(page: Page, selector: string) {
  const b = (await page.locator(selector).first().boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, box: b }
}

/** Each group's header and the records listed under it, as `Task 3|note`. */
const listed = (page: Page) =>
  page.evaluate(() => {
    const by: Record<string, string[]> = {}
    let at = ''
    for (const r of document.querySelectorAll('.sv-grid-row:not(.sv-grid-placeholder-row)')) {
      const g = r.querySelector('button.sv-group-cell')
      if (g) {
        at = (g.textContent ?? '').replace(/\s+/g, ' ').trim()
        by[at] = []
        continue
      }
      const cells = [...r.querySelectorAll('.sv-grid-cell')].map((c) => (c.textContent ?? '').trim())
      const name = cells.find((t) => /^Task \d+$/.test(t))
      if (at && name) by[at]!.push(`${name}|${cells[cells.indexOf(name) + 2] ?? ''}`)
    }
    return by
  })

test.describe('SvGrid Base: a paged table and a teammate (real browser)', () => {
  test('grouped, two groups open: a change from the feed shows in place, a moved record moves, the counts follow', async ({ page }) => {
    await open(page, { grouped: true, count: 36 })
    for (const kind of ['Bug', 'Chore']) {
      const g = await middle(page, `button.sv-group-cell:has-text("${kind}")`)
      await page.mouse.click(g.x, g.y)
      await expect.poll(async () => Object.entries(await listed(page)).find(([k]) => k.startsWith(kind))?.[1].length).toBe(12)
    }
    await paged(page, `p.store.find((r) => r.id === 'r3').note = 'Ben was here'; p.store.find((r) => r.id === 'r6').kind = 'Chore'; p.send()`)
    await expect.poll(() => listed(page)).toMatchObject({ 'Bug (11)': expect.arrayContaining(['Task 3|Ben was here']), 'Chore (13)': expect.arrayContaining(['Task 6|n6']) })
    expect((await listed(page))['Bug (11)']).not.toContain('Task 6|n6')
    // The changed fields: a grouped field moves the record out of its open group.
    await paged(page, `p.store.find((r) => r.id === 'r9').kind = 'Feature'; p.send([{ type: 'update', id: 'r9', fields: { kind: 'Feature' } }])`)
    await expect.poll(async () => Object.keys(await listed(page))).toEqual(['Bug (10)', 'Chore (13)', 'Feature (13)'])
    expect((await listed(page))['Bug (10)']!.some((x) => x.startsWith('Task 9|'))).toBe(false)
  })

  test("a failed block's Retry under the pinned divider is the button's to the pointer", async ({ page }) => {
    await open(page)
    await paged(page, 'p.failFrom = 300')
    await page.evaluate(() => {
      const el = document.querySelector('.sv-grid-container')!
      el.scrollTop = el.scrollHeight / 2
    })
    const retry = page.locator('.sv-grid-placeholder-retry').first()
    await retry.waitFor()
    await retry.evaluate((b) => b.scrollIntoView({ block: 'center' }))
    await paged(page, 'p.failFrom = -1')
    const r = (await retry.boundingBox())!
    const split = (await page.locator('.sv-pin-split-hit').boundingBox())!
    // The case to test: the divider crosses the button.
    expect(split.x < r.x + r.width && split.x + split.width > r.x).toBe(true)
    const x = split.x + split.width / 2
    const y = r.y + r.height / 2
    await page.mouse.move(x, y + 40)
    await page.mouse.move(x, y, { steps: 5 })
    await expect.poll(() => page.evaluate(([px, py]) => {
      const el = document.elementFromPoint(px!, py!)
      return `${el?.classList.contains('sv-grid-placeholder-retry')} ${el ? getComputedStyle(el).cursor : ''} ${!!document.querySelector('.sv-pin-split-hit:hover')}`
    }, [x, y])).toBe('true pointer false')
    // Off the button the divider is the divider.
    await page.mouse.move(x, y + 90, { steps: 4 })
    await expect.poll(() => page.evaluate(() => !!document.querySelector('.sv-pin-split-hit:hover'))).toBe(true)
    await page.mouse.move(x, y, { steps: 4 })
    const before = await page.evaluate(() => (window as unknown as { __paged: Paged }).__paged.reads.length)
    await page.mouse.down()
    await page.mouse.up()
    await expect(page.locator('.sv-grid-placeholder-failed')).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __paged: Paged }).__paged.reads.length)).toBeGreaterThan(before)
  })

  test("the top bar's line, cut short, is whole in its tooltip; All tables says which is shown; Restore says which record", async ({ page }) => {
    await open(page)
    await paged(page, `p.store[3].note = 'Ben was here'; p.fail = true; p.send()`)
    const status = page.locator('.sv-btabs-status.is-error')
    await status.waitFor()
    const bar = await status.evaluate((s) => {
      const t = s.querySelector('.sv-btabs-status-text')!
      const line = s.querySelector('.sv-btabs-status-line')!
      return { cut: t.scrollWidth > t.clientWidth, whole: (line.getAttribute('title') ?? '').startsWith(line.textContent ?? '-') }
    })
    expect(bar).toEqual({ cut: true, whole: true })
    // Read once: the button holds the line and the server's words, and nothing else repeats them.
    await expect(page.locator('button.sv-btabs-status-text')).toHaveAccessibleName(/^Could not load Tasks of the quarterly planning board: .* in its log\. The server said: 500 Internal Server Error\.$/)
    expect(await status.getAttribute('title')).toBeNull()
    expect((await status.textContent())!.split('500 Internal Server Error').length - 1).toBe(1)
    // The keyboard opens the line in full, wrapped; the bar grows only while it is open.
    const height = () => page.locator('.sv-btabs').evaluate((b) => b.getBoundingClientRect().height)
    const shut = await height()
    const line = page.locator('button.sv-btabs-status-text')
    await line.focus()
    await page.keyboard.press('Enter')
    await expect(line).toHaveAttribute('aria-expanded', 'true')
    expect(await page.locator('.sv-btabs-status-more').evaluate((m) => m.getBoundingClientRect().height)).toBeGreaterThan(2)
    expect(await height()).toBeGreaterThan(shut)
    expect(await line.evaluate((b) => b.scrollWidth <= b.clientWidth + 1)).toBe(true)
    await page.keyboard.press('Enter')
    await expect(line).toHaveAttribute('aria-expanded', 'false')
    expect(await height()).toBe(shut)
    await paged(page, 'p.fail = false')
    await page.locator('.sv-btabs-status-stop').click()
    await expect(status).toHaveCount(0)

    await page.getByRole('button', { name: 'All tables' }).click()
    const menu = page.getByRole('menu', { name: 'All tables' })
    await expect(menu.getByRole('menuitemradio', { name: 'Tasks of the quarterly planning board' })).toHaveAttribute('aria-checked', 'true')
    await expect(menu.getByRole('menuitemradio', { name: 'Notes' })).toHaveAttribute('aria-checked', 'false')
    await page.keyboard.press('Escape')

    for (const name of ['Task 2', 'Task 4']) {
      await page.getByText(name, { exact: true }).first().click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Delete record' }).click()
      const ask = page.getByRole('dialog', { name: 'Delete record?' })
      if (await ask.isVisible().catch(() => false)) await ask.getByRole('button', { name: 'Delete record' }).click()
      await expect(page.getByText(name, { exact: true })).toHaveCount(0)
    }
    await page.locator('.sv-btabs-trash').click()
    const trash = page.getByRole('dialog', { name: 'Trash' })
    await expect(trash.getByRole('button', { name: 'Restore Task 2', exact: true })).toBeVisible()
    await expect(trash.getByRole('button', { name: 'Restore Task 4', exact: true })).toBeVisible()
  })

  test("the divider's line does not cross a failed block's band, and is drawn everywhere else", async ({ page }) => {
    await open(page)
    await paged(page, 'p.failFrom = 300')
    await page.evaluate(() => {
      const el = document.querySelector('.sv-grid-container')!
      el.scrollTop = el.scrollHeight / 2
    })
    const retry = page.locator('.sv-grid-placeholder-retry').first()
    await retry.waitFor()
    await retry.evaluate((b) => b.scrollIntoView({ block: 'center' }))
    await page.mouse.move(1000, 790)
    // The pixels on screen: the line's own column against a few pixels either side, in the band and above it.
    const crossed = async () => {
      const at = await page.evaluate(() => {
        const line = document.querySelector('.sv-pin-split-line')!.getBoundingClientRect()
        const bottom = document.querySelector('.sv-grid-container')!.getBoundingClientRect().bottom - 20
        const bands = [...document.querySelectorAll('.sv-grid-placeholder-failed')].map((r) => r.getBoundingClientRect()).filter((r) => r.bottom < bottom)
        const rows = [...document.querySelectorAll('.sv-grid-row:not(.sv-grid-placeholder-row)')].map((r) => r.getBoundingClientRect()).filter((r) => r.bottom <= bands[0]!.top && r.top > 150)
        const head = document.querySelector('thead')!.getBoundingClientRect()
        const last = bands[bands.length - 1]!
        return { x: Math.round(line.left + line.width / 2 - 0.5), ys: [bands[0]!.top + 3, last.top + last.height / 2, rows[rows.length - 1]!.top + 3, head.top + head.height / 2].map(Math.round) }
      })
      const png = (await page.screenshot()).toString('base64')
      return page.evaluate(async ([b64, x, ys]) => {
        const img = await createImageBitmap(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'image/png' }))
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const g = c.getContext('2d')!
        g.drawImage(img, 0, 0)
        const k = img.width / innerWidth
        const px = (px: number, py: number) => [...g.getImageData(Math.round(px * k), Math.round(py * k), 1, 1).data.slice(0, 3)]
        const far = (a: number[], b: number[]) => a.some((v, i) => Math.abs(v - b[i]!) > 12)
        return ys.map((y) => far(px(x, y), px(x - 5, y)) && far(px(x, y), px(x + 5, y)))
      }, [png, at.x, at.ys] as const)
    }
    // In the band (its top and a row further down): not crossed. A data row and the header: the line is there.
    await expect.poll(crossed).toEqual([false, false, true, true])
    await page.emulateMedia({ forcedColors: 'active' })
    await expect.poll(crossed).toEqual([false, false, true, true])
  })
})

test.describe('SvGrid Base: the top bar on a touch screen (real browser)', () => {
  test.use({ hasTouch: true })
  test("a tap on the line cut short opens it in full, and another tap closes it", async ({ page }) => {
    await open(page)
    await paged(page, `p.fail = true; p.send()`)
    const line = page.locator('button.sv-btabs-status-text')
    await line.waitFor()
    const height = () => page.locator('.sv-btabs').evaluate((b) => b.getBoundingClientRect().height)
    const shut = await height()
    const tap = async () => {
      const b = (await line.boundingBox())!
      await page.touchscreen.tap(b.x + 20, b.y + Math.min(8, b.height / 2))
    }
    await tap()
    await expect(line).toHaveAttribute('aria-expanded', 'true')
    expect(await height()).toBeGreaterThan(shut)
    expect(await page.locator('.sv-btabs-status-more').evaluate((m) => m.getBoundingClientRect().height)).toBeGreaterThan(2)
    await tap()
    await expect(line).toHaveAttribute('aria-expanded', 'false')
    expect(await height()).toBe(shut)
    await paged(page, 'p.fail = false')
  })
})
