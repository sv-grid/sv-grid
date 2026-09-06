import { test, expect, type Page } from '@playwright/test'

/**
 * The React and Vue wrappers, driven as real apps built by vite against the
 * BUILT wrappers.
 *
 * Not jsdom, and not a unit test: what these wrappers exist to fix is how each
 * framework hands an object prop to a custom element, and when it does so
 * relative to the element's own upgrade. jsdom has neither behaviour. This
 * suite already earned its keep - it caught the element throwing when it
 * renders before `columns` is assigned, which is precisely the order React and
 * Angular produce and which no HTML fixture reproduces.
 *
 * Angular is covered by `packages/grid-wc/test/angular.test.ts` instead:
 * consuming a partial-Ivy library needs the Angular linker, so a vite-built
 * fixture cannot load it. That test asserts the compiled bundle's inputs and
 * outputs, which is where an Angular wrapper's correctness actually lives.
 */
const APPS = ['react', 'vue'] as const

const url = (app: string) => `http://localhost:4206/${app}/index.html`

async function setup(page: Page, app: string) {
  await page.goto(url(app), { waitUntil: 'load' })
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Set(
              [...document.querySelectorAll('td[data-svgrid-row]')].map(
                (c) => (c as HTMLElement).dataset.svgridRow,
              ),
            ).size,
        ),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0)
}

for (const app of APPS) {
  test.describe(`${app} wrapper`, () => {
    test('renders a working grid', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(String(e)))
      await setup(page, app)

      const seen = await page.evaluate(() => ({
        rows: new Set(
          [...document.querySelectorAll('td[data-svgrid-row]')].map(
            (c) => (c as HTMLElement).dataset.svgridRow,
          ),
        ).size,
        cols: document.querySelectorAll('thead th').length,
      }))
      // 40 rows of data in a 420px box: some rendered, not all.
      expect(seen.rows).toBeGreaterThan(4)
      expect(seen.rows).toBeLessThan(40)
      // 4 columns + the row-number gutter that `showRowNumbers` adds.
      expect(seen.cols).toBeGreaterThan(4)
      expect(errors).toEqual([])
    })

    test('object props arrive as properties, not stringified attributes', async ({ page }) => {
      await setup(page, app)
      // The whole reason the React wrapper exists: React <=18 assigns object
      // props to ATTRIBUTES, so `columns` becomes the string "[object Object]"
      // and the grid renders empty.
      expect(
        await page.evaluate(() => {
          const el = document.querySelector('sv-grid') as (HTMLElement & {
            columns?: unknown
            data?: unknown
          }) | null
          return {
            columnsIsArray: Array.isArray(el?.columns),
            dataIsArray: Array.isArray(el?.data),
            columnsAttr: el?.getAttribute('columns'),
          }
        }),
      ).toEqual({ columnsIsArray: true, dataIsArray: true, columnsAttr: null })
    })

    test('the element survives mounting before its props are assigned', async ({ page }) => {
      // Both frameworks create the element first and assign properties in an
      // effect, so the grid renders once with nothing. It used to throw
      // "Cannot read properties of undefined (reading 'map')" there and render
      // nothing at all, forever.
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
      await setup(page, app)
      expect(errors).toEqual([])
      expect(await page.evaluate(() => document.querySelectorAll('.sv-grid-root').length)).toBe(1)
    })

    test('a prop change from framework state reaches the grid', async ({ page }) => {
      await setup(page, app)
      // Grouping is switched on through the framework's own state, which is
      // the path a rebuilt-object-every-render wrapper gets wrong.
      await page.evaluate(() => (window as never as { __group: () => void }).__group())
      await expect.poll(() => page.evaluate(() => document.body.innerText)).toContain('City: Sofia')
      expect(
        await page.evaluate(
          () => (document.querySelector('sv-grid') as HTMLElement & { groupBy?: string[] })?.groupBy,
        ),
      ).toEqual(['city'])
    })

    test('events reach a handler prop', async ({ page }) => {
      await setup(page, app)
      const cell = await page.evaluate(() => {
        const c = document.querySelector('td[data-svgrid-row="2"][data-svgrid-col="2"]')!
        const r = c.getBoundingClientRect()
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
      })
      await page.mouse.click(cell.x, cell.y)
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as never as { __events: [string][] }).__events.filter(
                (e) => e[0] === 'rowclick',
              ).length,
          ),
        )
        .toBeGreaterThan(0)
    })

    test('a parent re-render that changes nothing touches nothing', async ({ page }) => {
      await setup(page, app)
      // A wrapper whose effects have no dependency array reassigns all 98
      // properties and rebinds all 20 listeners on every render of the parent -
      // so a keystroke somewhere else in the app hands the grid 98 fresh values
      // and 40 listener mutations. Invisible from outside, which is why it
      // needs measuring rather than eyeballing.
      await page.evaluate(() => {
        const el = document.querySelector('sv-grid') as HTMLElement & Record<string, unknown>
        const w = window as never as Record<string, number>
        w.__adds = 0
        w.__removes = 0
        w.__writes = 0
        const add = el.addEventListener.bind(el)
        const rem = el.removeEventListener.bind(el)
        el.addEventListener = ((...a: Parameters<typeof add>) => {
          w.__adds++
          return add(...a)
        }) as typeof el.addEventListener
        el.removeEventListener = ((...a: Parameters<typeof rem>) => {
          w.__removes++
          return rem(...a)
        }) as typeof el.removeEventListener
        for (const name of ['columns', 'data', 'showRowNumbers']) {
          let v = el[name]
          Object.defineProperty(el, name, {
            configurable: true,
            get: () => v,
            set: (nv) => {
              w.__writes++
              v = nv
            },
          })
        }
      })

      for (let i = 0; i < 20; i++)
        await page.evaluate(() => (window as never as { __rerender?: () => void }).__rerender?.())
      await page.waitForTimeout(400)

      const churn = await page.evaluate(() => {
        const w = window as never as Record<string, number>
        return { adds: w.__adds, removes: w.__removes, writes: w.__writes }
      })
      expect(churn).toEqual({ adds: 0, removes: 0, writes: 0 })
    })

    test('apiready is delivered even though it fires before the wrapper binds', async ({ page }) => {
      await setup(page, app)
      // It is a one-shot event dispatched during the element's own mount. The
      // element parks the handle on itself and each wrapper replays it, rather
      // than relying on winning a race - which React loses.
      expect(
        await page.evaluate(() =>
          (window as never as { __events: [string][] }).__events.some((e) => e[0] === 'apiready'),
        ),
      ).toBe(true)
      expect(await page.evaluate(() => typeof (window as never as { __api: () => unknown }).__api())).toBe(
        'object',
      )
    })
  })
}
