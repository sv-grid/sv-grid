# View refresh

The grid renders reactively - it does **not** have a `refresh()` method,
because it doesn't need one. To make the grid re-display, change the data
that drives it.

## Forcing a refresh

| You want | Do this |
| -------- | ------- |
| Re-display every row | Reassign `data` to a new array (`rows = [...rows]`). |
| Re-display one row | Mutate the row through a `$state` array, or call `api.setCellValue(...)`. |
| Re-apply sort / filter / page | Update the controlled state slice (or reassign the data). |
| Re-render a single cell | The grid's renderer keys on the cell's `cellId`. Changing the underlying value re-renders the cell. |

## When the grid does NOT re-render

If you mutate a row object **deeply** without going through `$state` -
e.g. `someExternalRef.salary = 50000` where `someExternalRef` is an object
held outside the grid - Svelte 5 will not know to update.

Two safe patterns:

```svelte
<script lang="ts">
  let rows = $state<Person[]>(initial)

  // ✅ via $state proxy
  rows[0]!.salary = 50_000

  // ✅ via array reassignment
  rows = rows.map((r, i) => (i === 0 ? { ...r, salary: 50_000 } : r))

  // ✅ via API
  api?.setCellValue(0, 'salary', 50_000)
</script>
```

## Refresh-after-async

For data fetched asynchronously, the array reassignment is the canonical
trigger:

```svelte
<script lang="ts">
  let rows = $state<Person[]>([])
  $effect(() => { fetchRows().then((next) => (rows = next)) })
</script>
```

## See also

- [Row data](../rows/row-data.md)
- [Accessing rows](../rows/accessing-rows.md)
