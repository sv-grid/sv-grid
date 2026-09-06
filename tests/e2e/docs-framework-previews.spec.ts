import { test, expect, type Page, type Locator } from '@playwright/test'

/**
 * The running grids above each listing on the React / Vue / Angular doc pages.
 *
 * Those pages used to be code and nothing else. Each section now leads with a
 * live grid - `packages/grid-wc/examples/svelte/<recipe>`, mounted through the
 * same `GridBody` the custom element renders - so a reader sees the feature
 * work before deciding whether to open the project.
 *
 * That promise is only worth making if the previews actually run, and the
 * failure is quiet: an empty frame, or a grid that renders but whose buttons do
 * nothing. `tools/framework-examples.test.ts` proves each placeholder RESOLVES;
 * nothing but a browser proves it WORKS.
 *
 * It has already earned this: writing it found `{ ...c, summary: 'sum' }` in
 * the grouping recipe, in all four copies. `summary` is the grid's footer
 * summary row - a different feature, off unless you ask for it - so the
 * "aggregate in the group row" the prose promised had never rendered, in any
 * framework, and every compiler and type-check in the repo was happy with it.
 */
const PAGES = ['react', 'vue', 'angular'] as const

const RECIPES = [
  'basic',
  'sorting-filtering',
  'editing',
  'selection',
  'grouping',
  'pagination',
  'server-data',
  'theming',
  'enterprise',
] as const

const url = (page: string) => `/sv-grid/docs/help/web-components/${page}`

/**
 * Scroll a preview into range and wait for its grid.
 *
 * They mount lazily - one IntersectionObserver drives every embed on the page,
 * with the article's own scroller as the root - so a preview below the fold has
 * not been asked for yet and never will be until something scrolls to it.
 */
async function preview(page: Page, recipe: string): Promise<Locator> {
  const host = page.locator(`[data-docs-mirror="${recipe}"]`)
  await host.scrollIntoViewIfNeeded()
  await expect(host.locator('.sv-grid-root').first()).toBeAttached({ timeout: 20_000 })
  await expect(host.locator('[role="gridcell"]').first()).toBeVisible({ timeout: 20_000 })
  // Wait for rows before touching anything. Each preview is its own lazy chunk,
  // and on a cold dev server the grid paints a first pass and then measures -
  // clicking into that window looked like a broken Next button when the first
  // run of this file hit it.
  await expect
    .poll(async () => host.locator('[role="row"]').count(), { timeout: 20_000 })
    .toBeGreaterThan(1)
  return host
}

/** Open a framework page and wait for its generated section to be in the DOM. */
async function open(page: Page, fw: string) {
  await page.goto(url(fw))
  await expect(page.locator('[data-docs-mirror]').first()).toBeAttached({ timeout: 20_000 })
}

for (const fw of PAGES) {
  test(`${fw}: every listing has a grid running above it`, async ({ page }) => {
    // Nine lazy chunks, mounted one at a time as the page is scrolled. That is
    // more work than the default per-test budget assumes, and on a cold dev
    // server it overran it - which reads as a broken preview rather than as
    // what it is.
    test.slow()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))

    await open(page, fw)

    // The count is asserted first: a page that lost its generated section would
    // otherwise pass this test by having nothing to check.
    await expect(page.locator('[data-docs-mirror]')).toHaveCount(RECIPES.length)

    for (const recipe of RECIPES) {
      const host = await preview(page, recipe)
      await expect(host.locator('.docs-demo-missing'), `${recipe} failed to mount`).toHaveCount(0)

      // The grid must fit the card it is in. The card is `overflow: hidden`, so
      // a grid wider than its frame is not scrolled, it is CUT - the last
      // column sliced down the middle at the card's edge, and worse the
      // narrower the window. That is what shipped the first time: a wrapper
      // named `class="grid"` inherited Tailwind's `.grid { display: grid }` and
      // its min-content child blew the width out. Every other check passed.
      const fit = await host.evaluate((el) => {
        const frame = el.querySelector('.docs-demo-frame') as HTMLElement
        const root = el.querySelector('.sv-grid-root') as HTMLElement
        return {
          frame: frame.clientWidth,
          root: Math.round(root.getBoundingClientRect().width),
        }
      })
      expect(
        fit.root,
        `${recipe} overflows its card by ${fit.root - fit.frame}px`,
      ).toBeLessThanOrEqual(fit.frame)
      // Each preview is followed by the code it renders, and by the button that
      // opens that code as a project. A preview captioned with a different
      // recipe's listing is the one failure this whole idea has to avoid.
      await expect(page.locator(`[data-docs-sandbox="${fw}:${recipe}"]`)).toHaveCount(1)
    }

    expect(errors, `page errors on ${fw}.md`).toEqual([])
  })
}

