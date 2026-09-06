import { test, expect, type Page } from '@playwright/test'

/**
 * The custom elements' generated API surface, driven the way a non-Svelte host
 * drives it.
 *
 * Until this landed, `<sv-grid>` declared 7 props and 2 events by hand against
 * a Props type with 100 props and 19 callbacks: grouping, pagination, pinning,
 * tree data and every enterprise feature were unreachable, while the docs said
 * they "all come along". The unit tests check the generated file matches the
 * type; these check the element built from it actually does something.
 *
 * Runs against the BUILT bundles on :4205 - the surface is compiled into
 * `<svelte:options customElement>`, which Svelte resolves at build time.
 */
const FIXTURE = 'http://localhost:4205/test/shadow.html'

const inShadow = (page: Page, body: string) =>
  page.evaluate(`(() => { const r = document.getElementById('s').shadowRoot; ${body} })()`)

const rowsIn = (page: Page, id: string) =>
  page.evaluate(
    `(() => {
      const el = document.getElementById(${JSON.stringify(id)})
      const root = el.shadowRoot ?? el
      return new Set([...root.querySelectorAll('td[data-svgrid-row]')].map((c) => c.dataset.svgridRow)).size
    })()`,
  )

async function setup(page: Page) {
  await page.goto(FIXTURE, { waitUntil: 'load' })
  await expect.poll(() => rowsIn(page, 'l'), { timeout: 15_000 }).toBeGreaterThan(0)
}

test.describe('generated element surface', () => {
  test('a prop that was previously unreachable takes effect', async ({ page }) => {
    await setup(page)
    // `showRowNumbers` is one of the 91 props the hand-written element never
    // declared. Setting it must add the row-number column.
    const cols = () => page.evaluate(() => document.getElementById('l')!.querySelectorAll('thead th').length)
    const before = await cols()
    await page.evaluate(() => ((document.getElementById('l') as never as { showRowNumbers: boolean }).showRowNumbers = true))
    await expect.poll(cols).toBe(before + 1)
  })

  test('grouping works through array + boolean properties', async ({ page }) => {
    await setup(page)
    // Arrays cannot be attributes, so this is the property path - the one a
    // React or Vue host uses, and the one most often got wrong.
    await page.evaluate(() => {
      const el = document.getElementById('l') as never as { groupable: boolean; groupBy: string[] }
      el.groupable = true
      el.groupBy = ['city']
    })
    await expect
      .poll(() => page.evaluate(() => document.getElementById('l')!.innerText))
      .toContain('City: Sofia')
  })

  test('attributes alone configure a grid, with no script but data', async ({ page }) => {
    await setup(page)
    // The CDN story. `page-size` is initial-only in the grid, so an attribute
    // at mount is the ONLY way it can be proven to work.
    await expect.poll(() => rowsIn(page, 'a')).toBe(5)

    const el = await page.evaluate(() => {
      const a = document.getElementById('a')!
      const cell = a.querySelector('td[data-svgrid-row]')!
      return {
        cols: a.querySelectorAll('thead th').length,
        rowHeight: Math.round(cell.getBoundingClientRect().height),
        pager: a.innerText.includes('Page 1 of'),
      }
    })
    // row-height="28" coerced from a string attribute to a number.
    expect(el.rowHeight).toBe(28)
    // show-row-numbers added its column.
    expect(el.cols).toBeGreaterThan(4)
    expect(el.pager).toBe(true)
  })

  test('a generated event fires with the callback argument as detail', async ({ page }) => {
    await setup(page)
    // `cellvaluechange` is one of the 17 events the element never emitted.
    const cell = (await inShadow(
      page,
      `const c = r.querySelector('td[data-svgrid-row="1"][data-svgrid-col="1"]')
       const q = c.getBoundingClientRect()
       return { x: Math.round(q.x + q.width / 2), y: Math.round(q.y + q.height / 2) }`,
    )) as { x: number; y: number }
    await page.mouse.dblclick(cell.x, cell.y)
    await page.waitForTimeout(400)
    await page.keyboard.press('Control+a')
    await page.keyboard.type('Edited')
    await page.keyboard.press('Enter')

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as never as { __events: [string, unknown][] }).__events
            .filter((e) => e[0] === 'cellvaluechange').length,
        ),
      )
      .toBeGreaterThan(0)

    const detail = await page.evaluate(
      () =>
        (window as never as { __events: [string, { columnId: string; newValue: unknown }][] }).__events
          .find((e) => e[0] === 'cellvaluechange')![1],
    )
    // detail is the callback's argument, verbatim.
    expect(detail.columnId).toBe('name')
    expect(detail.newValue).toBe('Edited')
  })

  test('the imperative api is on the element, not only in a one-shot event', async ({ page }) => {
    await setup(page)
    // `onApiReady` fires once. A host that binds a listener after mount would
    // never see it, so the handle is parked on the element as well.
    expect(await page.evaluate(() => typeof (document.getElementById('s') as never as { api: unknown }).api)).toBe(
      'object',
    )
    expect(
      await page.evaluate(() =>
        (window as never as { __events: [string][] }).__events.some((e) => e[0] === 'apiready'),
      ),
    ).toBe(true)
  })

  test('the two events published before the surface keep their payload', async ({ page }) => {
    await setup(page)
    // `<sv-grid>` 2.6.2 shipped `rowclick` with the ROW as detail, not the whole
    // click event. The generic rule would have made it the event, silently
    // breaking every consumer already reading `e.detail.name`.
    const cell = (await inShadow(
      page,
      `const c = r.querySelector('td[data-svgrid-row="3"][data-svgrid-col="1"]')
       const q = c.getBoundingClientRect()
       return { x: Math.round(q.x + q.width / 2), y: Math.round(q.y + q.height / 2) }`,
    )) as { x: number; y: number }
    await page.mouse.click(cell.x, cell.y)

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as never as { __events: [string, unknown][] }).__events.filter((e) => e[0] === 'rowclick').length,
        ),
      )
      .toBeGreaterThan(0)

    const detail = await page.evaluate(
      () =>
        (window as never as { __events: [string, Record<string, unknown>][] }).__events.find(
          (e) => e[0] === 'rowclick',
        )![1],
    )
    // The row itself: it has the data fields, and NOT the click event's shape.
    expect(detail).toHaveProperty('name')
    expect(detail).not.toHaveProperty('columnId')
  })

  test('`selectable` still means row checkboxes, not cell selection', async ({ page }) => {
    await setup(page)
    // `<SvGrid selectable>` is an alias of enableCellSelection - a different
    // feature. Forwarding the published attribute to it would have silently
    // repointed what `<sv-grid selectable>` does.
    const checkboxes = await inShadow(page, `return r.querySelectorAll('tbody [role="checkbox"]').length`)
    expect(checkboxes).toBeGreaterThan(0)
  })
})
