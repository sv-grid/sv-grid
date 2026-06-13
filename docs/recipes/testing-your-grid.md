# Testing your grid

Three strategies for testing a grid in your app. Pick the strategy
that matches the question you're answering.

## TL;DR

| Strategy            | Runner                            | Use for                                      | Cost           |
| ------------------- | --------------------------------- | -------------------------------------------- | -------------- |
| **Unit**            | Vitest                            | Reducer / aggregator / pivot logic           | < 1ms / test   |
| **Component**       | @testing-library/svelte + jsdom   | Mount-time behavior, ARIA, custom renderers  | 5-25ms / test  |
| **E2E**             | Playwright                        | Real browser, scrolling, downloads, screens  | 0.5-2s / test  |

The repo ships all three: vitest config in
`packages/sv-grid-community/vitest.config.ts`, component tests in
`*.behavior.test.ts` files, Playwright specs in `examples/e2e/*.spec.ts`.

## Strategy 1 - Vitest unit

Mock no DOM. Drive the engine directly via `createSvGrid` and assert
on the row model. Fastest, smallest blast radius - perfect for pure
logic (aggregators, custom filter fns, pivot models).

```ts
import { describe, it, expect } from 'vitest'
import {
  createSvGrid,
  createCoreRowModel,
  createSortedRowModel,
  tableFeatures,
  rowSortingFeature,
} from 'sv-grid-community'

const features = tableFeatures({ rowSortingFeature })

describe('row sorting', () => {
  it('sorts rows desc on api call', () => {
    type Row = { x: number }
    const data: Row[] = [{ x: 1 }, { x: 3 }, { x: 2 }]
    let sorting: Array<{ id: string; desc: boolean }> = []

    const table = createSvGrid({
      _features: features,
      _rowModels: {
        coreRowModel:   createCoreRowModel<Row>(),
        sortedRowModel: createSortedRowModel<Row>(),
      },
      data,
      columns: [{ field: 'x' }],
      state: { sorting },
      onSortingChange: (u) => {
        sorting = typeof u === 'function' ? (u as (s: typeof sorting) => typeof sorting)(sorting) : u
      },
      enableSorting: true,
    } as never)

    table.setSorting([{ id: 'x', desc: true }])
    const rows = table.getRowModel().rows.map((r) => (r.original as Row).x)
    expect(rows).toEqual([3, 2, 1])
  })
})
```

Notes:
- `_rowModels` must be passed explicitly when bypassing `<SvGrid>` -
  the component wires them for you, the headless path doesn't.

## Strategy 2 - Component (testing-library)

Mount the real `<SvGrid>` component into jsdom. Assert on accessible
names, roles, `aria-sort`, etc. This is where you catch
regressions in custom cell renderers and headers.

```ts
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import { SvGrid, tableFeatures, rowSortingFeature } from 'sv-grid-community'

const features = tableFeatures({ rowSortingFeature })

describe('<SvGrid> header', () => {
  it('toggles aria-sort on column-header click', async () => {
    const props = {
      data: [{ x: 1 }, { x: 3 }, { x: 2 }],
      columns: [{ field: 'x', header: 'X' }],
      features,
    }
    render(SvGrid, props)
    const header = screen.getByRole('columnheader', { name: /X/ })
    expect(header).toHaveAttribute('aria-sort', 'none')
    await fireEvent.click(header)
    expect(header).toHaveAttribute('aria-sort', 'ascending')
  })
})
```

Notes:
- jsdom doesn't implement `ResizeObserver` or layout - so virtualisation
  numbers aren't realistic here. Component tests are about *behavior*,
  not perf.
- For ARIA assertions, lean on `@testing-library/jest-dom` matchers.

## Strategy 3 - Playwright E2E

Drive a real Chromium / WebKit / Firefox. Cover the things only a real
browser does correctly: scrolling, downloads, screenshots, multi-tab.

```ts
import { test, expect } from '@playwright/test'

test('large dataset paints the last row after scroll', async ({ page }) => {
  await page.goto('/demos/06-large-dataset')
  await expect(page.getByRole('grid')).toBeVisible()
  await page.locator('.sv-grid-body').evaluate((el) => {
    (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight
  })
  await expect(page.getByText('Row 99999')).toBeVisible()
  await page.screenshot({ path: 'large-dataset-bottom.png' })
})

test('export button downloads xlsx', async ({ page }) => {
  await page.goto('/demos/21-export-and-print')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Export Excel/ }).click(),
  ])
  expect(download.suggestedFilename()).toContain('.xlsx')
})
```

Notes:
- Run `npx playwright install` once to pull the browsers.
- Use trace viewer (`--trace on`) when a test flakes - usually it's a
  missing `await page.waitForLoadState('networkidle')`.

## Picking by question

| Question                                                          | Strategy   |
| ----------------------------------------------------------------- | ---------- |
| Does my custom `cell:` function return the right value?           | Unit       |
| Does my `createPivotModel` config produce the right subtotals?    | Unit       |
| Does clicking the header set `aria-sort`?                         | Component  |
| Does my snippet render the badge for `status === 'overdue'`?      | Component  |
| Does scroll-to-bottom paint the last row of 100k?                 | E2E        |
| Does Export download an actual `.xlsx`?                           | E2E        |
| Does the grid still look right on a real laptop in Safari?        | E2E        |

## See also

- [`packages/sv-grid-community/vitest.config.ts`](https://github.com/sv-grid/sv-grid/blob/main/packages/sv-grid-community/vitest.config.ts) - the live config
- [`*.behavior.test.ts` files](https://github.com/sv-grid/sv-grid/tree/main/packages/sv-grid-community/src) - component-test examples
- [`examples/e2e/`](https://github.com/sv-grid/sv-grid/tree/main/examples/e2e) - Playwright specs
- [Architecture overview](../help/architecture.md) - what's headless vs what's rendered
