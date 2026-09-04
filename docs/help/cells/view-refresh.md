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

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  let rows = $state<Person[]>(people)
  const data = people

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'city',       header: 'City',       width: 140 },
    { field: 'age',        header: 'Age',        width: 90 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

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

## Try it

The button below reassigns `rows` to a brand new array. That is the whole
refresh mechanism - there is no `refresh()` to call.

```svelte {runnable}
<button type="button" onclick={() => (rows = rows.map((r) => ({ ...r, salary: r.salary + 1000 })))}>
  Give everyone a raise
</button>

<SvGrid data={rows} {columns} />
```

## Refreshing one row

You do not need to refresh the whole grid to change one row. Replacing that
row's slot with a new object is enough, and it is cheaper than rebuilding the
array, because only the one row re-renders.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, renderSnippet, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
  ]

  let rows = $state<Person[]>(seed.map((p) => ({ ...p })))

  const columns: GridColumns<Person> = [
    { field: 'name',   header: 'Name',   width: 190 },
    { field: 'salary', header: 'Salary', width: 150,
      format: { type: 'currency', currency: 'USD' } },
  ]

  function raise(i: number) {
    rows[i] = { ...rows[i]!, salary: rows[i]!.salary + 5000 }
  }
</script>

<button type="button" onclick={() => raise(0)}>Raise the first row</button>

<SvGrid data={rows} {columns} />
```


## When the value did not change but the rendering should

A cell renderer that reads something outside the row - a clock, a threshold,
a currently-selected id - will not re-render when that thing moves, because the
row is untouched. Make the outside thing part of what the renderer is given and
the problem disappears; reaching for a manual refresh here is treating the
symptom.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, renderSnippet, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
  }

  const seed: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
  ]

  let threshold = $state(150000)

  const columns: GridColumns<Person> = $derived([
    { field: 'name', header: 'Name', width: 180 },
    { field: 'salary', header: 'Salary', width: 200,
      // threshold is read here, so the column list is derived and the cells
      // re-render when the slider moves. No refresh call needed.
      cell: (ctx) => renderSnippet(Money, {
        value: Number(ctx.getValue() ?? 0),
        over: Number(ctx.getValue() ?? 0) > threshold,
      }) },
  ])
</script>

{#snippet Money(props: { value: number; over: boolean })}
  <span style={props.over ? 'font-weight: 600;' : 'opacity: 0.7;'}>
    {props.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
  </span>
{/snippet}

<label>
  Highlight above {threshold.toLocaleString()}
  <input type="range" min="130000" max="180000" step="1000" bind:value={threshold} />
</label>

<SvGrid data={seed} {columns} />
```

## See also

- [Row data](../rows/row-data.md)
- [Accessing rows](../rows/accessing-rows.md)
