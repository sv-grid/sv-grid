# Server filtering

When the data lives on the server, the grid does not filter rows itself. It
records what the user typed and emits a single **`ServerFilterModel`**, and your
backend turns that model into a `WHERE` clause. This page is a deep dive into
that model: its exact shape, the operator set, set-filter faceting, the global
quick search, and how to map all of it to a **parameterized** query with the
`normalizeFilters` helper from `@svgrid/enterprise`.

It builds on the [Server-Side Row Model](./server-row-model.md), where
`createServerDataSource` owns the request lifecycle.

![Filter inputs and a quick-search box collapse into one ServerFilterModel with global and columns, which normalizeFilters turns into parameterized WHERE predicates that fetch the filtered page from the server.](/docs-media/server-filtering.svg)

## The `ServerFilterModel` shape

Every `getRows(request)` call receives the current filter as
`request.filterModel`. It has two parts: a `global` quick-search string and a
`columns` map keyed by column id.

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

```ts
type ServerFilterModel = {
  global?: string                 // the quick-filter search box
  columns?: Record<string, {      // keyed by column id
    operator: string              // equals | contains | startsWith | greaterThan | lessThan | between | isBlank
    value: string
    valueTo?: string              // second bound, for `between`
    selectedValues?: string[]     // set-filter (facet checklist) selection
  }>
}
```

A populated model:

```json
{
  "global": "berlin",
  "columns": {
    "status":  { "operator": "equals",   "value": "active" },
    "age":     { "operator": "between",  "value": "18", "valueTo": "65" },
    "country": { "operator": "contains", "value": "", "selectedValues": ["DE", "FR"] }
  }
}
```

Each entry may carry an operator-style filter (`value` plus, for `between`, a
`valueTo`) **or** a set-filter selection (`selectedValues`), or both. When
`selectedValues` is present it wins - the checklist selection takes precedence
over the operator value.

## The operator set

`operator` is one of seven values. Map each to a predicate:

| `operator`     | SQL                                   |
| -------------- | ------------------------------------- |
| `equals`       | `col = $value`                        |
| `contains`     | `col ILIKE '%' || $value || '%'`      |
| `startsWith`   | `col ILIKE $value || '%'`             |
| `greaterThan`  | `col > $value`                        |
| `lessThan`     | `col < $value`                        |
| `between`      | `col BETWEEN $value AND $valueTo`     |
| `isBlank`      | `col IS NULL OR col = ''`             |

Any unrecognized operator is treated as `contains` - the safe, permissive
default.

## Set filters and faceting

A set filter (facet checklist) is expressed with `selectedValues`: the list of
values the user ticked. It maps to an `IN (...)` predicate:

```sql
col IN ($v0, $v1, $v2)   -- one bound parameter per selected value
```

Because `selectedValues` takes precedence over `operator` / `value`, a column
that has both a checklist selection and a typed value filters by the checklist.
Build the facet list itself with a separate `SELECT DISTINCT col` (or a
pre-computed facet count) query - the model carries only the selection, not the
available options.

## The global quick filter

`global` is the free-text quick-search box. It is not scoped to one column: it
is an **`OR` across your searchable columns**. You decide which columns are
searchable.

```sql
-- global = 'berlin'
(name ILIKE '%' || $q || '%' OR city ILIKE '%' || $q || '%' OR country ILIKE '%' || $q || '%')
```

Combine the global `OR` group with the per-column predicates using `AND`: a row
must match the quick search **and** every active column filter.

## Mapping to a parameterized WHERE

The one rule that matters: **never string-concatenate user values into SQL.**
Bind every value as a parameter so a value like `'; DROP TABLE ...` is data, not
code. The `IN (...)` list gets one placeholder per selected value; `between`
gets two.

You do not have to hand-write the operator switch. `@svgrid/enterprise` ships
`normalizeFilters(model)`, which flattens the model into one uniform list of
predicates plus the trimmed search term - the same helper the built-in REST and
SQL sources use.

```ts
import { normalizeFilters } from '@svgrid/enterprise'

const { predicates, search } = normalizeFilters(filterModel)
// predicates: Array of backend-neutral predicates over one column each -
//   { column, op: 'in',       values }          // set filter
//   { column, op: 'isNull' }                     // isBlank
//   { column, op: 'contains' | 'startsWith' | 'eq' | 'gt' | 'lt', value }
//   { column, op: 'between',  value, valueTo }
// search: the trimmed global term (or undefined)
```

`normalizeFilters` also does the tidying you would otherwise repeat in every
backend: it drops empty operator filters, trims values, prefers `selectedValues`
when present, and for `between` fills a missing bound from the other. Turning
that neutral list into bound SQL is then a small, safe switch:

