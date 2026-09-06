import { test, expect, type Page } from '@playwright/test'

/**
 * `<sv-grid-shadow>` - the grid inside an OPEN shadow root.
 *
 * Runs against the BUILT bundles on :4205, not a dev server, because the piece
 * this feature turns on is a build-only plugin: it hoists the bundle's CSS into
 * one string, puts it on `globalThis.__SVGRID_WC_CSS__` for the root to adopt,
 * and appends it to `document.head` for the popups that portal out of the root.
 * In dev that global does not exist and `adoptGridStyles` correctly no-ops, so
 * a dev-server test would pass while asserting nothing.
 *
 * The fixture puts a `<sv-grid>` next to the `<sv-grid-shadow>` under a hostile
 * page rule, so every isolation assertion has a control that must show the
 * opposite result. Without it, "the header is not fuchsia" proves nothing - the
 * rule might simply never have applied.
 */
const FIXTURE = 'http://localhost:4205/test/shadow.html'
const FUCHSIA = 'rgb(255, 0, 255)'

const inRoot = (page: Page, body: string) =>
  page.evaluate(`(() => { const r = document.getElementById('s').shadowRoot; ${body} })()`)

async function setup(page: Page) {
  await page.goto(FIXTURE, { waitUntil: 'load' })
  await expect
    .poll(async () => inRoot(page, `return r.querySelectorAll('td[data-svgrid-row]').length`), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0)
}

