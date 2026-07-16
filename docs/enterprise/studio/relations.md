# Relations & master-detail

Real apps have related entities - a company has many deals, an order has many
line items. Studio models relations in the `EntitySchema` and turns them into
**master-detail** screens (a row that expands into a nested grid) and
**relation pickers** in the edit form.

## Auto-detected from foreign keys

You usually don't declare relations by hand - introspection reads your
**foreign keys** and emits `relation` fields for you:

- **Databases** (`introspectDatabase`, the CLI `--db`) read FK constraints from
  the catalog (Postgres/MySQL/SQL Server `information_schema`, SQLite
  `PRAGMA foreign_key_list`).
- **Supabase** (`introspectSupabaseTable`) reads the foreign keys PostgREST
  publishes in its OpenAPI document.

A detected FK column becomes a `relation` field pointing at the referenced table.
The **generated page wires the lookup for you** - the CLI emits a
`createRelationLookup` over the related entity's API route and passes it to the
edit panel (so scaffold the related table too). The
[Supabase demo](https://svgrid.com/#/demos/194-studio-supabase) does the same at
runtime. When you introspect several tables at once,
`linkRelationLabels(schemas)` fills in each relation's display field from the
actual related schema (a `name` / `title` column, else its first text field).

The rest of this page covers doing it explicitly (or refining what was detected).

## Model the relation

A child entity points at its parent with a `relation` field:

```ts
// the parent
const companySchema: EntitySchema = {
  name: 'companies',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
  ],
}

// the child - `companyId` relates to a company
const dealSchema: EntitySchema = {
  name: 'deals',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'title', type: 'text', required: true },
    { field: 'amount', type: 'number', min: 0 },
    {
      field: 'companyId',
      type: 'relation',
      label: 'Company',
      relation: { entity: 'companies', foreignKey: 'companyId', labelField: 'name' },
    },
  ],
}
```

The `relation` descriptor records:

| Key | Meaning |
| --- | --- |
| `entity` | the related schema's `name` (here `companies`) |
| `foreignKey` | the column on **this** entity holding the related id (defaults to `field`) |
| `labelField` | which field of the related entity to show the user |

## Master-detail from the relation

`SvGridMasterDetail` expands a **parent** row into a nested grid of its
**children**. Use the relation's foreign key to return the children for a parent:

```svelte
<script lang="ts">
  import { SvGridMasterDetail } from '@svgrid/enterprise'
  import { companySchema, dealSchema } from '$lib/schemas'

  const companies = [/* ... */]
  const deals = [/* ... */]
</script>

<SvGridMasterDetail
  schema={companySchema}
  data={companies}
  detailSchema={dealSchema}
  getChildren={(company) => deals.filter((d) => d.companyId === company.id)}
/>
```

`getChildren` is where the relation is realized - filter the child rows by the
`foreignKey` (`companyId`) equal to the parent's id. Both grids derive from an
`EntitySchema`, so the nested deals grid gets the right columns, types, and
formatting automatically.

### Server-side children

When children are fetched from a backend, cache them by parent id and populate on
expand:

```ts
const cache = new Map<string, Deal[]>()
async function childrenFor(company: Company): Promise<Deal[]> {
  if (!cache.has(company.id)) {
    cache.set(company.id, await fetchDeals(company.id)) // GET /api/deals?companyId=...
  }
  return cache.get(company.id)!
}
```

## Lookup picker in the edit form

A `relation` field renders as a **searchable lookup** - the user types to search
the related entity, sees human labels, and the form stores the id. Build a
lookup with **`createRelationLookup`** (over the related entity's
`ServerDataSource`) and pass it to the edit panel:

```svelte
<script lang="ts">
  import { SvGridEditPanel, createRelationLookup, createInMemoryDataSource } from '@svgrid/enterprise'
  import { companySchema, dealSchema } from '$lib/schemas'

  const companiesSource = createInMemoryDataSource(companies, companySchema) // or Supabase/REST/SQL
  const companyLookup = createRelationLookup({
    source: companiesSource,   // any ServerDataSource for the related entity
    schema: companySchema,     // resolves the related primary key
    labelField: 'name',        // what the user sees
  })
</script>

<SvGridEditPanel
  schema={dealSchema}
  row={editing}
  lookups={{ companyId: companyLookup }}
  onSubmit={save}
/>
```

That's it. The `companyId` field now renders `SvLookupInput`: type to search
(server-side, debounced), pick a company, and the id is stored. Because the
lookup is just a `ServerDataSource`, the options can come from **Supabase, REST,
SQL, or in-memory** - whatever backs the related table.

> **Live demo:** [Data-app Studio · relations](https://svgrid.com/#/demos/195-studio-relations)
> - Contacts with a searchable Company picker.

### Show the related name in the grid

The grid stores the foreign key, so show the label instead of the id. Either
join it in on read (e.g. Supabase `select('*, company:companies(name)')`, or map
it in your source's `getRows`) into a display field, or resolve it with the same
lookup's `labelFor(id)`.

> **Enrich every method, not just `getRows`.** With optimistic updates, the grid
> reconciles an edited row with what `createRow` / `updateRow` return - so a
> display field you add only in `getRows` will vanish after an edit. Map the same
> join over the rows those methods return, too.

### Static options (no search)

For a small, fixed set, skip the lookup and give the `relation` (or `enum`) field
plain `options` - it renders as a simple `<select>`:

```ts
{ ...companyIdField, options: companies.map((c) => ({ value: c.id, label: c.name })) }
```

## See also

- [Master-detail](./master-detail.md) - the component reference
- [The EntitySchema](./schema.md) - the `relation` field type
- [Tutorial: build a CRM](./tutorial-crm.md) - relations end to end
