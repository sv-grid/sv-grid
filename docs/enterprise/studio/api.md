# Studio API reference

Every Studio export in one place, grouped by what it does. Each links to the guide
with the full detail. All are imported from **`@svgrid/enterprise`** unless noted;
`createServerDataSource` is from `@svgrid/grid`.

## Data sources

Each returns a [`ServerDataSource`](./data-binding.md) - the one contract the grid,
form, sorting, filtering, paging, and CRUD all speak.

| Function | Signature (key options) | Guide |
| --- | --- | --- |
| `createInMemoryDataSource` | `(rows, schema)` | [In-memory](./in-memory.md) |
| `createSqlDataSource` | `({ schema, table, dialect, execute, dbSchema?, returning? })` - `dbSchema` qualifies the table as `"schema"."table"` | [Databases](./databases.md) |
| `createSupabaseDataSource` | `({ client, table, schema, searchColumns? })` | [Supabase](./supabase.md) |
| `createRestDataSource` | `({ url, schema, headers?, query?, buildQuery?, parse? })` | [REST & custom APIs](./rest-api.md) |
| `offsetLimitAdapter` / `dummyJsonAdapter` / `jsonServerAdapter` | wire-format `{ buildQuery, parse }` presets for real server paging/sort - spread into `createRestDataSource` | [REST & custom APIs](./rest-api.md#adapters-for-common-apis) |
| `createKitDataSource` | `({ endpoint })` - the SvelteKit-transport client | [REST & custom APIs](./rest-api.md) |

## Controller & transport

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `createServerDataSource` *(from `@svgrid/grid`)* | `(source, { pageSize, optimistic?, getRowId, onChange })` | Reactive controller: state, lifecycle, optimistic CRUD. Methods: `refresh` / `setSort` / `setFilter` / `setPage` / `setPageSize` / `createRow` / `updateRow` / `deleteRow`. See [Data binding](./data-binding.md). |
| `createKitHandlers` | `({ schema, source })` -> `{ POST }` | Server-side handler for a `+server.ts` route; one JSON endpoint for read + CRUD. |
| `withEntityRules` | `(source, schema)` -> `ServerDataSource` | Wrap a source so [computed fields + hooks](./business-logic.md) apply on read/write. |

## Schema helpers

| Function | Signature | Returns |
| --- | --- | --- |
| `schemaToColumns` | `(schema)` | `ColumnDef[]` for `<SvGrid>`. |
| `schemaToFormFields` | `(schema)` | Field descriptors for `<SvGridEditPanel>`. |
| `resolveIdField` | `(schema)` | The id field name. |
| `validateField` | `(field, value)` | Built-in validation result. |
| `applyComputed` | `(schema, row)` | Row with [computed fields](./business-logic.md) materialized. |

See [The EntitySchema](./schema.md) for the model these read.

## Components

| Component | Key props | Guide |
| --- | --- | --- |
| `SvGridEditPanel` | `schema`, `row`, `presentation` (`modal` \| `drawer` \| `inline`), `onSubmit({ mode, id, values })`, `onCancel` | [Edit forms](./edit-forms.md) |
| `SvGridMasterDetail` | `schema`, `data`, `detailSchema`, `getChildren`, `containerHeight?`, `detailHeight?` | [Master-detail](./master-detail.md) |
| `SvSchemaDashboard` | `schema`, `rows` \| `getAggregate`, `spec?`, `refreshKey?`, `filterModel?`, `onDrill?` | [Dashboards](./dashboards.md) |
| `SvSchemaChart` | schema-bound chart (dimension / measure / reduce / type) | [Dashboards](./dashboards.md) |
| `SvSchemaDesigner` | `schema`, `onChange?`, `showPreview?` | [Schema designer](./designer.md) (embeddable, single entity) |
| `SvStudioDesigner` | `project`, `onChange?` | [Visual app designer](./app-designer.md) |
| `SvLookupInput` / `createRelationLookup` | searchable foreign-key picker over any `ServerDataSource` | [Relations](./relations.md) |
| `SvAuthGate` | `client`, `title?` | [Auth](./auth.md) |

## Auth & realtime

| Symbol | Signature | Guide |
| --- | --- | --- |
| `createSupabaseAuth` | `({ client, onChange })` -> `{ signIn, signUp, signOut, getState, dispose }` | [Auth](./auth.md) |
| `createSupabaseRealtime` | live refetch / row-flash on Postgres change streams | [Real-time](./realtime.md) |
| `introspectSupabaseTable` | `({ url, key, table })` -> `EntitySchema` (reads columns + FKs) | [Supabase](./supabase.md) |
| `listSupabaseTables` | `(url, key)` -> `string[]` (table names from the PostgREST doc) | [Supabase](./supabase.md) |

## Designer & project model

| Symbol | Signature | Purpose |
| --- | --- | --- |
| `createProject` | `(schemas, { title })` -> `StudioProject` | Seed a designer project (one screen per entity). |
| `serializeProject` / `parseProject` | `(project)` / `(json)` | Save / reopen a `studio.config.json`. |
| `emitStudioProject` | `(project)` -> `{ path, contents, description }[]` | The app's source files. |

See the [visual app designer](./app-designer.md).

## Types

`EntitySchema`, `EntityField`, `DashboardSpec` (from `@svgrid/enterprise`);
`ServerDataSource`, `ServerRequest`, `ServerState`, `ColumnDef` (from
`@svgrid/grid`). The [EntitySchema reference](./schema.md) documents the field
options in full.

## See also

- [Data binding](./data-binding.md) - the `ServerDataSource` contract
- [The EntitySchema](./schema.md) - the model everything derives from
- [SvGrid Studio overview](../studio.md)