/**
 * The interactive half, on one page - the previews are byte-identical across
 * the three, so running these three times would only buy runtime.
 *
 * Every assertion here is about a value reaching the HOST and coming back out
 * as rendered text: that is the part a code listing cannot show, and the part
 * the wrappers exist to make work.
 */
test.describe('the previews are interactive', () => {
  test.beforeEach(async ({ page }) => {
    await open(page, 'react')
  })

  test('sorting reports the sort back to the host', async ({ page }) => {
    const host = await preview(page, 'sorting-filtering')
    const note = host.locator('p').first()
    await expect(note).toContainText('nothing yet')
    await host.locator('[role="columnheader"]').filter({ hasText: 'Name' }).first().click()
    await expect(note).toContainText('name asc')
  })

  test('selection hands the rows over, not just their ids', async ({ page }) => {
    const host = await preview(page, 'selection')
    const note = host.locator('p').first()
    await expect(note).toContainText('Tick some rows')
    // The checkbox is a button[role=checkbox], not an <input>.
    await host.locator('button.sv-grid-checkbox').nth(1).click()
    // A currency total can only be computed from the row objects, so this also
    // proves `rowselectionchange` carries them.
    await expect(note).toContainText(/1 selected · \$[\d,]+/)
  })

  test('an edit reaches the host and is written back', async ({ page }) => {
    const host = await preview(page, 'editing')
    await host.locator('[role="gridcell"]').filter({ hasText: 'Ada' }).first().dblclick()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('Edited Name')
    await page.keyboard.press('Enter')
    await expect(host.locator('p').first()).toContainText('name = Edited Name')
  })

  test('grouping aggregates into the group row and nests', async ({ page }) => {
    const host = await preview(page, 'grouping')
    const grid = host.locator('.sv-grid-root').first()
    // The bug this test was written from: with `summary` instead of
    // `aggregate` the group row said "50 rows" and nothing else.
    await expect(grid).toContainText(/Amount \$[\d,]+/)

    // Row COUNT is no signal here - groups start collapsed, so one level and
    // two look identical until something is expanded.
    await host.locator('button', { hasText: 'team + country' }).first().click()
    await host.locator('.sv-grid-group-row [aria-expanded], .sv-grid-group-row button').first().click()
    await expect(grid).toContainText('Country:')
  })

  test('a theme change repaints the grid', async ({ page }) => {
    const host = await preview(page, 'theming')
    // --sg-* are inherited custom properties, so they land on the app root and
    // reach the cells; .sv-grid-root itself is transparent, and reading its
    // background would report no change however well the theming worked.
    const colour = () =>
      host.locator('[role="gridcell"]').first().evaluate((el) => getComputedStyle(el).color)
    const before = await colour()
    await host.locator('button', { hasText: 'Dark' }).first().click()
    await expect.poll(colour).not.toBe(before)
  })

  test('paging asks the host for the next page', async ({ page }) => {
    const host = await preview(page, 'server-data')
    const firstCell = host.locator('[role="gridcell"]').first()
    await expect(firstCell).toHaveText('1')
    await host.locator('button[aria-label="Next page"]').first().click()
    // 26, not 2: the host sliced a new page and handed it back, which is the
    // whole point of externalPagination.
    await expect(firstCell).toHaveText('26')
  })

  test('the enterprise export waits for apiready', async ({ page }) => {
    const host = await preview(page, 'enterprise')
    // Disabled until the api arrives, so an enabled button proves the event
    // fired and its detail reached the host.
    await expect(host.locator('button').first()).toBeEnabled()
  })
})
