# @svgrid/create-studio

Scaffold a runnable **SvGrid Studio** data app in one command.

```bash
npm create @svgrid/studio@latest
# or into a named directory
npm create @svgrid/studio@latest my-data-app
# pnpm / yarn
pnpm create @svgrid/studio my-data-app
yarn create @svgrid/studio my-data-app
```

Then:

```bash
cd my-data-app
npm install
npm run dev
```

## From your own schema

Point it at an existing **Drizzle** `schema.ts` or **Prisma** `schema.prisma`
(auto-detected) and it scaffolds a screen for every table/model instead of the
seeded example - foreign keys become searchable lookups:

```bash
npm create @svgrid/studio@latest my-app -- --from ./prisma/schema.prisma
npm create @svgrid/studio@latest my-app -- --from ./src/lib/db/schema.ts
```

## From a designer project

Export a `studio.config.json` from the [visual app designer](https://www.svgrid.com/docs/enterprise/studio/app-designer)
and generate the exact screens + blocks you arranged:

```bash
npm create @svgrid/studio@latest my-app -- --project ./studio.config.json
```

## What you get

A full [SvelteKit](https://svelte.dev/docs/kit) app - not a snippet - wired end to end:

- **Nav shell + modern theme** (plain CSS, light/dark aware, no Tailwind).
- **Two linked entities** - Customers and Orders - where an order references a
  customer through a **searchable lookup** field.
- **Grid + modal CRUD** on every screen: sort, filter, global search, paging,
  multi-select delete, and a draggable / resizable / pinnable edit modal - all
  driven by a single `EntitySchema` per entity.
- **Seeded in-memory data**, so it runs with **no backend to set up**.

Everything is schema-driven. Open [`src/lib/schemas.ts`](templates/default/src/lib/schemas.ts),
add a field, and it appears in both the grid and the form.

## Going to a real database

The starter's data sources are the only thing tied to in-memory storage. Swap
`createInMemoryDataSource` in `src/lib/data.ts` for a real adapter - or generate
a connected entity from an existing table:

```bash
npx @svgrid/studio add public.invoices --db postgres --url "$DATABASE_URL"
```

The grid, form, sorting, filtering, and paging keep working unchanged.

## Requirements

- Node.js >= 18

## Links

- Docs: https://www.svgrid.com/docs/studio
- Grid: [`@svgrid/grid`](https://www.npmjs.com/package/@svgrid/grid)
- Studio / enterprise: [`@svgrid/enterprise`](https://www.npmjs.com/package/@svgrid/enterprise)
