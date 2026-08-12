# Tutorial: a REST CRUD grid

The **one page** that wires a data grid to an existing **REST / JSON API** with
full **create / read / update / delete** - sorting, filtering, search, and paging
included. Copy the three files and run.

This is the path when you already have an HTTP API (your own, or a third party).
No database driver, no server route to write - the grid talks to your endpoint
through `createRestDataSource`.

> **Where this fits:** the same Customers screen as
> [Getting started](./getting-started.md), bound to your HTTP API instead of
> in-memory data. This page is the copy-paste path; the adapter options and the
> `ServerDataSource` contract in depth live in
> [REST & custom APIs](./rest-api.md) and [Data binding](./data-binding.md).

> **No API yet?** If your API *is* your SvelteKit app, use the built-in transport
> (`createKitHandlers` + `createKitDataSource`) instead of hand-rolling REST - see
> the [Postgres tutorial](./postgres-grid.md) for that shape, or
> [REST & custom APIs](./rest-api.md).

---

## What your API should do

`createRestDataSource` assumes a conventional collection API (all parts are
overridable, below):

| Operation | Request |
| --- | --- |
| read | `GET /api/customers?offset&limit&sort&search` -> `{ rows, rowCount }` |
| create | `POST /api/customers` with the new row |
| update | `PATCH /api/customers/{id}` with the changed fields |
| delete | `DELETE /api/customers/{id}` |

The read response returns the page of rows plus a **total count** (a `rowCount` /
`total` field, or a `Content-Range` header) so the pager can show "1 to 10 of 240".

## Step 1 - Install

```bash
npm i @svgrid/grid @svgrid/enterprise
```

## Step 2 - Describe the resource once

One `EntitySchema` drives the grid columns, the edit form, and validation. Create
`src/lib/customers.ts`:

```ts
import type { EntitySchema } from '@svgrid/enterprise'

export type Customer = {
  id: string
  name: string
  email: string
  tier: 'free' | 'pro' | 'enterprise'
  mrr: number
  active: boolean
}

export const customersSchema: EntitySchema<Customer> = {
  name: 'customers',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true, minLength: 2 },
    { field: 'email', type: 'text', label: 'Email', required: true, format: 'email' },
    { field: 'tier', type: 'enum', options: [
      { value: 'free', label: 'Free' },
      { value: 'pro', label: 'Pro' },
      { value: 'enterprise', label: 'Enterprise' },
    ] },
    { field: 'mrr', type: 'number', label: 'MRR ($)', min: 0 },
    { field: 'active', type: 'boolean' },
  ],
}
```

## Step 3 - Point the grid at your API

`createRestDataSource` maps the grid's sort, filter, paging, and CRUD onto HTTP
calls. Create `src/lib/customers.source.ts`:

```ts
import { createRestDataSource } from '@svgrid/enterprise'
import { customersSchema, type Customer } from '$lib/customers'

export const customersSource = createRestDataSource<Customer>({
  url: '/api/customers',
  schema: customersSchema,                                   // resolves the id for update/delete
  headers: () => ({ authorization: `Bearer ${localStorage.token}` }), // optional
})
```

**Different wire format?** Shape the read params with `buildQuery` and read rows +
total out of your response with `parse`:

```ts
createRestDataSource<Customer>({
  url: '/api/customers',
  schema: customersSchema,
  buildQuery: (req) => ({ page: String(req.pageIndex + 1), size: String(req.pageSize) }),
  parse: (body) => ({ rows: body.results, rowCount: body.count }),
})
```

For a truly unusual API, implement the four `ServerDataSource` methods by hand
instead - see [REST & custom APIs](./rest-api.md).

## Step 4 - The grid + CRUD page

Create `src/routes/customers/+page.svelte`:

```svelte
<script lang="ts">
  import { SvGrid, createServerDataSource, type ServerState } from '@svgrid/grid'
  import { SvGridEditPanel, schemaToColumns } from '@svgrid/enterprise'
  import { customersSchema, type Customer } from '$lib/customers'
  import { customersSource } from '$lib/customers.source'

  const columns = schemaToColumns(customersSchema)

  let view = $state<ServerState<Customer>>({
    rows: [], total: 0, loading: false, saving: false, error: null,
    pageIndex: 0, pageSize: 10, pageCount: 1, sortModel: [], filterModel: {},
  })
  let editing = $state<Customer | null | undefined>(undefined)
  let selectedRows = $state<Customer[]>([])

  const controller = createServerDataSource(customersSource, {
    pageSize: 10, optimistic: true, getRowId: (r) => r.id,
    onChange: (s) => (view = s),
  })
  controller.refresh()

  async function save({ mode, id, values }) {
    if (mode === 'create') await controller.createRow(values)
    else if (id != null) await controller.updateRow(String(id), values)
    editing = undefined
  }
  async function removeSelected() {
    for (const row of selectedRows) await controller.deleteRow(String(row.id))
    selectedRows = []
  }
</script>

<div style="display:flex; gap:8px; margin-bottom:8px;">
  <button onclick={() => (editing = null)}>+ New customer</button>
  <button disabled={selectedRows.length === 0} onclick={removeSelected}>Delete selected</button>
</div>

<SvGrid
  data={view.rows} {columns} loading={view.loading}
  fitColumns enableRowSummaries={false}
  selectionMode="row" onRowSelectionChange={(_, rows) => (selectedRows = rows)}
  sortable externalSort onSortingChange={(s) => controller.setSort(s)}
  filterable filterMode="row" showGlobalFilter externalFilter
  onFiltersChange={(f) => controller.setFilter({
    global: f.global || undefined,
    columns: Object.fromEntries(f.columns.map((c) => [c.id, { operator: c.operator, value: c.value, valueTo: c.valueTo, selectedValues: c.selectedValues }])),
  })}
  onRowClick={(e) => (editing = e.row)}
  showPagination externalPagination
  rowCount={view.total} pageIndex={view.pageIndex} pageSize={view.pageSize}
  onPaginationChange={({ pageIndex, pageSize }) =>
    pageSize !== view.pageSize ? controller.setPageSize(pageSize) : controller.setPage(pageIndex)}
/>

{#if editing !== undefined}
  <SvGridEditPanel schema={customersSchema} row={editing} presentation="modal"
    onSubmit={save} onCancel={() => (editing = undefined)} />
{/if}
```

## Step 5 - Run it

```bash
npm run dev
```

Open **`/customers`**:

![A REST-backed CRUD grid: sortable, filterable customer rows with a filter row and a native pager.](/docs-media/studio-data-app.png)

Every header click, filter keystroke, page change, and edit becomes an HTTP call
to your API - the grid stays a thin, server-driven view.

---

## What made this work

- **One schema** described the resource; grid, form, and validation came from it.
- **`createRestDataSource`** turned the grid's request into HTTP calls - the same
  [ServerDataSource](./data-binding.md) contract every other backend implements,
  so the page is identical to the SQL and Supabase versions.

## Next steps

- **Auth headers** - the `headers` callback runs per request; return a fresh token
  each time.
- **A SvelteKit API** - skip hand-rolled REST with the built-in transport
  (`createKitHandlers` + `createKitDataSource`) - see [REST & custom APIs](./rest-api.md).
- **A database instead** - see the [Postgres](./postgres-grid.md) or
  [Supabase](./supabase-grid.md) tutorials.

## See also

- [REST & custom APIs](./rest-api.md) - the full reference (overrides, by-hand, transport)
- [Data binding](./data-binding.md) - the `ServerDataSource` contract
- [OData & GraphQL](./odata-graphql.md) - map the request to those query languages
