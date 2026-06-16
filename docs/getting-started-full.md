# Getting Started with SvGrid

SvGrid is a modern, production-ready data grid for Svelte 5 - a headless
core engine paired with a Svelte render component
(`<SvGrid>`). It scales from a 10-row read-only table to a virtualized
100,000-row, 100-column editing surface with grouping, multi-column
filtering, server-side data, and full keyboard and screen-reader
support.

This page walks you from `pnpm add` to a feature-complete grid. It is
the canonical entry point - every other page in the documentation
assumes you've finished this one. Estimated reading time: 15 minutes.

> **New here?** Two short companion reads:
>
> - [Why headless?](./why-headless.md) - the architecture decision
>   behind the `createSvGrid` core vs. the `<SvGrid>` renderer.
> - [Tailwind integration](./help/tailwind.md) - how `--sg-*` custom
>   properties + Tailwind v4 + dark mode fit together.

> `@svgrid/grid` is published under the **MIT License** - permissive
> for commercial use, redistribution, and modification. The paid companion
> `@svgrid/enterprise` (data export + print) ships under a separate commercial
> license. See [LICENSE](../LICENSE) and
> [packages/enterprise/LICENSE](../packages/enterprise/LICENSE).

---

## Contents

1. [Your first grid in 60 seconds](#1-your-first-grid-in-60-seconds)
2. [Install the package](#2-install-the-package)
3. [Provide row data](#3-provide-row-data)
4. [Define column definitions](#4-define-column-definitions)
5. [Register features (row models)](#5-register-features-row-models)
6. [Styling: theme, density, dark mode](#6-styling-theme-density-dark-mode)
7. [Sizing the grid](#7-sizing-the-grid)
8. [Custom cells with FlexRender](#8-custom-cells-with-flexrender)
9. [Sorting, filtering, pagination](#9-sorting-filtering-pagination)
10. [Selection, editing, keyboard](#10-selection-editing-keyboard)
11. [Server-side data](#11-server-side-data)
12. [Virtualization for large datasets](#12-virtualization-for-large-datasets)
13. [Accessibility](#13-accessibility)
14. [TypeScript notes](#14-typescript-notes)
15. [What's next](#15-whats-next)

---

## 1. Your first grid in 60 seconds

```svelte
<script lang="ts">
  import { SvGrid, type ColumnDef } from '@svgrid/grid'

  type Person = { firstName: string; age: number; status: string }

  const rows: Person[] = [
    { firstName: 'Ada',   age: 36, status: 'active' },
    { firstName: 'Linus', age: 54, status: 'active' },
    { firstName: 'Grace', age: 85, status: 'inactive' },
  ]

  const columns: ColumnDef<{}, Person>[] = [
    { field: 'firstName', header: 'First name' },
    { field: 'age',       header: 'Age' },
    { field: 'status',    header: 'Status' },
  ]
</script>

<SvGrid data={rows} columns={columns} />
```

That's a complete, working grid. The rest of this page is about turning
it into something you'd ship.

---

## 2. Install the package

SvGrid is a single npm package. There is no peer dependency on a CSS
framework - bring your own, or use the bundled stylesheet.

```bash
# pnpm (recommended)
pnpm add @svgrid/grid

# npm
npm install @svgrid/grid

# yarn
yarn add @svgrid/grid
```

**Requirements.**

- Svelte **5.x** (uses runes - `$state`, `$derived`, `$effect`).
- TypeScript **5.4+** (optional but recommended).
- Node **18+** for tooling.

Once installed, import the component, the features you want, and the
matching `ColumnDef` type:

```ts
import {
  SvGrid,
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  type ColumnDef,
} from '@svgrid/grid'
```

The bundle is tree-shakeable - features you don't import don't ship. The
default render component (`<SvGrid>`) brings its own scoped CSS, so
there's no separate stylesheet to import. Re-theming happens via the
`--sg-*` custom-property surface; see
[Tailwind integration](./help/tailwind.md) for the full list.

---

## 3. Provide row data

SvGrid is data-agnostic. The `data` prop is any
`ReadonlyArray<TRow>` - a Svelte 5 `$state` array, a derived store, an
SWR/React-query-style cache, the result of a `+page.ts` load function,
or a plain literal.

```svelte
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'

  type Person = { id: string; firstName: string; age: number }

  // Reactive: pushing into `rows` updates the grid automatically.
  let rows = $state<Person[]>([
    { id: '1', firstName: 'Ada',   age: 36 },
    { id: '2', firstName: 'Linus', age: 54 },
  ])

  function addRow() {
    rows.push({ id: crypto.randomUUID(), firstName: 'New', age: 0 })
  }
</script>

<button onclick={addRow}>Add row</button>
<SvGrid data={rows} columns={columns} />
```

**Identity.** Today the wrapper uses the row's array index as its id.
That is fine for read-only data; if you mutate `rows`, prefer keeping
the same object references for rows that didn't change so selection
and edit state line up. A `getRowId` prop on the wrapper is tracked in
[Missing features](./help/missing-features.md) and supported by the
headless `createSvGrid` core today.

**Immutability.** SvGrid never mutates your data. When you edit a cell
the grid emits an event; you decide whether to mutate in place or copy.
See [§10 - Editing](#10-selection-editing-keyboard).

---

## 4. Define column definitions

A column definition tells SvGrid how to read a value out of a row, how
to render it, and which features apply to it.

```ts
import type { ColumnDef } from '@svgrid/grid'

type Person = {
  id: string
  firstName: string
  lastName: string
  age: number
  joinedAt: string // ISO date
  salary: number
  active: boolean
}

const columns: ColumnDef<{}, Person>[] = [
  // Simple accessor by key
  { field: 'firstName', header: 'First name' },

  // Computed accessor
  {
    id: 'fullName',
    header: 'Full name',
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
  },

  // Numeric with locale-aware formatting
  {
    field: 'age',
    header: 'Age',
    format: { type: 'number', options: { maximumFractionDigits: 0 } },
  },

  // Date with explicit pattern
  {
    field: 'joinedAt',
    header: 'Joined',
    format: { type: 'date', pattern: 'y-m-d' },
  },

  // Currency
  {
    field: 'salary',
    header: 'Salary',
    format: { type: 'currency', currency: 'USD' },
  },

  // Boolean rendered as a checkbox
  {
    field: 'active',
    header: 'Active',
    editorType: 'checkbox',
  },
]
```

**Common properties.**

| Property | Purpose |
| --- | --- |
| `field` | Reads `row[key]`. |
| `accessorFn` | Computes the value from the row. |
| `id` | Stable column id (required if you use `accessorFn`). |
| `header` | String or render snippet for the header. |
| `footer` | String or render snippet for the footer row. |
| `cell` | Render snippet/component for the body cell. |
| `format` | Locale-aware formatter (`number`, `currency`, `percent`, `date`). |
| `formatter` | Function for one-off custom value formatting. |
| `editorType` | Inline editor: `text` \| `number` \| `checkbox` \| `date` \| `datetime`. |
| `width` | Initial column width in pixels (default `columnWidth` prop). |
| `align` | Header + body alignment: `'left'` \| `'right'` \| `'center'`. Inferred from `editorType` when omitted. |
| `columns` | Child column defs (for column groups). |

Sorting / filtering / grouping are toggled per-grid via the registered
features - there is no per-column `enableSorting` / `enableColumnFilter`
flag yet; those entries are in [Missing features](./help/missing-features.md).

See [`packages/grid/src/core.ts`](../packages/grid/src/core.ts)
for the full type.

---

## 5. Register features (row models)

The grid engine is feature-gated. Out of the box you get the **core row
model** (the rows in their original order). To enable sorting,
filtering, grouping, expansion, pagination, or selection you opt in
with `tableFeatures(...)` and the matching `create*RowModel` factory.

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  showPagination={true}
  pageSize={25}
/>
```

**Rule of thumb.** Only register the features you use. The wrapper wires
the matching row-model pipeline (core → filtered → sorted → grouped →
expanded) for you and exposes the user-facing toggles via props
(`showPagination`, `filterMode`, `showRowSelection`, …). If you need the
headless pipeline directly - e.g. a custom renderer - drop down to
`createSvGrid` from the same package; see [Why headless?](./why-headless.md).

| Feature | Factory | What it does |
| --- | --- | --- |
| `rowSortingFeature` | `createSortedRowModel` | Click headers to sort; shift-click for multi-sort. |
| `columnFilteringFeature` | `createFilteredRowModel` | Per-column filters with built-in `filterFns`. |
| `rowPaginationFeature` | `createPaginatedRowModel` | Page slicing + footer state. |
| `rowSelectionFeature` | - | Row checkboxes, range selection, headless API. |
| `columnGroupingFeature` | `createGroupedRowModel` | Group-by-column + aggregators. |
| `rowExpandingFeature` | `createExpandedRowModel` | Tree / master-detail expansion. |

---

## 6. Styling: theme, density, dark mode

SvGrid's render component (`<SvGrid>`) ships its own scoped styles. You
re-theme it by declaring `--sg-*` custom properties at any level above
the grid - the included light, dark, and high-contrast palettes in the
[`10-custom-cells-and-themes`](../examples/src/demos/10-custom-cells-and-themes.svelte)
demo are themselves just three sets of these tokens applied via
`style="--sg-bg: …; --sg-fg: …; …"`.

**Customising tokens.** Override at any level - `:root`, a wrapper, or
directly on `<SvGrid>`.

```css
:root {
  --sg-row-height: 36px;
  --sg-header-bg: #f6f7f9;
  --sg-header-fg: #1f2933;
  --sg-row-hover-bg: #eef2ff;
  --sg-selection-bg: #dbeafe;
  --sg-border: #e5e7eb;
  --sg-focus-ring: 0 0 0 2px #2563eb;
  --sg-font: 'Inter', system-ui, sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --sg-header-bg: #0f172a;
    --sg-header-fg: #f1f5f9;
    --sg-row-hover-bg: #1e293b;
    --sg-border: #334155;
  }
}
```

**Density.** The default theme reads `--sg-row-height`; flip it to
`28px` for compact mode and `48px` for comfortable. Density changes are
applied without remounting the virtualizer.

**Reduced motion.** Sort animations and expand transitions respect
`prefers-reduced-motion: reduce` automatically.

---

## 7. Sizing the grid

`<SvGrid>` fills its parent. Give it a height and it scrolls - without
one, it expands to its content and never virtualises.

```svelte
<!-- Fixed: 600px tall, full width. The typical choice. -->
<div style="height: 600px;">
  <SvGrid data={rows} columns={columns} />
</div>

<!-- Flexible: fills the viewport minus header/footer. -->
<div class="grid-shell">
  <SvGrid data={rows} columns={columns} />
</div>

<style>
  .grid-shell {
    height: calc(100dvh - 4rem);
  }
</style>
```

**Auto-height (small datasets only).** For grids with fewer than ~200
rows you can let the grid grow to its content:

```svelte
<SvGrid data={rows} columns={columns} domLayout="autoHeight" />
```

Auto-height disables row virtualization. Don't use it for large data.

---

## 8. Custom cells with FlexRender

For anything beyond a stringified value, render with `FlexRender`,
`renderComponent`, or `renderSnippet`.

### As a Svelte snippet

```svelte
<script lang="ts">
  import { renderSnippet, type ColumnDef } from '@svgrid/grid'
</script>

{#snippet StatusCell({ value }: { value: string })}
  <span class="pill pill-{value}">{value}</span>
{/snippet}

<script lang="ts">
  const columns: ColumnDef<{}, Person>[] = [
    {
      field: 'status',
      header: 'Status',
      cell: renderSnippet(StatusCell, (ctx) => ({ value: ctx.getValue() as string })),
    },
  ]
</script>
```

### As a Svelte component

```ts
import StatusBadge from './StatusBadge.svelte'
import { renderComponent } from '@svgrid/grid'

const columns = [
  {
    field: 'status',
    header: 'Status',
    cell: renderComponent(StatusBadge, (ctx) => ({ status: ctx.getValue() })),
  },
]
```

`renderComponent` and `renderSnippet` both receive a
`CellContext` so you can read sibling values, mutate state, or call
back into the grid via `ctx.table`.

---

## 9. Sorting, filtering, pagination

Once their features are registered (see §5) the UI affordances appear
automatically. The state is controllable.

**Quick way - capability shortcuts.** Every capability is off by default;
the fastest way to opt in is a boolean shortcut prop, no feature constants
required. `sortable` and `filterable` inject the matching feature for you;
`editable`, `groupable`, and `pageable` alias `enableInlineEditing`,
`showGroupingControls`, and `showPagination`:

```svelte
<SvGrid data={rows} columns={columns} sortable filterable editable groupable pageable />
```

Reach for the explicit `features` set + fine-grained props below when you
need more control (filter mode, page size, per-column opt-outs).

### Uncontrolled (the default)

The wrapper owns sort, filter, pagination, selection, and expansion
state by default. Set the initial page size and which filter UI to
show via props:

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  showPagination={true}
  pageSize={50}
  filterMode="menu"
/>
```

### Observable (callbacks fire when state changes)

The wrapper still owns the state, but emits callbacks on every change.
Use this when an outside piece of UI needs to react (a "X rows
selected" pill, a router that syncs sort to the URL, a server fetch).

```svelte
<script lang="ts">
  let sorting = $state<Array<{ id: string; desc: boolean }>>([])
  let filters = $state<Array<{ id: string; operator: string; value: string }>>([])
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  filterMode="menu"
  onSortingChange={(next) => (sorting = next)}
  onFiltersChange={(next) => (filters = next.columns)}
/>
```

### External (you own row ordering / filtering)

For server-side data or tree-structured data the wrapper records the
sort + filter UI state but does **not** re-order the rows - you do.
Pair `externalSort` / `externalFilter` with the callbacks above:

```svelte
<SvGrid
  data={preFilteredRows}
  columns={columns}
  features={features}
  filterMode="menu"
  externalSort={true}
  externalFilter={true}
  onSortingChange={(next) => fetchPage({ sort: next, page: 0 })}
  onFiltersChange={(next) => fetchPage({ filters: next.columns, page: 0 })}
/>
```

For Excel-style filter operators and the active-filter chip UI, see
[`applyExcelFilter`](../packages/grid/src/filtering/excel-filters.ts).

---

## 10. Selection, editing, keyboard

### Row selection

```svelte
<script lang="ts">
  let selected = $state<Person[]>([])
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  selectionMode="row"
  showRowSelection={true}
  onRowSelectionChange={(_state, rows) => (selected = rows)}
/>

{#if selected.length}
  <p>{selected.length} selected</p>
{/if}
```

`selectionMode` is the umbrella prop: `'row'` shows the checkbox
column, `'cell'` enables click-and-drag range selection,
`'both'` (default) enables both, `'none'` disables both. The
`onRowSelectionChange` callback receives the selection record AND the
materialised row array.

### Cell editing

Set `editorType` on each editable column. The grid handles entry,
commit, and cancel; you handle persistence.

```svelte
<script lang="ts">
  function handleCellEdit(event: {
    rowId: string
    columnId: string
    value: unknown
  }) {
    const row = rows.find((r) => r.id === event.rowId)
    if (!row) return
    ;(row as Record<string, unknown>)[event.columnId] = event.value
  }
</script>

<SvGrid
  data={rows}
  columns={columns}
  getRowId={(row) => row.id}
  onCellValueChange={handleCellEdit}
/>
```

### Keyboard

The grid follows the WAI-ARIA grid pattern:

| Keys | Action |
| --- | --- |
| `←` `↑` `→` `↓` | Move active cell |
| `Home` / `End` | First / last column of the row |
| `Ctrl+Home` / `Ctrl+End` | First / last cell of the grid |
| `PageUp` / `PageDown` | Move one viewport |
| `Shift + <move>` | Extend cell-range selection |
| `Space` | Toggle row selection (when selection enabled) |
| `Enter` / `F2` | Begin editing the active cell |
| `Esc` | Cancel edit / clear selection |
| `Ctrl/Cmd + C` | Copy selection as TSV |
| `Ctrl/Cmd + V` | Paste TSV into selection |

If you implement your own header or toolbar, route keys through
`getKeyboardIntent` and `getNextActiveCell` so behaviour stays
consistent.

---

## 11. Server-side data

For datasets that don't fit in memory, drive the grid from the server.
The pattern is: turn the wrapper's `onSortingChange` /
`onFiltersChange` callbacks into a query, fetch, hand the page back as
`data`, and use the `externalSort` + `externalFilter` props so the grid
doesn't try to re-order rows it didn't fetch.

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

<nav>
  <button onclick={() => (page = Math.max(0, page - 1))}
          disabled={page === 0 || loading}>‹ Prev</button>
  <span>Page {page + 1} of {Math.ceil(total / pageSize)}</span>
  <button onclick={() => (page = page + 1)}
          disabled={(page + 1) * pageSize >= total || loading}>Next ›</button>
</nav>

{#if loading}<div class="overlay">Loading…</div>{/if}
```

The `external*` props tell the grid not to re-derive that dimension
locally - the data you pass in is already the answer. Pagination above
is hand-rolled so total-row-count and "show next page" stay in your
control; if a built-in pager is enough, leave `showPagination={true}`
on and the wrapper will page the local `rows` array (which, in this
server-side pattern, only ever holds one page anyway).

See the [`09-server-side` demo](../examples/src/demos/09-server-side.svelte)
for a complete runnable version with debounce, abort wiring, and a
60 ms mock latency.

---

## 12. Virtualization for large datasets

For more than a few thousand rows, enable row virtualization. For very
wide grids (50+ columns) also enable column virtualization. Both are
opt-in so small grids don't pay the cost.

```svelte
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'
</script>

<SvGrid
  data={rows}
  columns={columns}
  virtualizeRows
  virtualizeColumns
  estimatedRowHeight={36}
  overscan={6}
/>
```

For full control (e.g. variable row heights, programmatic scroll),
use the headless virtualizer directly:

```ts
import { createSvelteVirtualizer } from '@svgrid/grid'

const virtualizer = createSvelteVirtualizer({
  count:                 () => rows.length,
  getScrollElement:      () => scrollRef,
  estimateSize:          (index) => (rows[index].kind === 'header' ? 40 : 28),
  overscan:              6,
})

// Programmatic scroll:
virtualizer.scrollToIndex(75_432, { align: 'center' })
```

See [`packages/grid/src/virtualization/`](../packages/grid/src/virtualization/)
for the full API.

---

## 13. Accessibility

SvGrid implements the WAI-ARIA 1.2 grid pattern.

- The root carries `role="grid"`, an accessible name (set via
  `aria-label` or `aria-labelledby`), and `aria-rowcount` /
  `aria-colcount` reflecting the total - not just the visible window.
- Rows carry `role="row"` plus `aria-rowindex` accounting for the
  virtualized offset; cells carry `role="gridcell"` and `aria-colindex`.
- The active cell is always exactly one focusable element
  (roving `tabindex`); arrow keys move it.
- Sort columns carry `aria-sort="ascending" | "descending" | "none"`.
- Sort and selection state changes are announced via an off-screen
  `aria-live` region the grid manages internally.

If you build your own header or toolbar, use the helpers in
[`a11y.ts`](../packages/grid/src/a11y.ts) so your markup
stays consistent with the contract:

```ts
import {
  getGridRootA11yProps,
  getGridRowA11yProps,
  getGridCellA11yProps,
  getGridHeaderA11yProps,
} from '@svgrid/grid'
```

There is a contract test suite at
[`a11y.contract.test.ts`](../packages/grid/src/a11y.contract.test.ts)
that exercises the public a11y guarantees - run it (`pnpm test`) when
you customize markup to be sure you haven't regressed the contract.

---

## 14. TypeScript notes

Most APIs are generic over your row type. Define the row type once and
flow it through:

```ts
type Person = { id: string; firstName: string; age: number }

const columns: ColumnDef<{}, Person>[] = [
  { field: 'firstName', header: 'First name' }, // ✅ key checked
  // { field: 'first_name', header: '…' },      // ✗ TS error
]
```

The first type parameter is the **feature set**. When you register
features, derive it once and reuse:

```ts
const features = tableFeatures({
  rowSortingFeature,
  rowSelectionFeature,
  columnFilteringFeature,
})

type Features = typeof features

const columns: ColumnDef<Features, Person>[] = [/* … */]
```

This lets feature-specific column properties (like `filterFn`)
auto-complete and type-check.

---

## 15. What's next

### Core features

- **[Examples gallery](https://svgrid.com/#/demos)** - 50+ production-quality
  demos, from quick-start to 100k-row virtualization.
- **[Column definitions](./help/columns/column-definitions.md)** - every
  property on `ColumnDef`.
- **[Row sorting](./help/rows/row-sorting.md)** and the wider [rows topic index](./help/index.md#rows) -
  when to use which row model and the order they run in.
- **[Tree rows (expand / collapse)](./help/rows/tree-rows.md)** - the
  flat-array + expanded-map pattern, connector lines, keyboard
  navigation, and lazy load on first expand.
- **[Filter API](./help/filtering/filter-api.md)** - sort, filter,
  paginate, group, and aggregate locally or against your backend.
- **[Tailwind integration](./help/tailwind.md)** - full list of CSS
  custom properties (`--sg-*`) and recipes for building your own theme.
- **[Compare SvGrid with other Svelte data grids](https://svgrid.com/#/compare)** -
  side-by-side feature matrix and when to pick which.

### Enterprise features (`@svgrid/enterprise`)

The paid companion package augments your `SvGridApi` with one
`installEnterprise(api)` call. Set a license key at app boot to remove the
"unlicensed" watermark - every feature still runs without a key for
demos and evaluation.

- **[Data export and printing](./help/export.md)** - Excel (xlsx), PDF,
  CSV, TSV, HTML, and a paginated print view. Defaults to the currently
  displayed rows so sort + filter + paginate carry through automatically.
- **[Data import](./help/import.md)** - Excel (xlsx), CSV, TSV, and JSON
  with column mapping, per-row validation, and preview-before-commit. Auto-
  detects the format from the file extension or pasted text.
- **[Pivot tables](./help/pivot.md)** - drag-and-drop Pivot Designer with
  Filters / Rows / Columns / Values zones, multi-level column headers,
  per-measure aggregator picker, pivot-aware sort. Built on the same
  engine; no special "pivot mode".
- **[AI assistant](./help/ai.md)** - natural-language filter, smart fill,
  summarise, and classify, driven by a bring-your-own model adapter
  (`setAIProvider(fn)`). Ships with a deterministic `mockAIProvider` so
  the demo works without keys.

### Getting help

- File issues at the [project repository](https://github.com/sv-grid/sv-grid/issues).
- Browse the [Help index](./help/index.md) for topic-oriented guides.
- Use the [@svgrid/mcp](https://svgrid.com/#/mcp) server
  to give your AI assistant accurate answers.
- Read the source - it is small, well-commented, and meant to be read
  before opening a bug report.

### License

`@svgrid/grid` is published under the **MIT License**. Free for
commercial and personal use. The paid `@svgrid/enterprise` companion package
(export, import, print, pivot, AI assistant) is governed by a separate
commercial license. See [LICENSE](../LICENSE) and
[packages/enterprise/LICENSE](../packages/enterprise/LICENSE).
