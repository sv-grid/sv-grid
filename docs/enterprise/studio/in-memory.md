# In-memory

The in-memory source runs a full CRUD data screen against a plain array - no
database, no API. It applies the grid's filter, global search, sort, and paging
in memory, and supports create / update / delete. Ideal for prototyping a schema,
tests, demos, static reference data, or seeding a screen before the backend
exists.

![A full CRUD screen sends filter, search, sort, page, and create/update/delete through the in-memory source, which applies them to a plain array in memory - no database, no API.](/docs-media/studio-in-memory.svg)

It is the default backend the CLI emits when you scaffold from a
[Drizzle schema](./drizzle.md) without `--db`, so the screen runs the moment you
`npm run dev`.

## Usage

```ts
import { createServerDataSource } from '@svgrid/grid'
import { createInMemoryDataSource } from '@svgrid/enterprise'
import { customersSchema, type CustomersRow } from '$lib/customers.schema'

const seed: CustomersRow[] = [
  { id: '1', name: 'Ada Lovelace', email: 'ada@analytic.io', mrr: 1200, active: true },
  { id: '2', name: 'Alan Turing', email: 'alan@bletchley.uk', mrr: 240, active: true },
  // ...
]

const source = createInMemoryDataSource(seed, customersSchema)

const controller = createServerDataSource(source, {
  pageSize: 25,
  optimistic: true,
  getRowId: (r) => r.id,
  onChange: (s) => (view = s),
})
controller.refresh()
```

`createInMemoryDataSource(rows, schema)` returns a full `ServerDataSource`
(read + create + update + delete). Everything the grid asks for - filter
operators, facet selections, global search, multi-column sort, paging - is
applied to the array, exactly like a real backend, so you can build the whole
screen and swap in a database later without changing the UI.

## Server route

To expose it behind a SvelteKit API route (as the generated code does):

```ts
// src/routes/api/customers/+server.ts
import { createInMemoryDataSource, createKitHandlers } from '@svgrid/enterprise'
import { customersSchema, type CustomersRow } from '$lib/customers.schema'

const source = createInMemoryDataSource<CustomersRow>([], customersSchema)
export const { POST } = createKitHandlers({ schema: customersSchema, source })
```

## Reseeding and fixtures

`createInMemoryDataSource(rows, schema)` copies the rows in - the array you pass
is a seed, not a live binding. Load it from a JSON fixture to keep sample data out
of your components:

```ts
import seed from '$lib/fixtures/customers.json'
const source = createInMemoryDataSource(seed, customersSchema)
```

Because the data lives inside the source, a fresh `createInMemoryDataSource(...)`
is a clean slate - handy between tests, or behind a "reset demo data" button.

## In tests

The source is a plain object implementing `ServerDataSource`, so you can exercise
the whole screen's data behaviour directly - no DOM, no database:

```ts
import { describe, it, expect } from 'vitest'
import { createInMemoryDataSource } from '@svgrid/enterprise'
import { customersSchema, type CustomersRow } from '$lib/customers.schema'

describe('customers screen data', () => {
  it('filters, sorts, creates, and deletes', async () => {
    const source = createInMemoryDataSource<CustomersRow>([
      { id: '1', name: 'Ada Lovelace', email: 'ada@analytic.io', mrr: 1200, active: true },
      { id: '2', name: 'Alan Turing', email: 'alan@bletchley.uk', mrr: 240, active: false },
    ], customersSchema)

    // read a page exactly the way the grid asks (see Data binding)
    const page = await source.getRows({
      startRow: 0, endRow: 25, pageIndex: 0, pageSize: 25,
      sortModel: [{ id: 'mrr', desc: true }],
      filterModel: { columns: { active: { operator: 'equals', value: 'true' } } },
    })
    expect(page.rowCount).toBe(1)
    expect(page.rows[0]!.name).toBe('Ada Lovelace')

    const created = await source.createRow!({ name: 'Grace Hopper', email: 'grace@navy.mil', mrr: 900, active: true })
    await source.deleteRow!(created.id)
  })
})
```

It is the same `ServerRequest` the grid sends at runtime, so a test that passes
here is a screen that behaves.

## When to move on

The in-memory source keeps its data in the server process, so it resets on
restart and is not shared across instances. When you are ready for persistence,
switch to a [database](./databases.md) or a [custom source](./rest-api.md) - the
schema, grid, and form stay exactly the same.

## See also

- [Data binding](./data-binding.md) · [Databases](./databases.md) · [Drizzle schema](./drizzle.md)
