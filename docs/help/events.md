# Grid events and callback props

`<SvGrid>` does not dispatch component events. Every event is a callback
prop: you pass a function, and the grid calls it with a plain object. A cell
click is `onCellClick`, a committed edit is `onCellValueChange`, a reordered
column is `onColumnOrderChange`. The grid reads the prop when the event
happens, so an inline arrow function is fine and swapping the function later
takes effect on the next event.

```svelte
<SvGrid
  {data}
  {columns}
  onCellClick={(e) => console.log(e.columnId, e.value, e.row)}
  onRowClick={({ row }) => (selected = row)}
/>
```

The full prop list with types lives in the [`<SvGrid>` reference](../reference/SvGrid.md);
this page groups the callbacks by what triggers them.

## Svelte 4 habits that do not work

SvGrid is a Svelte 5 component and never calls `createEventDispatcher`.
An `on:` directive on it has nothing to listen to. The Svelte compiler
accepts the line below without a warning, and the handler never runs:

```svelte
<!-- Never fires: SvGrid dispatches no component events. -->
<SvGrid {data} {columns} on:cellClick={(e) => open(e.detail.row)} />
```

Pass the callback as a prop instead. There is no `e.detail`; the argument
is the payload itself:

```svelte
<SvGrid {data} {columns} onCellClick={(e) => open(e.row)} />
```

The same applies to a component that wraps the grid. Expose a callback prop
through `$props()` rather than dispatching:

```svelte
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Order = { id: number; customer: string; total: number }

  let {
    orders,
    columns,
    onopen,
  }: {
    orders: Order[]
    columns: GridColumns<Order>
    onopen?: (order: Order) => void
  } = $props()
</script>

<SvGrid data={orders} {columns} onRowDoubleClick={({ row }) => onopen?.(row)} />
```

The parent then writes `<OrdersGrid {orders} {columns} onopen={showOrder} />`.

The `<sv-grid>` web component is the exception: it re-publishes these
callbacks as DOM events (`cellclick`, `rowclick` and so on) because that is
what a non-Svelte host can listen to. See
[the sv-grid element](./web-components/sv-grid.md).

## Open a detail panel on row click

`onRowClick` gets the row object you passed in `data`. Keep it in `$state`
and render the panel from it:

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Order = { id: number; customer: string; status: string; total: number }

  const orders: Order[] = [
    { id: 1001, customer: 'Northwind',  status: 'Shipped', total: 1240 },
    { id: 1002, customer: 'Contoso',    status: 'Pending', total: 380 },
    { id: 1003, customer: 'Fabrikam',   status: 'Shipped', total: 2915 },
    { id: 1004, customer: 'Litware',    status: 'On hold', total: 640 },
  ]

  const columns: GridColumns<Order> = [
    { field: 'id',       header: 'Order',    width: 100 },
    { field: 'customer', header: 'Customer', width: 160 },
    { field: 'status',   header: 'Status',   width: 120 },
    { field: 'total',    header: 'Total',    width: 120,
      format: { type: 'currency', currency: 'USD' } },
  ]

  let selected = $state<Order | null>(null)
</script>