test.describe('<sv-grid-shadow>', () => {
  test('registers, and attaches an OPEN root', async ({ page }) => {
    await setup(page)
    expect(
      await page.evaluate(() => ({
        defined: !!customElements.get('sv-grid-shadow'),
        // Open is the contract. Closed would leave `shadowRoot` null, and a
        // consumer could not style, query or test their own grid.
        open: !!document.getElementById('s')!.shadowRoot,
        // The content is INSIDE the root, not spilled into the light DOM.
        lightChildren: document.getElementById('s')!.children.length,
      })),
    ).toEqual({ defined: true, open: true, lightChildren: 0 })
  })

  test('renders and virtualizes inside the root', async ({ page }) => {
    await setup(page)
    const seen = (await inRoot(
      page,
      `return {
        rows: new Set([...r.querySelectorAll('td[data-svgrid-row]')].map((c) => c.dataset.svgridRow)).size,
        cols: r.querySelectorAll('th').length,
      }`,
    )) as { rows: number; cols: number }
    expect(seen.cols).toBeGreaterThanOrEqual(4)
    // 40 rows of data, a 340px box: it must render some and not all.
    expect(seen.rows).toBeGreaterThan(4)
    expect(seen.rows).toBeLessThan(40)
  })

  test('page CSS cannot reach in, and the control proves the rule applies', async ({ page }) => {
    await setup(page)
    const bg = await page.evaluate(() => {
      const shadow = document.getElementById('s')!.shadowRoot!.querySelector('th')
      const light = document.getElementById('l')!.querySelector('th')
      return {
        shadow: shadow ? getComputedStyle(shadow).backgroundColor : null,
        light: light ? getComputedStyle(light).backgroundColor : null,
      }
    })
    // The fixture's `th { background: fuchsia !important }` hits the light grid...
    expect(bg.light).toBe(FUCHSIA)
    // ...and is stopped at the boundary for the shadow one. That asymmetry is
    // the entire feature.
    expect(bg.shadow).not.toBe(FUCHSIA)
  })

  test('the grid is styled inside the root, from an adopted stylesheet', async ({ page }) => {
    await setup(page)
    const styled = (await inRoot(
      page,
      `const th = r.querySelector('th')
       const cell = r.querySelector('td[data-svgrid-row]')
       return {
         sheets: r.adoptedStyleSheets.length,
         headerWeight: getComputedStyle(th).fontWeight,
         cellBorder: getComputedStyle(cell).borderBottomWidth,
       }`,
    )) as { sheets: number; headerWeight: string; cellBorder: string }
    // Without the adopted sheet the grid renders as an unstyled <table>:
    // default 400 weight and no borders.
    expect(styled.sheets).toBeGreaterThan(0)
    expect(styled.headerWeight).not.toBe('400')
    expect(styled.cellBorder).not.toBe('0px')
  })

  test('sorting works through a header click', async ({ page }) => {
    await setup(page)
    const firstName = () =>
      inRoot(page, `return r.querySelector('td[data-svgrid-row="0"][data-svgrid-col="1"]').innerText.trim()`)
    const box = (await inRoot(
      page,
      `const q = [...r.querySelectorAll('th')][1].getBoundingClientRect()
       return { x: Math.round(q.x + 30), y: Math.round(q.y + q.height / 2) }`,
    )) as { x: number; y: number }

    const before = await firstName()
    // Twice. The fixture's data already arrives in ascending name order, so a
    // single click is indistinguishable from no sort at all.
    await page.mouse.click(box.x, box.y)
    await page.mouse.click(box.x, box.y)
    await expect.poll(firstName).not.toBe(before)
  })

  test('a popup that portals to document.body is still styled', async ({ page }) => {
    await setup(page)
    // The list editor's panel leaves the shadow root on purpose, to escape
    // every ancestor overflow. Out there only the document copy of the CSS can
    // reach it - which is why the build injects into head as well as the root.
    const cell = (await inRoot(
      page,
      `const q = r.querySelector('td[data-svgrid-row="1"][data-svgrid-col="2"]').getBoundingClientRect()
       return { x: Math.round(q.x + q.width / 2), y: Math.round(q.y + q.height / 2) }`,
    )) as { x: number; y: number }
    await page.mouse.dblclick(cell.x, cell.y)

    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              [...document.querySelectorAll('.sv-grid-dropdown-panel')].filter(
                (e) => e.getRootNode() === document,
              ).length,
          ),
        { timeout: 10_000 },
      )
      .toBe(1)

    const panel = await page.evaluate(() => {
      const el = [...document.querySelectorAll('.sv-grid-dropdown-panel')].find(
        (e) => e.getRootNode() === document,
      )!
      return {
        options: el.querySelectorAll('.sv-grid-dropdown-option').length,
        border: getComputedStyle(el).borderTopWidth,
        bg: getComputedStyle(el).backgroundColor,
      }
    })
    expect(panel.options).toBeGreaterThan(0)
    // Unstyled would be a 0px border on a transparent ground.
    expect(panel.border).not.toBe('0px')
    expect(panel.bg).not.toBe('rgba(0, 0, 0, 0)')
  })

  test('events cross the boundary to a listener on the host', async ({ page }) => {
    await setup(page)
    // `composed: true` on the CustomEvent is what buys this. Without it the
    // event stops at the shadow boundary and the host page never hears it.
    const cell = (await inRoot(
      page,
      `const q = r.querySelector('td[data-svgrid-row="3"][data-svgrid-col="1"]').getBoundingClientRect()
       return { x: Math.round(q.x + q.width / 2), y: Math.round(q.y + q.height / 2) }`,
    )) as { x: number; y: number }
    await page.mouse.click(cell.x, cell.y)
    await expect
      .poll(() => page.evaluate(() => (window as never as { __events: unknown[] }).__events.length))
      .toBeGreaterThan(0)
    const kinds = await page.evaluate(() =>
      (window as never as { __events: [string][] }).__events.map((e) => e[0]),
    )
    expect(kinds).toContain('rowclick')
  })

  test('two elements on one page share one stylesheet and one <style>', async ({ page }) => {
    await setup(page)
    expect(
      await page.evaluate(() => ({
        // One constructable sheet, reused by every root.
        sheet: !!(globalThis as { __SVGRID_WC_SHEET__?: unknown }).__SVGRID_WC_SHEET__,
        headStyles: document.querySelectorAll('style[data-svgrid-grid-wc]').length,
      })),
    ).toEqual({ sheet: true, headStyles: 1 })
  })
})
