# SvGrid pivot dashboard

A pivot cube, a linked chart, and a drill-through rail over one fact table -
the three pieces a reporting screen usually needs, wired so they cannot
disagree with each other.

```bash
npm install
npm run dev     # http://localhost:5173/
```

## What to try

1. **Drag `Channel` into Rows** in the panel on the right. The cube, the chart
   and any open drill all follow, because all three read the same layout.
2. **Click any aggregated cell.** The rail opens with the exact rows behind that
   number. The KPI at the top is recomputed from those rows, so it always equals
   the cell you clicked.
3. **Click a subtotal, then the grand total.** Same code path - a subtotal
   simply contributes fewer filter terms, so the slice widens. The grand total
   filters on nothing and returns all 1,800 facts.
4. **Switch the measure** to `Units` in the Values well. The chart axis, the
   rail KPI and the formatting all switch with it.
5. **Click a bar** in the chart to drill that whole dimension value.

## How the drill works

A pivot cell is the intersection of a row path and a column path, and the two
arrive in different shapes:

- the **row** path is the chain of ancestors up to the clicked `PivotRow`,
  matched positionally against `layout.rows`;
- the **column** path is encoded in the column id - `pv__<dim>__<dim>__m<i>`,
  where the trailing `m<i>` indexes into `layout.values`.

`src/lib/drill.ts` decodes both into one `{ field: value }` filter and returns
the facts that match every entry. Because the total is recomputed from those
same facts rather than read off the grid, the rail and the cube cannot drift
apart.

That module is deliberately free of Svelte and of the grid packages, so you can
unit-test your own reporting rules against it.

## Where things are

| File | Does |
| --- | --- |
| `src/lib/facts.ts` | The fact table. Seeded and deterministic. Swap `loadFacts` for your query. |
| `src/lib/drill.ts` | Pure drill-through: cell -> filter -> facts. No Svelte, no grid imports. |
| `src/routes/+page.server.ts` | Builds the facts on the server and sends them with the page. |
| `src/routes/+page.svelte` | The dashboard: designer, chart and rail over one `facts` array. |
| `src/routes/DrillRail.svelte` | The rail: KPIs plus a grid of the underlying rows. |
| `src/routes/TrendChart.svelte` | The bar chart. Inline SVG-free DOM, styled with `--sg-*`. |

## Licensing

`SvPivotDesigner` is part of `@svgrid/enterprise`, which is commercial. The app
runs unlicensed - it just nudges - so you can evaluate it before buying. Replace
the key in `src/routes/+page.svelte`:

```ts
setLicenseKey('SVENTERPRISE-DEV-DEMO')
```

Pricing: https://svgrid.com/pricing

## Going to production

The facts are generated in-process. Point `loadFacts` at your warehouse and keep
the aggregation on the server if the fact table is large - the browser should
receive facts, not a database connection. Everything downstream takes `Fact[]`,
so nothing else has to change.

Full guide: https://svgrid.com/docs/enterprise/pivot/
