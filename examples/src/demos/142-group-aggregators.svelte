<!-- Documented in: docs/help/grouping/aggregators.md -->
<script lang="ts">
  /**
   * 142. Group aggregators
   * ----------------------
   * Declarative per-column aggregation for group rows. Set `aggregate` on a
   * column and the group header shows the rolled-up value, formatted with the
   * column's own `format`:
   *
   *   { field: 'revenue', aggregate: 'sum',  format: { type: 'currency' } }
   *   { field: 'winRate', aggregate: 'avg',  format: { type: 'percent' } }
   *   { field: 'score',   aggregate: (vals) => median(vals) }   // custom
   *
   * Built-ins: sum, avg, min, max, count, countDistinct, extent, first -
   * plus any custom (values, rows) => value reducer.
   */
  import {
    SvGrid,
    tableFeatures,
    columnGroupingFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  const features = tableFeatures({ columnGroupingFeature })

  type Row = {
    id: number
    rep: string
    region: string
    revenue: number
    deals: number
    winRate: number
    score: number
  }

  let seed = 0xa11ce
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  const REGIONS = ['Americas', 'EMEA', 'APAC']
  const NAMES = ['Ada', 'Grace', 'Alan', 'Margaret', 'Linus', 'Donald', 'Brian', 'Dennis', 'Barbara', 'Ken', 'Edsger', 'Tim']
  const rows: Row[] = NAMES.flatMap((name, i) =>
    REGIONS.map((region, j) => ({
      id: i * 3 + j,
      rep: name,
      region,
      revenue: Math.round(20_000 + rnd() * 200_000),
      deals: Math.round(2 + rnd() * 40),
      winRate: Math.round(rnd() * 100) / 100,
      score: Math.round(rnd() * 100),
    })),
  )

  const median = (vals: number[]): number => {
    if (!vals.length) return 0
    const s = [...vals].sort((a, b) => a - b)
    return s[Math.floor(s.length / 2)]!
  }

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'region', header: 'Region', width: 140 },
    { field: 'rep', header: 'Rep', width: 130 },
    {
      field: 'revenue',
      header: 'Revenue',
      width: 150,
      aggregate: 'sum',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    },
    { field: 'deals', header: 'Deals', width: 110, aggregate: 'sum', align: 'right' },
    {
      field: 'winRate',
      header: 'Win rate',
      width: 120,
      aggregate: 'avg',
      align: 'right',
      format: { type: 'percent' },
    },
    {
      field: 'score',
      header: 'Median score',
      width: 130,
      aggregate: median,
      align: 'right',
    },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div
    class="shrink-0 rounded-lg border px-4 py-3"
    style="border-color: var(--sg-border); background: var(--sg-header-bg);"
  >
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Per-column rollups via <code>aggregate</code>
    </p>
    <p class="mt-1 text-xs" style="color: var(--sg-muted);">
      Grouped by Region. Revenue + Deals = sum, Win rate = avg, Median score =
      a custom reducer. Each rollup is formatted with its column's
      <code>format</code> and shown in the group header. Use the column menu to
      group by another field.
    </p>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      groupable
      selectionMode="none"
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(a) => {
        api = a
        queueMicrotask(() => a.setGroupBy(['region']))
      }}
    />
  </div>
</section>
