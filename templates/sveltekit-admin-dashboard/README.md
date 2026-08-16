# SvGrid Admin Dashboard (SvelteKit starter)

A production-ready admin dashboard built with **[SvelteKit](https://svelte.dev/docs/kit)**
and **[SvGrid](https://svgrid.com)** - the Svelte 5 data grid and data table.
Sortable, filterable, editable grids; KPI cards; a sidebar shell; prerendered
to static HTML for SEO; one-click deploy to Vercel.

![SvGrid + SvelteKit](https://img.shields.io/badge/SvelteKit-SvGrid-4f46e5)

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsv-grid%2Fsv-grid%2Ftree%2Fmain%2Ftemplates%2Fsveltekit-admin-dashboard&project-name=sv-grid-admin&repository-name=sv-grid-admin)

> Deploying from this monorepo subfolder? In the Vercel import step set the
> **Root Directory** to `templates/sveltekit-admin-dashboard`. Or scaffold a
> standalone copy first (recommended):
>
> ```bash
> npm create @svgrid@latest my-admin -- --template admin-dashboard
> ```

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # static + serverless output via adapter-vercel
npm run preview  # preview the production build
npm run check    # svelte-check (types)
```

## What's inside

| Path | What it shows |
| --- | --- |
| `src/routes/+layout.svelte` | App shell: sidebar nav + top bar |
| `src/routes/+page.svelte` | Overview: KPI cards + a recent-orders grid |
| `src/routes/orders/+page.svelte` | Full grid: sort, filter, **row select**, inline edit, pagination |
| `src/routes/customers/+page.svelte` | Grid with **column grouping** (drag a column to the group bar) |
| `src/lib/data.ts` | Deterministic sample data - swap for your API / `load()` |
| `src/lib/types.ts` | `Order` / `Customer` row types |

The grids mount client-side (`{#if browser}`) while the shell and headings
prerender to crawlable HTML - good for SEO and instant first paint. Every
route is `prerender = true` (see `src/routes/+layout.ts`); delete that line
on any route that needs SSR or runtime data.

## Wiring your own data

Replace the calls to `makeOrders()` / `makeCustomers()` in each route with a
SvelteKit [`load`](https://svelte.dev/docs/kit/load) function:

```ts
// src/routes/orders/+page.ts
export async function load({ fetch }) {
  const orders = await fetch('/api/orders').then((r) => r.json())
  return { orders }
}
```

Then read `data.orders` in the page via `let { data } = $props()`.

## Upgrade to Pro

This starter uses the free MIT **`@svgrid/grid`** core, which already includes
the AI helpers. For Excel/PDF export, data import, printing, and pivot tables,
add [`@svgrid/enterprise`](https://svgrid.com/pricing/) and call
`installEnterprise(api)` on the grid's API. It runs in evaluation with a
watermark, so no key is needed to try it.

## Working with an AI assistant

Point it at the SvGrid MCP server so it writes against the real API instead of
guessing:

```bash
claude mcp add svgrid -- npx -y @svgrid/mcp
```

## License

Built with [SvGrid](https://svgrid.com). This template is MIT-licensed - use it
as the basis for your own app. SvGrid(TM) is a trademark of jQWidgets Ltd.
