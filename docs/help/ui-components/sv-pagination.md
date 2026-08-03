# SvPagination

A standalone pager: page numbers with an ellipsis, plus prev/next and optional
first/last controls.

`SvPagination` is a controlled component - you own the current `page` and update
it from `onChange`. It pairs with the grid, a card list, or any paged data. The
sequence of page buttons (boundaries, a window of siblings around the current
page, and collapsed gaps) is produced by the pure `paginationRange` helper, so
the layout math is testable on its own and reusable in a custom pager. Colors
come from the `--sg-*` tokens.

Related: [SvBreadcrumb](sv-breadcrumb.md) · [SvStepper](sv-stepper.md) · [Navigation & rich overview](navigation.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvPagination` starter into your app:

<div data-docs-add="add pagination"></div>

Prefer to see it first? `npx @svgrid/ui try pagination` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvPagination` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvPagination } from '@svgrid/grid'
```

## Example

<div data-docs-demo="332-app-navigation" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvPagination } from '@svgrid/grid'
  let page = $state(1)
</script>

<SvPagination page={page} pageCount={20} onChange={(n) => (page = n)} showFirstLast />
```

## Props

| Prop            | Type                        | Default        | Description                                              |
| --------------- | --------------------------- | -------------- | -------------------------------------------------------- |
| `page`          | `number`                    | -              | 1-based current page. Controlled - you update it.        |
| `pageCount`     | `number`                    | -              | Total number of pages.                                   |
| `onChange`      | `(page: number) => void`    | -              | Fires with the clamped target page on any navigation.    |
| `siblingCount`  | `number`                    | `1`            | Pages shown on each side of the current page.            |
| `boundaryCount` | `number`                    | `1`            | Pages pinned at each end of the range.                   |
| `showFirstLast` | `boolean`                   | `false`        | Show the jump-to-first and jump-to-last controls.        |
| `showPrevNext`  | `boolean`                   | `true`         | Show the previous and next controls.                     |
| `size`          | `sm` \| `md` \| `lg`        | `md`           | Button size, shared with the rest of the kit.            |
| `disabled`      | `boolean`                   | `false`        | Dims and blocks every control.                           |
| `ariaLabel`     | `string`                    | `Pagination`   | Accessible name for the `<nav>` landmark.                |

The pure `paginationRange({ page, pageCount, siblingCount?, boundaryCount? })`
helper (from `@svgrid/grid`) returns the
`(number | 'ellipsis-left' | 'ellipsis-right')[]` sequence and is exported so you
can build a custom-styled pager on the same math.

## Examples

### Driving the grid

Keep the grid's page and the pager in one piece of state:

```svelte
<SvGrid {columns} {rows} bind:page pageSize={25} />
<SvPagination {page} pageCount={Math.ceil(total / 25)} onChange={(n) => (page = n)} />
```

### A custom pager on the same math

Reuse `paginationRange` when you want your own markup:

```svelte
<script lang="ts">
  import { paginationRange } from '@svgrid/grid'
  const items = $derived(paginationRange({ page, pageCount: 40, siblingCount: 2 }))
</script>

{#each items as it}
  {#if typeof it === 'number'}<button onclick={() => go(it)}>{it}</button>
  {:else}<span>…</span>{/if}
{/each}
```

### Compact vs wide

Raise `siblingCount` / `boundaryCount` for wide layouts, or drop `showPrevNext`
and set `size="sm"` for a tight inline pager.

### Server-side pagination

When the server owns the data, fetch one page at a time and let the pager report
the total. Keep `page` as state, refetch in an `$effect`, and derive `pageCount`
from the row count the API returns:

```svelte
<script lang="ts">
  import { SvGrid, SvPagination } from '@svgrid/grid'

  let page = $state(1)
  const pageSize = 25
  let rows = $state<Order[]>([])
  let total = $state(0)

  async function load(p: number) {
    const res = await fetch(`/api/orders?page=${p}&size=${pageSize}`)
    const data = await res.json()
    rows = data.items
    total = data.total
  }

  $effect(() => { load(page) })
  const pageCount = $derived(Math.max(1, Math.ceil(total / pageSize)))
</script>

<SvGrid {columns} {rows} />
<SvPagination {page} {pageCount} showFirstLast onChange={(n) => (page = n)} />
```

Tip: `onChange` clamps the target into `[1, pageCount]` and only fires when it
actually differs from the current `page`, so clicking Next on the last page or
Prev on the first is a no-op - you never issue a redundant or out-of-range fetch.

## Accessibility

- Renders a `<nav aria-label>` landmark around the button list.
- The current page button carries `aria-current="page"`.
- Prev/next/first/last buttons disable themselves at the range ends.
- Each button has an explicit label (`Page 3`, `Next page`, and so on).

## See also

- [Navigation overview](navigation.md) - the wayfinding family at a glance.
- [SvBreadcrumb](sv-breadcrumb.md) - show the path to the current page.
- [SvStepper](sv-stepper.md) - progress through an ordered flow.
