<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 162. Calendar heatmap (year-of-days)
   * -------------------------------------
   * `type: 'calendar'` renders a GitHub-commit-style grid: 7 rows
   * (days of the week) x ~53 columns (weeks of the year). Each cell is
   * shaded by `calendarValues[i].value` via the sequential color scale;
   * days with no value render as outlined blanks so missing data is
   * visually obvious. Hover any cell for the date + value.
   *
   * The grid drives the chart: filter by activity type and the year
   * heatmap re-aggregates.
   */
  import {
    SvGrid,
    SvGridChart,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type GridColumns,
    type SvGridApi,
    type ChartSpec,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Row = { id: number; date: string; type: 'commit' | 'pr' | 'review'; count: number }
  // Year of synthetic GitHub activity: workday peaks, weekly cycle, off
  // weeks every few months.
  let seed = 0xb00ff1
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  const TYPES: Row['type'][] = ['commit', 'pr', 'review']
  let nid = 0
  const rows: Row[] = []
  for (let i = 0; i < 365; i += 1) {
    const d = new Date(2026, 0, 1 + i)
    const wd = d.getDay()
    const weekend = wd === 0 || wd === 6
    const offWeek = Math.floor(i / 7) % 9 === 0
    for (const type of TYPES) {
      let count = 0
      if (!offWeek) {
        count = type === 'commit' ? Math.round(rnd() * (weekend ? 3 : 12))
              : type === 'pr'     ? Math.round(rnd() * (weekend ? 1 : 4))
              :                     Math.round(rnd() * (weekend ? 1 : 6))
      }
      if (count > 0) rows.push({ id: nid++, date: d.toISOString().slice(0, 10), type, count })
    }
  }

  const columns: GridColumns<Row> = [
    { field: 'date',  header: 'Date',  width: 130 },
    { field: 'type',  header: 'Type',  width: 110 },
    { field: 'count', header: 'Count', width: 90, align: 'right' },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let displayed = $state<Row[]>(rows)
  function sync() { displayed = (api?.getDisplayedRows() as Row[]) ?? rows }

  const spec = $derived.by<ChartSpec>(() => {
    // Aggregate filtered rows by date.
    const byDate = new Map<string, number>()
    for (const r of displayed) byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.count)
    const calendarValues = Array.from(byDate.entries()).map(([date, value]) => ({ date, value }))
    return {
      type: 'calendar',
      categories: [],
      series: [],
      calendarValues,
      calendarStart: '2026-01-01',
      calendarEnd:   '2026-12-31',
      width: 800,
      height: 180,
      colorScale: 'sequential',
    }
  })
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Calendar heatmap - a year of activity at a glance
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      Filter the Type column (commit / pr / review) and the heatmap re-aggregates. Hover any cell
      for the date and count. Off-weeks every 9 weeks render as outlined blanks so missing data
      reads as missing, not zero.
    </p>
  </div>

  <div class="flex flex-1 min-h-0 gap-3 flex-col">
    <div class="shrink-0 rounded-lg border p-3" style="border-color: var(--sg-border); background: var(--sg-bg);">
      <SvGridChart {spec} />
    </div>
    <div class="flex-1 min-h-0">
      <SvGrid responsive={true}
      columnResize
        data={rows}
        columns={columns}
        features={features}
        sortable
        filterable
        selectionMode="none"
        rowHeight={28}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => { api = a; sync() }}
        onFiltersChange={sync}
        onSortingChange={sync}
      />
    </div>
  </div>
</section>
