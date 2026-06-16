# 4. Features

> Step 4 of 6 · [← Data and columns](./3-data-and-columns.md) · [Next: Theme and density →](./5-theme-and-density.md)

The grid engine is **feature-gated**. Out of the box you get the core
row model (rows in their original order). To enable sorting, filtering,
grouping, pagination, expansion, or selection, register the matching
feature; the wrapper wires the matching row-model factory for you.

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type ColumnDef,
  } from 'sv-grid-core'

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
  filterMode="menu"
  showPagination={true}
  pageSize={25}
/>
```

The wrapper handles the user-facing toggles via plain props. If you
need the headless pipeline directly - say, a custom renderer - drop
down to `createSvGrid` from the same package. See
[Why headless?](../why-headless.md).

## Capability shortcuts (the quick way)

Every capability is **off by default** - a bare `<SvGrid>` is a plain,
read-only table. The fastest way to opt in is a set of boolean shortcut
props. No `tableFeatures({ … })` import, no feature constants:

```svelte
<SvGrid
  data={rows}
  columns={columns}
  sortable
  filterable
  editable
  groupable
  pageable
/>
```

| Shortcut     | Turns on                                         | Equivalent to                              |
| ------------ | ------------------------------------------------ | ------------------------------------------ |
| `sortable`   | Click headers to sort                            | injects `rowSortingFeature`                |
| `filterable` | Per-column filter menu                           | injects `columnFilteringFeature`           |
| `editable`   | Inline cell editing (needs `editorType` columns) | `enableInlineEditing`                      |
| `groupable`  | "Group by this column" in the column menu        | `showGroupingControls`                     |
| `pageable`   | Pagination footer                                | `showPagination`                           |

Each shortcut is an override: omit it (or set `false`) to leave the
capability off; set it `true` to opt in. They compose with the
fine-grained props and the `features` set below - reach for those when
you need finer control (e.g. `filterMode`, `pageSize`, per-column
`sortable: false`). See the live [Shortcut config](https://sv-grid.com/demos/135-shortcut-config) demo.

## The feature catalogue

| Feature                  | What it enables                                           | Doc                                                |
| ------------------------ | --------------------------------------------------------- | -------------------------------------------------- |
| `rowSortingFeature`      | Click headers to sort; Shift-click for multi-sort.        | [Row sorting](../help/rows/row-sorting.md)         |
| `columnFilteringFeature` | Per-column filter menu + filter row + global search.      | [Filter overview](../help/filtering/overview.md)   |
| `rowPaginationFeature`   | Page slicing + footer with page-size selector.            | [Row pagination](../help/rows/row-pagination.md)   |
| `rowSelectionFeature`    | Checkbox column + Shift / Ctrl multi-select.              | [Row selection](../help/rows/styling-rows.md)      |
| `columnGroupingFeature`  | Group-by-column + aggregated footer summaries.            | [Grouping & aggregation](../help/grouping-aggregation.md) |
| `rowExpandingFeature`    | Tree / master-detail expand-collapse.                     | [Tree rows](../help/rows/tree-rows.md)             |

**Rule of thumb:** only register the features you use. Each one ships
about 1-2 KB gzipped and adds a small per-update cost.

## The three operating modes

There's one decision per dimension (sort, filter): **uncontrolled**
(default), **observable** (callbacks), or **external** (you own the row
ordering).

### Uncontrolled (the default)

The wrapper owns the state. Pass the start config via props:

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

### Observable - callbacks fire on every change

The wrapper still owns the state, but emits callbacks. Use this when
something outside the grid needs to react (a "X rows selected" pill,
URL sync, a server fetch).

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

### External - you own the row ordering

For server-side data or tree data the wrapper records the sort + filter
UI state but does **not** re-order the rows - you do. See
[Going to production §1](./6-going-to-production.md#1-server-side-data).

## Selection + editing

Both are off by default. Two top-level umbrella props turn them on:

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  selectionMode="both"
  showRowSelection={true}
  enableInlineEditing={true}
  enableCellSelection={true}
  onRowSelectionChange={(state, selectedRows) => /* … */}
  onCellValueChange={(event) => /* event: { rowIndex, columnId, oldValue, newValue, row } */}
/>
```

`selectionMode` choices:

- `'row'`   - checkbox column only
- `'cell'`  - click-and-drag range selection only
- `'both'`  - both (default)
- `'none'`  - both off

Cell editing requires `editorType` on the columns you want editable.
See [Editing overview](../help/editing/overview.md).

## Keyboard map

| Action                | Keys                                  |
| --------------------- | ------------------------------------- |
| Move active cell      | Arrow keys                            |
| First / last in row   | Home / End                            |
| First / last in grid  | Ctrl + Home / Ctrl + End              |
| Move by viewport      | Page Up / Page Down                   |
| Extend range          | Shift + arrows / Shift + Home / End   |
| Start editing         | Enter, F2, or double-click            |
| Commit edit           | Enter, Tab                            |
| Cancel edit           | Esc                                   |
| Toggle row selection  | Space                                 |
| Copy / paste range    | Ctrl/Cmd + C / V (TSV)                |

The full a11y model is in [Accessibility](../help/accessibility.md).