<div class="layout">
  <SvGrid
    data={orders}
    {columns}
    getRowId={(o) => String(o.id)}
    onRowClick={({ row }) => (selected = row)}
  />
  {#if selected}
    <aside>
      <h3>Order {selected.id}</h3>
      <p>{selected.customer}, {selected.status}</p>
      <p>Total: ${selected.total}</p>
      <button onclick={() => (selected = null)}>Close</button>
    </aside>
  {/if}
</div>

<style>
  .layout { display: flex; gap: 12px; align-items: flex-start; }
  .layout > :global(:first-child) { flex: 1; min-width: 0; }
  aside {
    width: 200px;
    padding: 12px;
    border: 1px solid var(--sg-border);
    background: var(--sg-bg);
    color: var(--sg-fg);
  }
</style>
```

A click is a pointer event. A keyboard user moving through the grid fires
`onActiveCellChange` instead, so a panel that should follow the keyboard as
well reads that callback too.

## Persist column order

`columnOrder` is read once at mount. After that the grid owns the order and
reports every change through `onColumnOrderChange`, whether a header drag
or `api.setColumnOrder()` caused it. Save the array, and pass it back as
`columnOrder` next time:

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { id: number; name: string; department: string; city: string }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London' },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York' },
    { id: 3, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle' },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 180 },
    { field: 'department', header: 'Department', width: 160 },
    { field: 'city',       header: 'City',       width: 140 },
  ]

  const KEY = 'people-grid:column-order'

  function readOrder(): string[] | undefined {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? JSON.parse(raw) : undefined
    } catch {
      return undefined
    }
  }

  function saveOrder(order: ReadonlyArray<string>) {
    try {
      localStorage.setItem(KEY, JSON.stringify(order))
    } catch {
      // Storage blocked (private window): the order just is not kept.
    }
  }

  const savedOrder = readOrder()
</script>

<SvGrid
  data={people}
  {columns}
  enableColumnReorder
  columnOrder={savedOrder}
  onColumnOrderChange={saveOrder}
/>
```

Drag a header, reload the page, and the order comes back. The ids are each
column's `id`, or its `field` when it has no `id`.

## Watch the events fire

Click, double-click and move with the arrow keys to see which callbacks run
and in what order:

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { id: number; name: string; city: string; age: number }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',  city: 'London',   age: 36 },
    { id: 2, name: 'Grace Hopper',  city: 'New York', age: 45 },
    { id: 3, name: 'Radia Perlman', city: 'Seattle',  age: 49 },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name', header: 'Name', width: 180 },
    { field: 'city', header: 'City', width: 140 },
    { field: 'age',  header: 'Age',  width: 90 },
  ]

  let log = $state<string[]>([])

  function note(line: string) {
    log = [line, ...log].slice(0, 8)
  }
</script>

<SvGrid
  data={people}
  {columns}
  onActiveCellChange={(c) => note(`onActiveCellChange ${c.columnId}, row ${c.rowIndex}`)}
  onCellClick={(e) => note(`onCellClick ${e.columnId} = ${String(e.value)}`)}
  onRowClick={(e) => note(`onRowClick ${e.row.name}`)}
  onCellDoubleClick={(e) => note(`onCellDoubleClick ${e.columnId}`)}
  onRowDoubleClick={(e) => note(`onRowDoubleClick ${e.row.name}`)}
/>