```ts
function buildWhere(filterModel, searchable) {
  const { predicates, search } = normalizeFilters(filterModel)
  const clauses = []
  const params = []

  for (const p of predicates) {
    switch (p.op) {
      case 'in': {
        // one bound placeholder per selected value
        const start = params.length
        p.values.forEach((v) => params.push(v))
        const list = p.values.map((_, i) => `$${start + i + 1}`).join(', ')
        clauses.push(`${p.column} IN (${list})`)
        break
      }
      case 'isNull':     clauses.push(`(${p.column} IS NULL OR ${p.column} = '')`); break
      case 'contains':   clauses.push(`${p.column} ILIKE '%' || $${params.push(p.value)} || '%'`); break
      case 'startsWith': clauses.push(`${p.column} ILIKE $${params.push(p.value)} || '%'`); break
      case 'eq':         clauses.push(`${p.column} = $${params.push(p.value)}`); break
      case 'gt':         clauses.push(`${p.column} > $${params.push(p.value)}`); break
      case 'lt':         clauses.push(`${p.column} < $${params.push(p.value)}`); break
      case 'between':    clauses.push(`${p.column} BETWEEN $${params.push(p.value)} AND $${params.push(p.valueTo)}`); break
    }
  }

  if (search) {
    const p = params.push(search)
    const or = searchable.map((c) => `${c} ILIKE '%' || $${p} || '%'`).join(' OR ')
    clauses.push(`(${or})`)
  }

  return { where: clauses.length ? 'WHERE ' + clauses.join(' AND ') : '', params }
}
```

Every value goes through `params.push`; nothing user-supplied is interpolated
into the SQL text.

## Wiring the grid to the controller

Run the grid with `externalFilter` so it emits intent instead of filtering
locally, and forward the change to `ctl.setFilter`. Debounce the rapid changes -
each keystroke should not become its own round trip.

```svelte
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'
  import { createServerDataSource, type ServerFilterModel, type ServerState } from '@svgrid/grid'

  let view = $state<ServerState<Row>>()
  const ctl = createServerDataSource(source, {
    pageSize: 50,
    onChange: (s) => (view = s),
  })
  ctl.refresh()

  // Debounce so typing in the quick search does not fire a query per keystroke.
  let timer: ReturnType<typeof setTimeout>
  function applyFilter(model: ServerFilterModel) {
    clearTimeout(timer)
    timer = setTimeout(() => ctl.setFilter(model), 250)
  }

  // Adapt the grid's filter change into a ServerFilterModel.
  function onFiltersChange(f: { global?: string; columns?: any }) {
    applyFilter({ global: f.global, columns: toColumnModel(f.columns) })
  }
</script>

{#if view}
  <SvGrid
    data={view.rows}
    {columns} {features}
    filterable
    externalFilter
    loading={view.loading}
    pageable={false}
    {onFiltersChange}
  />
{/if}
```

`setFilter` resets to page 0 and re-fetches, so a new filter always shows its
first page of matches. The controller's monotonic request id means a slow
response for an old filter can never land after a newer one.

## Index the columns you filter

The model pushes filtering to the database, so the database has to be ready for
it. Add an index on each column you filter or sort by. `contains`
(`ILIKE '%x%'`) cannot use a plain B-tree index - reach for a trigram
(`pg_trgm`) index or a full-text column for large tables, and prefer
`startsWith` or `equals` where the UX allows, since those are index-friendly.

## Set-filter values from the server

A column's filter checklist normally lists the distinct values found in the rows
the grid has loaded - but in server mode that is only the current page, so values
that live on other pages never appear. Pass `serverFilterValues` and the grid
fetches the full distinct list from your backend the first time a column's filter
menu opens (cached per column):

```svelte
<SvGrid
  {columns}
  serverFilterValues={async (columnId) => {
    const res = await fetch(`/api/values?column=${columnId}`) // SELECT DISTINCT col ...
    return res.json() // string[]
  }}
/>
```

Now the checklist shows every value, not just the ones on screen; selecting them
drives `filterModel.columns[col].selectedValues` as usual.

## The advanced filter over the wire

`filterModel.columns` is a flat map with an implicit AND, so it cannot express
OR across columns, nesting, negation, two conditions on one column, or a
comparison against an aggregate. Those arrive separately, as a JSON expression:

```ts
filterModel.expression // GridPredicateExpr | undefined
```

### It is all or nothing

A backend that receives an expression MUST either translate **the whole thing**,
make `rowCount` reflect it, and acknowledge it:

```ts
return { rows, rowCount, appliedExpression: true }
```

or apply **none** of it and stay silent:

```ts
return { rows, rowCount } // no acknowledgement
```

Partial application is a contract violation rather than a degraded mode.
Dropping a clause makes the result *broader*, so the grid would show rows the
user's filter excluded, while the UI says the filter is on. Nothing about that
result looks wrong, which is what makes it dangerous.

### What happens when you do not apply it

The grid does **not** filter the loaded page for you. Filtering one page would
turn "3 of 1,000,000 match" into a confident lie and make paging incoherent,
since page 2 would re-filter a different slice. Instead the controller sets
`state.expressionUnapplied`, logs one warning, and leaves the rows alone, so you
can show the user that the filter did not run:

```svelte
{#if state.expressionUnapplied}
  <p role="status">
    This grid loads rows from a server that has not applied the advanced
    filter, so the results below are unfiltered.
  </p>
{/if}
```

