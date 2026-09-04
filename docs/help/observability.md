# Observability

Production-grade visibility into a live grid: which rows users see,
which cells they edit, what they filter for, how often the imperative
API is invoked. Everything you need to wire into Sentry, Datadog,
OpenTelemetry, Honeycomb, your own pipeline.

The library is **callback-driven**: every observable event surfaces
as a prop you can subscribe to. No metrics SDK is bundled - you wire
to whatever your org already runs.

## What you can observe

| Signal              | Callback                                  | Fires when                                                       |
| ------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| Active cell move    | `onActiveCellChange`                      | User clicks / tabs / arrow-keys into a new cell                  |
| Cell edit committed | `onCellValueChange`                       | An edit lands (Enter / Tab / blur)                               |
| Row selection      | `onRowSelectionChange`                    | User toggles a row checkbox / clicks a row in `selectionMode='row'` |
| Filter change      | `onFiltersChange`                         | Any filter (menu / row / facet / global) changes                 |
| Sort change        | `onSortingChange`                         | Sort clauses change                                              |
| Grouping change    | `onGroupingChange`                        | The `groupBy` clauses change                                     |
| API ready          | `onApiReady`                              | Once, when the imperative `SvGridApi` is wired                   |

For server-side adapters (`externalSort` / `externalFilter`) the same
callbacks fire BEFORE the network call, giving you a natural place to
measure server latency.

## Recipe 1: Datadog Browser RUM

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
  import { datadogRum } from '@datadog/browser-rum'

  function track(name: string, payload: Record<string, unknown>) {
    datadogRum.addAction(name, payload)
  }
</script>

<SvGrid
  {data} {columns} features={features}
  onActiveCellChange={(cell) => track('grid.cell.focus',  cell)}
  onCellValueChange={(e)    => track('grid.cell.edit',   { columnId: e.columnId, rowId: e.row.id })}
  onFiltersChange={(f)      => track('grid.filter',      { columns: f.columns.length, hasGlobal: !!f.global })}
  onSortingChange={(s)      => track('grid.sort',        { columns: s.length })}
/>
```

PII discipline: send IDs and counts, never values. The third callback
above sends `columns: 3` (the count of active filter columns), not
the actual filter text the user typed.

## Recipe 2: Sentry breadcrumbs

```ts
import * as Sentry from '@sentry/svelte'

function crumb(category: string, message: string, data?: unknown) {
  Sentry.addBreadcrumb({ category, message, data, level: 'info' })
}
```

Then in the grid:

```svelte
<SvGrid
  ...
  onCellValueChange={(e) => crumb('grid', `edit ${e.columnId}`, { id: e.row.id })}
  onFiltersChange={(f)   => crumb('grid', 'filter change',       { n: f.columns.length })}
/>
```

When an exception fires elsewhere in the app, the Sentry event ships
with the last ~30 grid actions as breadcrumbs - massive debug time
saver.

## Recipe 3: OpenTelemetry browser SDK

```ts
import { trace } from '@opentelemetry/api'

const tracer = trace.getTracer('sv-grid')

function span<T>(name: string, fn: () => T): T {
  return tracer.startActiveSpan(name, (s) => {
    try { return fn() } finally { s.end() }
  })
}
```

Wrap the server-adapter callback so each filter change becomes one
span:

```svelte
<SvGrid
  ...
  externalFilter={true}
  onFiltersChange={(f) => span('grid.filter', async () => {
    await refetchFromServer(f)
  })}
/>
```

Now you get a flame graph that shows filter → fetch → render times
end-to-end.

## Recipe 4: Roll-your-own event bus

If your org already publishes a JS event bus / analytics layer,
adapt the same shape:

```ts
import { track } from '@your-org/analytics'

const handlers = {
  onActiveCellChange:    (c)   => track('grid_cell_focus',  { rowId: c.rowId, columnId: c.columnId }),
  onCellValueChange:     (e)   => track('grid_cell_edit',   { rowId: e.row.id, columnId: e.columnId }),
  onRowSelectionChange:  (_, rows) => track('grid_row_select', { n: rows.length }),
  onFiltersChange:       (f)   => track('grid_filter',      { n: f.columns.length }),
  onSortingChange:       (s)   => track('grid_sort',        { columns: s.map((x) => x.id) }),
}
```

Then spread:

```svelte
<SvGrid {data} {columns} features={features} {...handlers} />
```

## What good metrics look like

After a week of production traffic, the dashboards we recommend
building:

| Metric                              | Why                                                                |
| ----------------------------------- | ------------------------------------------------------------------ |
| `grid.cell.edit` count per user/day | Adoption of the inline-editing feature                              |
| `grid.filter` heatmap by column     | Which columns users filter most → priority for fast-filter UX       |
| `grid.cell.focus` columnId distribution | Are users reading every column or only 3? Inform default visibility |
| `grid.sort` columnId distribution   | Which columns deserve to be the default sort                        |
| `grid.row.count` (sampled)          | How big are the visible result sets in practice                     |
| Time between `onApiReady` and first `onActiveCellChange` | Time-to-first-interaction (proxy for perf)         |

## PII guidance

The default callbacks pass references to your row objects. If your
rows contain PII (emails, names, salaries) and your analytics
pipeline must stay PII-free:

1. **Send IDs, not row references.** `crumb({ rowId: e.row.id })` not
   `crumb({ row: e.row })`.
2. **Never send `e.newValue` / `e.oldValue`.** Send `columnId` and a
   PII-safe label only.
3. **Clip strings.** Even when sending labels, cap at ~40 chars so a
   wild paste can't leak a SSN.

See [security](./security.md) for the broader posture.

## What's NOT observable today

- **Render frame timing.** The grid uses requestAnimationFrame-driven
  virtualization; if you need per-frame metrics, wrap the page in
  Datadog's RUM long-task observer (it'll catch any frame > 50ms,
  which is the spec for "slow frame").
- **Bytes-on-the-wire.** Sv-grid never makes a network call - your
  adapter does. Measure at the adapter.
- **Memory.** Use Chrome DevTools Performance Monitor for live RSS;
  there's no in-library hook.

## Try it

Every callback the grid exposes is a hook you can forward to your telemetry.
This one just writes to the page so you can watch the stream.

```svelte {runnable}
<script lang="ts">
  let log = $state<string[]>([])
  const note = (line: string) => (log = [line, ...log].slice(0, 6))
</script>

<SvGrid
  data={people}
  {columns}
  sortable
  filterable
  onSortingChange={(s) => note("sort: " + JSON.stringify(s))}
  onFiltersChange={(f) => note("filter: " + JSON.stringify(f))}
/>

<ul>
  {#each log as line}<li><code>{line}</code></li>{/each}
</ul>
```

## See also

- [Production checklist](./production.md)
- [Server-side data](./server-side-data.md) - the natural place to add
  latency spans
- [Security](./security.md) - PII boundaries, data residency
- [API stability](./api-stability.md) - which callbacks are guaranteed
  not to be renamed
