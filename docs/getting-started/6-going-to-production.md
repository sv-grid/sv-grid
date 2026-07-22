# 6. Going to production

> Step 6 of 6 · [← Theme and density](./5-theme-and-density.md)

You have a working grid. This page is the checklist that turns it into
something you'd ship.

## 1. Server-side data

For datasets that don't fit in memory, drive the grid from the server.
Pair `externalSort` + `externalFilter` with the corresponding callbacks
so the grid records the user's intent but doesn't try to re-order rows
it didn't fetch.

```svelte
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature,
           columnFilteringFeature } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  let sort    = $state<Array<{ id: string; desc: boolean }>>([])
  let filters = $state<Array<{ id: string; operator: string; value: string }>>([])
  let page    = $state(0)
  const pageSize = 50

  let rows    = $state<Person[]>([])
  let total   = $state(0)
  let loading = $state(false)
  let controller: AbortController | null = null

  async function load() {
    controller?.abort()
    controller = new AbortController()
    loading = true
    try {
      const res = await fetch('/api/people?' + new URLSearchParams({
        sort:    JSON.stringify(sort),
        filters: JSON.stringify(filters),
        page:    String(page),
        size:    String(pageSize),
      }), { signal: controller.signal })
      const body = await res.json()
      rows  = body.rows
      total = body.total
    } catch (err) {
      if ((err as Error).name !== 'AbortError') throw err
    } finally {
      loading = false
    }
  }

  $effect(() => { sort; filters; page; load() })
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  filterMode="menu"
  externalSort={true}
  externalFilter={true}
  showPagination={false}
  onSortingChange={(next) => { sort = next; page = 0 }}
  onFiltersChange={(next) => { filters = next.columns; page = 0 }}
/>
```

The [`09-server-side` demo](../../examples/src/demos/09-server-side.svelte)
has the full runnable version with debounce + abort + a 60 ms mock
latency. The [server-side guide](../help/server-side-data.md) covers
sparse infinite scroll, velocity-aware chunk loading, and
backpressure.

<div data-docs-demo="09-server-side" data-height="520"></div>

## 2. Virtualization for large datasets

For more than ~2k rows, enable row virtualization. For very wide grids
(50+ columns) also enable column virtualization. Both are opt-in so
small grids don't pay the cost.

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  virtualization={true}
  columnVirtualization={true}
  overscan={8}
  columnOverscan={3}
  rowHeight={32}
  containerHeight={600}
/>
```

The wrapper's row + column virtualizers handle variable row heights via
the headless `createSvelteVirtualizer` / `createColumnVirtualizer`. See
[demo 06](../../examples/src/demos/06-large-dataset.svelte) for 100k
rows × 100 columns with smooth scroll.

<div data-docs-demo="06-large-dataset" data-height="520"></div>

## 3. Accessibility

The grid implements the WAI-ARIA 1.2 grid pattern out of the box. Every
node has the right role, the active cell carries focus, the keyboard
map matches what assistive tech expects.

You don't need to add anything for a baseline accessible grid. To go
further:

- Add `aria-live` announcements for changes outside the grid (filter
  applied, X rows selected) - see [demo 17](../../examples/src/demos/17-accessibility.svelte).
- Toggle a high-contrast focus outline for users who need it -
  also in demo 17.
- Read [Accessibility](../help/accessibility.md) for the WCAG 2.1 AA
  mapping, forced-colors-mode behaviour, and reduced-motion handling.

<div data-docs-demo="17-accessibility" data-height="500"></div>

## 4. SSR-friendly markup

The render component produces meaningful HTML before hydration. In a
SvelteKit `+page.server.ts` load, the grid's markup hits the browser
already filled with data - first paint shows the table, hydration only
attaches event listeners.

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature } from '@svgrid/grid'
  let { data } = $props()
</script>

<SvGrid
  data={data.rows}
  columns={columns}
  features={tableFeatures({ rowSortingFeature })}
/>
```

[Demo 19 - SSR](../../examples/src/demos/19-ssr.svelte) takes a
sandboxed pre-hydration snapshot in a JS-disabled iframe to prove the
markup is meaningful before JS runs.

## 5. Content Security Policy

SvGrid runs cleanly under a strict CSP - no `eval`, no `new Function`,
no inline scripts, no inline event handlers. The recommended header:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self' data:;
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

Note: no `'unsafe-eval'` and no `'unsafe-inline'` on `script-src`.
[Demo 16 - CSP-compliant](../../examples/src/demos/16-csp-compliant.svelte)
runs a live runtime self-check + a violation listener inside a working
grid.

## 6. TypeScript notes

```ts
import type {
  ColumnDef,
  SvGridApi,
  SortingState,
  TableFeatures,
} from '@svgrid/grid'

// 1. Constrain ColumnDef to your row type so editors and accessors stay typed.
type Row = { id: string; firstName: string; age: number }
const columns: ColumnDef<{}, Row>[] = [
  { field: 'firstName', header: 'First' },   // OK
  { field: 'middleName', header: 'Mid' },    // ✗ "middleName" not on Row
]

// 2. The api type matches your features + row type.
let api = $state<SvGridApi<typeof features, Row> | null>(null)
```

The features generic on `ColumnDef` is the type of the `features`
object - `tableFeatures({ rowSortingFeature })` produces a different
type than `tableFeatures({})`. Pass `typeof features` so column-level
inference picks up which capabilities your grid has.

## 7. What's next

- [Why headless?](../why-headless.md) - the layered architecture and
  when to drop down to the headless core.
- [Enterprise features](../enterprise/README.md) - export, import, AI, pivot.
- [Help index](../help/index.md) - the topic-page catalogue.
- [Recipes](../help/recipes.md) - 20+ copy-paste patterns.
- [How SvGrid compares](../help/comparison.md) - what
  evaluators read.
- [Missing features](../help/missing-features.md) - the honest gap list.