<ol class="log">
  {#each log as line}
    <li><code>{line}</code></li>
  {/each}
</ol>

<style>
  .log { margin: 8px 0 0; padding-left: 20px; color: var(--sg-muted); font-size: 13px; }
</style>
```

On a mouse click the active cell moves on pointer down, so
`onActiveCellChange` comes first. Then `onCellClick` runs, then
`onRowClick`, both before the grid toggles a checkbox cell or opens an
editor. A double-click runs `onCellDoubleClick` and then `onRowDoubleClick`,
on read-only grids as well. Group header rows fire none of the four click
callbacks.

## `rowIndex` is not always an index into `data`

The click callbacks and `onActiveCellChange` report `rowIndex` as the row's
position among the rows on screen: after sorting, filtering and grouping,
and within the current page. `onCellValueChange` reports the row's position
in `data`. When you need the record, use the `row` field every click
payload carries rather than `data[rowIndex]`.

## Every callback on `<SvGrid>`

All of them are optional. The signatures are copied from `SvGrid.types.ts`.

### Lifecycle

| Prop | Signature | Fires when |
| ---- | --------- | ---------- |
| `onApiReady` | `(api: SvGridApi<TFeatures, TData>) => void` | Once, after the grid mounts. A new arrow function on each parent render does not make it fire again. |

### Clicks and focus

| Prop | Signature | Fires when |
| ---- | --------- | ---------- |
| `onCellClick` | `(event: { rowIndex: number; colIndex: number; columnId: string; value: unknown; row: TData }) => void` | A data cell is single-clicked. `value` is the displayed value. Not on group rows. |
| `onRowClick` | `(event: { rowIndex: number; columnId: string; row: TData }) => void` | A data row is single-clicked, on any cell, right after `onCellClick`. Not on group rows. |
| `onCellDoubleClick` | `(event: { rowIndex: number; colIndex: number; columnId: string; value: unknown; row: TData }) => void` | A data cell is double-clicked, whether or not it is editable. Not on group rows. |
| `onRowDoubleClick` | `(event: { rowIndex: number; columnId: string; row: TData }) => void` | A data row is double-clicked, right after `onCellDoubleClick`. Not on group rows. |
| `onActiveCellChange` | `(cell: { rowIndex: number; colIndex: number; columnId: string }) => void` | The active cell is set: click, arrow keys, Tab, Enter, Page Up / Down, fill release. |

### Selection

| Prop | Signature | Fires when |
| ---- | --------- | ---------- |
| `onRowSelectionChange` | `(selection: Record<string, boolean>, rows: TData[]) => void` | The row selection changes. `selection` is keyed by row id; `rows` includes selected rows on other pages. Not on mount. |
| `onCellSelectionChange` | `(ranges: Array<[number, number, number, number]>) => void` | The cell selection changes, by mouse, keyboard or `api.selectCells()`. Each range is `[rowStart, colStart, rowEnd, colEnd]`; empty when cleared. Not on mount. |

### Sorting, filtering and paging

| Prop | Signature | Fires when |
| ---- | --------- | ---------- |
| `onSortingChange` | `(sorting: Array<{ id: string; desc: boolean }>) => void` | The sort clauses change. Pair with `externalSort` to sort the data yourself. |
| `onFiltersChange` | `(filters: { global: string; columns: Array<{ id: string; operator: FilterOperator; value: string; valueTo?: string; selectedValues?: Array<string> }>; custom?: Record<string, unknown> }) => void` | The global search, a column filter or a value checklist changes. Pair with `externalFilter` to filter on the server. Not on mount. |
| `onAdvancedFilterChange` | `(expr: GridPredicateExpr \| null) => void` | The advanced-filter expression changes, including when the toolbar or `clearAllFilters()` clears it. |
| `onPaginationChange` | `(pagination: { pageIndex: number; pageSize: number }) => void` | The user changes page or page size, and only while `externalPagination` is on. |
| `onPivotModeChange` | `(on: boolean) => void` | The in-grid Pivot toggle flips `pivotMode`. |

### Editing and the clipboard

| Prop | Signature | Fires when |
| ---- | --------- | ---------- |
| `onCellValueChange` | `(event: { rowIndex: number; columnId: string; oldValue: unknown; newValue: unknown; row: TData }) => void` | An inline edit commits or a checkbox cell is toggled (click or Space), and once per cell for a paste, a fill drag, a cleared range, and undo / redo. The grid has already applied the value, so this is a notification, not a veto. `api.setCellValue()` does not fire it. |
| `onPasteClipboard` | `(payload: { text: string; html: string \| null; source: "event" \| "async" }) => boolean \| void` | The user pastes. Return `true` to say you applied the paste; anything else lets the grid paste the text itself. |
| `onNoteChange` | `(event: { rowId: string; columnId: string; note: string }) => void` | A cell comment is saved or removed (empty `note`), with `editableComments` on. |

### Rows, groups and details

| Prop | Signature | Fires when |
| ---- | --------- | ---------- |
| `onExpandedChange` | `(expanded: Record<string, boolean>) => void` | The expanded set changes: a chevron click, `api.setRowExpanded()`, `expandAllGroups()` / `collapseAllGroups()`. Receives the full next map. |
| `onDetailToggle` | `(row: TData, rowIndex: number) => void` | The `showDetailToggle` chevron is clicked, or Ctrl+Enter is pressed on a row while `renderDetailRow` is set. You keep the open set. |
| `onRowResize` | `(event: { rowIndex: number; height: number \| null }) => void` | The user drags a row edge, or double-clicks it (`height` is then `null`). `api.setRowHeight` does not fire it. |
| `onRetryRow` | `(row: TData, rowIndex: number) => void` | The Retry button on a `"failed"` placeholder row (see `rowPlaceholder`) is clicked. |
| `onRowDragEnd` | `(event: { row: TData; toIndex: number; sameGrid: boolean; fromGridId: number; toGridId: number }) => void` | A managed row drag (`rowDragManaged`) settles, on the target grid, after the grid has moved the row. |
| `onRowDrop` | `(event: { row: TData; target: TData \| null; targetIndex: number \| null; side: "before" \| "after" \| "into" }) => void` | A row is dropped within one grid. With this set the grid does not move the row; you do. |

### Columns

| Prop | Signature | Fires when |
| ---- | --------- | ---------- |
| `onColumnOrderChange` | `(order: ReadonlyArray<string>) => void` | The column order changes, by header drag (`enableColumnReorder`) or `api.setColumnOrder()`. |
| `onColumnResize` | `(event: { columnId: string; width: number }) => void` | The user drags a column edge or double-clicks it to autosize. `api.setColumnWidth` does not fire it. |

### Scrolling

| Prop | Signature | Fires when |
| ---- | --------- | ---------- |
| `onScrollBottomReached` | `(event: { scrollTop: number; scrollHeight: number; clientHeight: number }) => void` | The body scrolls to within about 32px of the bottom. Fires once, then re-arms after the user scrolls back up. |
| `onVisibleRangeChange` | `(range: { startIndex: number; endIndex: number }) => void` | The range of row indexes on screen changes. At most once per frame. With virtualization off it reports `0` to `data.length - 1`. |

### Fields and the selection bar (Enterprise)

The props and types are free; the UI that fires them is drawn by
`@svgrid/enterprise` (`enableFields()`, `enableSelectionBar()`).

| Prop | Signature | Fires when |
| ---- | --------- | ---------- |
| `onRowAdd` | `(event: { row: TData }) => void` | The row adder appended a row. Persist it here. |
| `onRowsDelete` | `(event: { rows: TData[]; ids: string[]; data: TData[] }) => void` | Rows are deleted from the selection bar's Delete action. `data` is the array without them. |
| `onColumnAdd` | `(event: { column: ColumnDef<TFeatures, TData>; columns: ColumnDef<TFeatures, TData>[]; data?: TData[] }) => void` | A field is added from the column adder, Insert or Duplicate. Store `columns` as your column list. |
| `onColumnChange` | `(event: { column: ColumnDef<TFeatures, TData>; previous: ColumnDef<TFeatures, TData>; columns: ColumnDef<TFeatures, TData>[]; data?: TData[] }) => void` | A field is edited. `data` is set when a type change converted its values. |
| `onColumnRemove` | `(event: { columnId: string; columns: ColumnDef<TFeatures, TData>[] }) => void` | A field is deleted from the column menu. Its values stay in the rows. |
| `onRowColorChange` | `(config: RowColorConfig<TData> \| null) => void` | "Color rows by this field" is turned on or off in a column menu (with `fieldMenu`). Pass it back as `rowColor`. |

### Callbacks inside config objects

The board, scheduler, Gantt and chart views take their callbacks on their
own config prop, not on `<SvGrid>` directly: `board={{ onCardClick, onCardMove }}`,
`scheduler={{ onEventMove, onEventAdd }}`, `gantt={{ onTaskMove, onDependencyAdd }}`,
`charting={{ onChartCreated, onChartChanged }}`. `serverGroup` takes
`onToggle`. Each view's page lists its own.

## Setting a callback from the API

Code that holds the grid API but not the markup, such as a toolbar module,
can attach a callback with `api.setOption()`. It is merged over the prop and
read the same way:

```ts
api.setOption('onRowClick', ({ row }) => console.log(row))
api.setOption('onRowClick', undefined) // back to the prop
```

## See also

- [`<SvGrid>` reference](../reference/SvGrid.md) - every prop, including these callbacks
- [`SvGridApi`](../reference/SvGridApi.md) - the imperative API `onApiReady` hands you
- [Saving values](./editing/saving-values.md) - persisting edits with `onCellValueChange`
- [Column moving](./columns/column-moving.md) - `enableColumnReorder` and `onColumnOrderChange`
- [Accessing rows](./rows/accessing-rows.md) - source rows versus displayed rows
- [Selection bar](./rows/selection-bar.md) - bulk actions on the selected rows
- [Master / detail](./rows/master-detail.md) - `onDetailToggle` and the detail chevron
- [Row dragging](./rows/row-dragging.md) - `onRowDragEnd` and `onRowDrop`
- [Controlled state](./headless/controlled-state.md) - feeding state callbacks back into props
