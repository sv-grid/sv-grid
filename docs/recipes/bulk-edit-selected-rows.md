# Bulk-edit selected rows

Goal: the user selects N rows, opens a toolbar, picks a field + value,
and **every** selected row updates in one click. Standard back-office
workflow for status changes, reassignments, tag application.

## Implementation

The recipe is three pieces:

1. `selectionMode="row"` + `showRowSelection={true}` gives you the
   checkbox column and the multi-select keyboard model.
2. `onRowSelectionChange` keeps a `$state` array of selected rows.
3. A toolbar above the grid commits the bulk change to `internalData`
   via the api's `setCellValue` (one call per selected row).

```svelte
<script lang="ts">
  import {
    SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature,
    rowSelectionFeature, type ColumnDef, type SvGridApi,
  } from '@svgrid/grid'

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  type Order = {
    id: string
    customer: string
    status: 'New' | 'In review' | 'Approved' | 'Shipped' | 'Cancelled'
    priority: 'Low' | 'Normal' | 'High'
    assignee: string
  }

  let rows = $state<Order[]>([/* ... */])
  let api  = $state<SvGridApi<typeof features, Order> | null>(null)
  let selected = $state<Order[]>([])

  // Per-action UI state.
  let action = $state<'status' | 'priority' | 'assignee'>('status')
  let value  = $state<string>('Approved')

  const STATUS_OPTIONS    = ['New', 'In review', 'Approved', 'Shipped', 'Cancelled'] as const
  const PRIORITY_OPTIONS  = ['Low', 'Normal', 'High'] as const
  const ASSIGNEE_OPTIONS  = ['Ada', 'Linus', 'Grace', 'Kathleen', '(unassigned)']

  function applyBulk() {
    if (!api || selected.length === 0) return
    // Resolve each selected row's index in the live data array and
    // write through setCellValue. `setCellValue` triggers a single
    // re-render after the batch via the wrapper's state-version bump.
    for (const row of selected) {
      const idx = rows.indexOf(row)
      if (idx < 0) continue
      api.setCellValue(idx, action, value)
    }
    // Refresh `rows` reference so $derived bindings outside the grid
    // (footer counts, etc.) update. The grid itself is already in sync.
    rows = [...rows]
  }
</script>

<header class="flex items-end gap-2 mb-3">
  <strong>{selected.length} selected</strong>
  <label>
    Field
    <select bind:value={action} onchange={() => {
      value = action === 'status'   ? 'Approved'
            : action === 'priority' ? 'Normal'
            :                         'Ada'
    }}>
      <option value="status">Status</option>
      <option value="priority">Priority</option>
      <option value="assignee">Assignee</option>
    </select>
  </label>
  <label>
    Value
    <select bind:value={value}>
      {#each (action === 'status'   ? STATUS_OPTIONS
            : action === 'priority' ? PRIORITY_OPTIONS
            :                         ASSIGNEE_OPTIONS) as opt}
        <option value={opt}>{opt}</option>
      {/each}
    </select>
  </label>
  <button onclick={applyBulk} disabled={selected.length === 0}>
    Apply to {selected.length} rows
  </button>
</header>

<SvGrid
  data={rows}
  columns={[
    { field: 'id',       header: 'Order',    width: 110 },
    { field: 'customer', header: 'Customer', width: 200 },
    { field: 'status',   header: 'Status',   width: 130 },
    { field: 'priority', header: 'Priority', width: 110 },
    { field: 'assignee', header: 'Assignee', width: 140 },
  ] satisfies ColumnDef<typeof features, Order>[]}
  features={features}
  selectionMode="row"
  showRowSelection={true}
  onApiReady={(next) => (api = next)}
  onRowSelectionChange={(_, selectedRows) => (selected = selectedRows)}
/>
```

## Variations

### Cycle through values per row

If the bulk action is "increment priority by one level", you read each
row's current value first:

```ts
const next = (cur: 'Low' | 'Normal' | 'High') =>
  cur === 'Low' ? 'Normal' : cur === 'Normal' ? 'High' : 'High'

for (const row of selected) {
  const idx = rows.indexOf(row)
  if (idx < 0) continue
  api.setCellValue(idx, 'priority', next(row.priority))
}
```

### Confirm before applying

For destructive bulk actions (cancel orders, delete rows), pop a
confirm dialog before the loop. Don't rely on the browser's native
`confirm()` - it's blocked by some embedded contexts. A Svelte
`<dialog>` element is the lowest-friction path.

### Server-side persistence

Pair the bulk write with a single `POST /api/orders/bulk-update`
request rather than N writes. The grid update is purely client-side;
the server roundtrip is independent. If the server fails, roll the
grid back by re-applying the previous values from a `before` snapshot.

```ts
async function applyBulkAndPersist() {
  const before = selected.map((r) => ({ ...r }))
  applyBulk() // optimistic local write
  try {
    await fetch('/api/orders/bulk-update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: selected.map((r) => r.id), [action]: value }),
    })
  } catch (err) {
    // Roll back
    for (const old of before) {
      const idx = rows.indexOf(rows.find((r) => r.id === old.id)!)
      if (idx >= 0) api?.setCellValue(idx, action, (old as any)[action])
    }
    throw err
  }
}
```

## Notes

- **`setCellValue` does not fire `onCellValueChange`.** That callback
  is for **user** edits via the inline editor. Bulk programmatic
  writes are silent - if you need them logged, log them yourself in
  the bulk handler.
- **Selection survives data shape changes** as long as the row
  references match. Swapping the entire `rows` array clears selection;
  immutable updates that keep most row references stable preserve it.
- **Keyboard**: Shift-click to extend, Ctrl/Cmd-click to toggle, the
  header checkbox toggles all visible. Standard a11y - no extra work.

## See also

- [`SvGridApi.setCellValue`](../reference/SvGridApi.md#setcellvaluerowindex-columnid-value)
- [Editing overview](../help/editing/overview.md)
- Demo [`23-bulk-actions`](../../examples/src/demos/23-bulk-actions.svelte) -
  a fuller version with confirm + undo
