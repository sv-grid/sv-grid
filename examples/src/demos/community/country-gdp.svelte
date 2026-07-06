<!--
  title: World economies
  author: SvGrid team
  github: sv-grid
  tags: sorting, custom cells, formatting
  discussion: 0
-->
<script lang="ts">
  /**
   * A country table with a flag, GDP shown as an in-cell bar relative to the
   * largest economy, population formatting, and a coloured growth rate. Click a
   * header to sort. Self-contained - inline data, only @svgrid/grid.
   */
  import { SvGrid, renderSnippet, tableFeatures, rowSortingFeature, type ColumnDef } from '@svgrid/grid'

  type Country = { id: number; flag: string; name: string; gdp: number; population: number; growth: number }

  const features = tableFeatures({ rowSortingFeature })

  const rows: Country[] = [
    { id: 1, flag: '🇺🇸', name: 'United States', gdp: 27_360, population: 335_000_000, growth: 2.5 },
    { id: 2, flag: '🇨🇳', name: 'China',         gdp: 17_790, population: 1_411_000_000, growth: 5.2 },
    { id: 3, flag: '🇩🇪', name: 'Germany',       gdp: 4_460,  population: 84_000_000,   growth: -0.3 },
    { id: 4, flag: '🇯🇵', name: 'Japan',         gdp: 4_210,  population: 124_000_000,  growth: 1.9 },
    { id: 5, flag: '🇮🇳', name: 'India',         gdp: 3_550,  population: 1_428_000_000, growth: 7.8 },
    { id: 6, flag: '🇬🇧', name: 'United Kingdom', gdp: 3_340, population: 67_000_000,   growth: 0.1 },
    { id: 7, flag: '🇧🇷', name: 'Brazil',        gdp: 2_170,  population: 216_000_000,  growth: 2.9 },
    { id: 8, flag: '🇨🇦', name: 'Canada',        gdp: 2_140,  population: 40_000_000,   growth: 1.1 },
  ]

  const MAX_GDP = Math.max(...rows.map((r) => r.gdp))

  const columns: ColumnDef<typeof features, Country>[] = [
    { id: 'country', header: 'Country', width: 200, cell: (ctx) => renderSnippet(CountryCell, { row: ctx.row.original }) },
    { field: 'gdp', header: 'GDP (US$ bn)', width: 220, cell: (ctx) => renderSnippet(Gdp, { v: Number(ctx.getValue()) }) },
    { field: 'population', header: 'Population', width: 140, align: 'right', format: { type: 'number', options: { notation: 'compact', maximumFractionDigits: 1 } } },
    { field: 'growth', header: 'Growth', width: 110, align: 'right', cell: (ctx) => renderSnippet(Growth, { v: Number(ctx.getValue()) }) },
  ]

  const fmtBn = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)}T` : `${v}B`)
</script>

{#snippet CountryCell(p: { row: Country })}
  <span class="ctry"><span class="flag">{p.row.flag}</span>{p.row.name}</span>
{/snippet}

{#snippet Gdp(p: { v: number })}
  <span class="gdp">
    <span class="gdp-bar"><span class="gdp-fill" style={`width:${(p.v / MAX_GDP) * 100}%`}></span></span>
    <span class="gdp-n">${fmtBn(p.v)}</span>
  </span>
{/snippet}

{#snippet Growth(p: { v: number })}
  <span class="grw {p.v >= 0 ? 'up' : 'down'}">{p.v >= 0 ? '+' : ''}{p.v.toFixed(1)}%</span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="text-sm shrink-0" style="color: var(--sg-muted)">Click a header to sort. A community-contributed demo.</div>
  <div class="flex-1 min-h-0">
    <SvGrid data={rows} columns={columns} features={features} showRowNumbers={false} showPagination={false} rowHeight={40} containerHeight="100%" fitColumns={true} />
  </div>
</section>

<style>
  .ctry { display: inline-flex; align-items: center; gap: 9px; font-weight: 500; }
  .flag { font-size: 18px; }
  .gdp { display: inline-flex; align-items: center; gap: 9px; width: 100%; }
  .gdp-bar { flex: 1; height: 8px; border-radius: 999px; background: color-mix(in oklab, var(--sg-muted) 18%, transparent); overflow: hidden; }
  .gdp-fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #6366f1, #22d3ee); }
  .gdp-n { font-size: 11.5px; color: var(--sg-muted); font-variant-numeric: tabular-nums; min-width: 52px; text-align: right; }
  .grw { font-weight: 600; font-variant-numeric: tabular-nums; }
  .grw.up { color: #16a34a; }
  .grw.down { color: #dc2626; }
</style>