### Using the plan seam

`planQuery` admits the expression only when every column it references is on the
`EntitySchema` - and rejects it **whole** if any is not, for the reason above.
`createInMemoryDataSource` implements the contract end to end and is the
reference to test a real backend against.

```ts
const plan = planQuery(schema, request)
if (plan.expression) {
  // Safe to translate: every column is on the schema.
  // Translate it in full, or do not acknowledge it.
}
```


## Watching the filter model come out

Before you wire a query builder, look at what the grid actually reports. Type
in the filter row below and the model appears underneath: a `global` string plus
one entry per active column, each with the operator the user picked. That object
is the whole contract - everything else on this page is a way of turning it into
SQL.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { id: number; name: string; city: string; salary: number }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   city: 'London',   salary: 142000 },
    { id: 2, name: 'Grace Hopper',   city: 'New York', salary: 168000 },
    { id: 3, name: 'Linus Torvalds', city: 'Portland', salary: 155000 },
  ]

  let model = $state('{}')

  const columns: GridColumns<Person> = [
    { field: 'name',   header: 'Name',   width: 180 },
    { field: 'city',   header: 'City',   width: 150 },
    { field: 'salary', header: 'Salary', width: 140, editorType: 'number',
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<SvGrid
  data={people}
  {columns}
  filterable
  filterMode="row"
  onFiltersChange={(f) => (model = JSON.stringify(f, null, 2))}
/>

<pre>{model}</pre>
```

## externalFilter, end to end

With `externalFilter` the grid stops narrowing the rows itself and hands the
model to you instead. The query below runs in the page rather than on a server,
but the seam is identical: model in, rows out, `data` reassigned. Note that the
grid keeps showing whatever you give it - forget to apply the filter and it will
sit there displaying everything, with the filter row full.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = { id: number; name: string; city: string; salary: number }

  const ALL: Person[] = [
    { id: 1, name: 'Ada Lovelace',   city: 'London',   salary: 142000 },
    { id: 2, name: 'Grace Hopper',   city: 'New York', salary: 168000 },
    { id: 3, name: 'Linus Torvalds', city: 'Portland', salary: 155000 },
    { id: 4, name: 'Radia Perlman',  city: 'Seattle',  salary: 161000 },
    { id: 5, name: 'Barbara Liskov', city: 'Boston',   salary: 172000 },
  ]

  let rows = $state<Person[]>(ALL)
  let sql = $state('SELECT * FROM people')

  const columns: GridColumns<Person> = [
    { field: 'name',   header: 'Name',   width: 180 },
    { field: 'city',   header: 'City',   width: 150 },
    { field: 'salary', header: 'Salary', width: 140, editorType: 'number',
      format: { type: 'currency', currency: 'USD' } },
  ]

  // The "server". One operator per branch, everything else falls through.
  function apply(f: { global: string; columns: Array<{ id: string; operator: string; value: string }> }) {
    const where: string[] = []
    let out = ALL

    if (f.global.trim()) {
      const q = f.global.trim().toLowerCase()
      out = out.filter((p) => (p.name + ' ' + p.city).toLowerCase().includes(q))
      where.push("search(:q)")
    }

    for (const c of f.columns) {
      if (!c.value) continue
      const v = c.value.toLowerCase()
      if (c.operator === 'greaterThan') {
        out = out.filter((p) => Number(p[c.id as keyof Person]) > Number(c.value))
        where.push(c.id + ' > :' + c.id)
      } else {
        out = out.filter((p) => String(p[c.id as keyof Person]).toLowerCase().includes(v))
        where.push(c.id + ' LIKE :' + c.id)
      }
    }

    rows = out
    sql = 'SELECT * FROM people' + (where.length ? ' WHERE ' + where.join(' AND ') : '')
  }
</script>

<SvGrid
  data={rows}
  {columns}
  filterable
  filterMode="row"
  externalFilter
  onFiltersChange={apply}
/>

<p><code>{sql}</code> - {rows.length} row(s)</p>
```

## Try it

The grid renders whatever rows you hand it and reports the filter model instead
of applying it. Here the "server" is a local function, so the round trip is
visible without a backend.

```svelte {runnable}
<script lang="ts">
  let shown = $state(people)
  let lastModel = $state("(none)")

  // Stands in for the fetch: same shape, no network.
  function query(model: Record<string, unknown>) {
    lastModel = JSON.stringify(model)
    const term = String((Object.values(model)[0] as { filter?: string })?.filter ?? "").toLowerCase()
    shown = term ? people.filter((p) => p.name.toLowerCase().includes(term)) : people
  }
</script>

<SvGrid data={shown} {columns} filterable externalFilter onFiltersChange={query} />

<p>Filter model sent to the server: <code>{lastModel}</code></p>
```

## See also

- [Server-Side Row Model](./server-row-model.md) - the datasource contract and request lifecycle.
- [Server editing](./server-editing.md) - the write side: create / update / delete with optimistic updates.
