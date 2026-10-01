# 4. Features

> Step 4 of 6 · [← Data and columns](./3-data-and-columns.md) · [Next: Theme and density →](./5-theme-and-density.md)

Every capability is **off by default** - a bare `<SvGrid>` is a plain,
read-only table. Opt in with boolean props. No imports, no feature
constants:

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns, tableFeatures, rowSortingFeature, columnFilteringFeature } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    department: string
    age: number
    salary: number
    city: string
    startDate: string
    active: boolean
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   department: 'Engineering', age: 36, salary: 142000, city: 'London',   startDate: '2021-03-01', active: true },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', department: 'Engineering', age: 45, salary: 168000, city: 'New York', startDate: '2019-07-15', active: true },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', department: 'Platform',    age: 54, salary: 155000, city: 'Portland', startDate: '2020-01-20', active: false },
    { id: 4, name: 'Radia Perlman',  email: 'radia@example.com', department: 'Networking',  age: 49, salary: 161000, city: 'Seattle',  startDate: '2022-09-05', active: true },
    { id: 5, name: 'Barbara Liskov', email: 'barbara@example.com', department: 'Platform',  age: 52, salary: 172000, city: 'Boston',   startDate: '2018-11-11', active: true },
  ]

  const data = people

  let rows = $state<Person[]>(people)

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'city',       header: 'City',       width: 140 },
    { field: 'age',        header: 'Age',        width: 90 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```svelte {runnable}
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

`selectable` completes the set - see
[the exception](#the-exception-selection-is-already-on) below, since selection
is already on:

```svelte {runnable}
<SvGrid data={rows} columns={columns} selectable={false} />
```

| Shortcut     | Turns on                                         | Equivalent to                              |
| ------------ | ------------------------------------------------ | ------------------------------------------ |
| `sortable`   | Click headers to sort                            | injects `rowSortingFeature`                |
| `filterable` | Per-column filter menu                           | injects `columnFilteringFeature`           |
| `editable`   | Inline cell editing (text editor unless `editorType`) | `enableInlineEditing`                 |
| `selectable` | Cell selection (click a cell, drag for a range)  | `enableCellSelection`                      |
| `groupable`  | "Group by this column" in the column menu        | `showGroupingControls`                     |
| `pageable`   | Pagination footer                                | `showPagination`                           |

Each shortcut is an override: omit it (or set `false`) to leave the
capability off; set it `true` to opt in. See the live
[Shortcut config](https://svgrid.com/demos/135-shortcut-config/) demo.

### The exception: selection is already on

`selectable` is the one shortcut that starts **on**. Selection is governed by
`selectionMode`, which defaults to `'both'`, so a bare grid already has both
surfaces:

| Surface                  | Controlled by                       | Default |
| ------------------------ | ----------------------------------- | ------- |
| Cell / range selection   | `selectable` -> `enableCellSelection` | **on**  |
| Selection checkbox column | `showRowSelection`                  | **on**  |

Neither needs a feature import. `selectable` is listed with the shortcuts so
the capability has a name next to the others, and so `selectable={false}` is a
one-word way to switch cell selection off. To move both surfaces at once, use
`selectionMode="none"` (or `"row"` / `"cell"`).

**For most grids this is the whole story** - skip to
[Theme and density](./5-theme-and-density.md). The rest of this page is the
explicit form underneath, worth reading when you want finer control.

## The explicit form: registering features

The engine is feature-gated: out of the box you get the core row model (rows
in their original order), and each capability is a feature you register. The
shortcut props above just inject these for you.

![The engine ships the core row model in original order; you opt into features that wire into the SvGrid component.](/docs-media/grid-feature-gating.svg)

Register them yourself when you need the fine-grained props alongside -
`filterMode`, `pageSize`, per-column `sortable: false`:

```svelte {runnable}
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type GridColumns,
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
  filterMode="menu"
  showPagination={true}
  pageSize={25}
/>
```

If you need the headless pipeline directly - say, a custom renderer - drop
down to `createSvGrid` from the same package. See
[Why headless?](../why-headless.md).

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

```svelte {runnable}
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

```svelte {runnable}
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

Cell editing falls back to a text editor, so `editable` works on plain
columns; declare `editorType` on a column to get the right control for its
type (`number`, `date`, `checkbox`, `list`, ...).
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

<!-- tutorial:learn-3-sort-filter-page -->
<figure class="docs-tutorial" id="tutorial-learn-3-sort-filter-page" data-docs-tutorial="learn-3-sort-filter-page">
<video class="docs-tutorial-video" src="/tutorials/learn-3-sort-filter-page.mp4" poster="/tutorials/learn-3-sort-filter-page.poster.webp" width="960" height="540" muted loop playsinline preload="none" aria-label="Learn SvGrid 3: sorting, filtering and paging, 143 second tutorial"><track kind="captions" srclang="en" label="English" src="/tutorials/learn-3-sort-filter-page.vtt" default>Your browser does not play embedded video. <a href="/tutorials/learn-3-sort-filter-page.mp4">Download the MP4</a>.</video>
<figcaption><strong>Learn SvGrid 3: sorting, filtering and paging</strong> (143 s, silent). <a href="https://www.youtube.com/watch?v=iBInYQ1kmDg" rel="noopener">Watch with narration on YouTube</a></figcaption>
<details class="docs-tutorial-transcript"><summary>Transcript</summary>
<p>Your grid renders. It does not sort, filter or page yet, and that is deliberate. This lesson turns those on and explains the trade the library is making for you.</p>
<p>Here is a wider row type and a realistic set of records, the kind of table you would actually ship. Nothing new yet.</p>
<p>Columns, with a currency format on salary from the last lesson.</p>
<p>And now the part that matters. Sortable, filterable, editable, groupable, pageable. Each is one boolean, and each one pulls in only the code that feature needs, which is why a grid you never configured stays small.</p>
<p>That is the whole file: the row type, the records, the columns, and the component with those five words on it. Nothing else is configured, and nothing is hidden above the fold.</p>
<p>Click a header and it sorts. Click again for descending, and a third time to clear it and get your original order back.</p>
<p>Shift-click a second header to sort by two columns at once: department first, then name inside each department.</p>
<p>The funnel next to each header is filtering, switched on by that same one word. How it looks is a choice, and the next screen has the version most people want.</p>
<p>Five rows will not show you paging, so here is the same set of props over five thousand. Filterable on its own gives you a menu per header; filter mode row puts an input under each header instead, and it narrows the table as you type.</p>
<p>And the pager cuts what is left into pages, with the range and the count kept honest as the filter changes them. None of this needed a callback from you.</p>
<p>Those five booleans are a shorthand. When you need finer control, register the features explicitly with tableFeatures and pass them in, which is the same machinery with the wiring exposed; the docs page below shows both forms side by side. Lesson four lets people change the table.</p>
</details>
</figure>
<!-- /tutorial:learn-3-sort-filter-page -->
