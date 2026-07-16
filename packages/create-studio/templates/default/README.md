# My Studio App

A data app built with [SvGrid Studio](https://www.svgrid.com/docs/studio).

```bash
npm install
npm run dev      # http://localhost:5173
```

## How it works

Each screen is driven by one `EntitySchema`. A schema describes an entity's
fields once, and that single definition drives:

- the **grid** columns, sorting, filtering, and paging,
- the **edit form** (controls + validation), and
- the generated code when you scaffold from a real database.

### Where things live

| File | What it does |
| --- | --- |
| `src/lib/schemas.ts` | The entity definitions. Add a field here and it shows up in the grid and the form. |
| `src/lib/data.ts` | The data sources. Seeded in-memory by default; swap for a real adapter when ready. |
| `src/lib/EntityScreen.svelte` | The reusable grid + modal CRUD screen. |
| `src/routes/` | One route per entity, plus the nav shell (`+layout.svelte`) and home page. |

### Add a field

Open `src/lib/schemas.ts`, add an entry to a schema's `fields` array (and the
matching property on its TypeScript type), and it appears in both the grid and
the edit form on the next reload.

### Connect a real database

The in-memory sources in `src/lib/data.ts` are the only thing tied to fake data.
Replace `createInMemoryDataSource` with `createSqlDataSource` or
`createSupabaseDataSource`, or generate a connected entity:

```bash
npx @svgrid/studio add public.invoices --db postgres --url "$DATABASE_URL"
```

Sorting, filtering, paging, and CRUD keep working unchanged.

## Scripts

- `npm run dev` - start the dev server
- `npm run build` - production build
- `npm run preview` - preview the production build
- `npm run check` - type-check with `svelte-check`
