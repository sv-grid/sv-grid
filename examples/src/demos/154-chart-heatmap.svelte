<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 154. Heatmap chart
   * ------------------
   * `type: 'heatmap'` renders a coloured grid - one cell per (row, column).
   * Reuse the existing `categories` (column headers) + `series` (one series
   * per row, `values` is the row's cells) shape. The `colorScale` option
   * picks a sequential ramp (default) or a diverging red->blue ramp for
   * data that straddles 0. A custom hex-array works too. Cell text colour
   * is auto-chosen for WCAG contrast against the cell.
   *
   * This demo: a "hour x weekday" traffic heatmap built from the grid's
   * displayed rows. Filter the channel column and the heatmap re-renders.
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

  type Row = { id: number; day: string; hour: number; channel: string; visits: number }
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const CHANNELS = ['Organic', 'Paid', 'Social']
  let seed = 0xc0ffee
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  // Synthesize a realistic shape: workday peaks 9-11 + 14-17; weekends shifted later.
  function shape(d: string, h: number, ch: string): number {
    const weekend = d === 'Sat' || d === 'Sun'
    const peak = weekend ? Math.max(0, 1 - Math.abs(h - 14) / 6) : Math.max(0, 1 - Math.abs(h - 13) / 5)
    const base = ch === 'Paid' ? 80 : ch === 'Social' ? 60 : 120
    return Math.round(base * (0.2 + peak * 1.6) * (0.7 + rnd() * 0.6))
  }
  let nid = 0
  const rows: Row[] = DAYS.flatMap((day) =>
    Array.from({ length: 24 }, (_, hour) =>
      CHANNELS.map((channel) => ({
        id: nid++,
        day,
        hour,
        channel,
        visits: shape(day, hour, channel),
      })),
    ).flat(),
  )

  const columns: GridColumns<Row> = [
    { field: 'day', header: 'Day', width: 90 },
    { field: 'hour', header: 'Hour', width: 80, align: 'right' },
    { field: 'channel', header: 'Channel', width: 110 },
    { field: 'visits', header: 'Visits', width: 90, align: 'right' },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let displayed = $state<Row[]>(rows)
  let scale = $state<'sequential' | 'diverging'>('sequential')
  let showLabels = $state(false)
  function sync() { displayed = (api?.getDisplayedRows() as Row[]) ?? rows }

  // Aggregate filtered rows into a (day x hour) matrix.
  const spec = $derived.by<ChartSpec>(() => {
    const buckets = new Map<string, Map<number, number>>()
    for (const r of displayed) {
      let row = buckets.get(r.day)
      if (!row) { row = new Map(); buckets.set(r.day, row) }
      row.set(r.hour, (row.get(r.hour) ?? 0) + r.visits)
    }
    const series = DAYS.map((d) => {
      const m = buckets.get(d)
      return {
        label: d,
        values: Array.from({ length: 24 }, (_, h) => m?.get(h) ?? 0),
      }
    })
    return {
      type: 'heatmap',
      categories: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')),
      series,
      colorScale: scale,
      width: 760,
      height: 320,
    }
  })
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Heatmap built from the grid's filtered rows
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      Filter the Channel column to isolate one source; the heatmap re-renders. Hover any cell for
      the day/hour breakdown.
    </p>
    <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <select bind:value={scale} class="ic-sel">
        <option value="sequential">Sequential ramp</option>
        <option value="diverging">Diverging ramp</option>
      </select>
      <label class="ic-chk"><input type="checkbox" bind:checked={showLabels} /> Cell values</label>
    </div>
  </div>

  <div class="flex flex-1 min-h-0 gap-3">
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
    <div class="shrink-0 rounded-lg border p-3" style="width: 800px; border-color: var(--sg-border); background: var(--sg-bg);">
      <SvGridChart {spec} dataLabels={showLabels} />
    </div>
  </div>
</section>

<style>
  .ic-sel {
    border: 1px solid var(--sg-input-border, var(--sg-border));
    background: var(--sg-input-bg, var(--sg-bg));
    color: var(--sg-fg);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 12px;
  }
  .ic-chk { display: inline-flex; align-items: center; gap: 4px; color: var(--sg-fg); }
  .ic-chk input[type='checkbox'] { accent-color: var(--sg-accent); }
</style>
