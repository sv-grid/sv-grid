<!-- Documented in: docs/help/charts.md -->
<script lang="ts">
  /**
   * 159. Streaming chart with a rolling window
   * -------------------------------------------
   * Live data doesn't need any special chart API - because `spec` is a
   * Svelte derived, anything that mutates the underlying rows re-runs
   * the spec and re-renders the chart. The trick is to:
   *
   *  1. Append the new tick to the dataset.
   *  2. Cap the array at a fixed window size so the chart shows the most
   *     recent N points instead of growing forever.
   *  3. Re-aggregate via `rowsToChartSpec` so the chart inherits zoom /
   *     drill / brush / format helpers for free.
   *
   * Hit Start - prices stream in at 4 Hz. The window holds the last 60
   * ticks; older points drop off the left as new ones appear on the right.
   */
  import { onDestroy } from 'svelte'
  import {
    SvGrid,
    SvGridChart,
    rowsToChartSpec,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type GridColumns,
    type SvGridApi,
    type ChartSpec,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Row = { id: number; t: string; price: number }
  const WINDOW = 60
  // Seed with a stable starting walk so the chart isn't empty on mount.
  let seed = 0x42
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  let nextId = 0
  let price = 100
  function tick(): Row {
    price = Math.max(50, price + (rnd() - 0.5) * 1.8)
    const t = new Date().toISOString().slice(11, 19)   // HH:MM:SS
    return { id: nextId++, t, price: Math.round(price * 100) / 100 }
  }
  let rows = $state<Row[]>(Array.from({ length: 20 }, () => tick()))

  const columns: GridColumns<Row> = [
    { field: 't',     header: 'Tick',  width: 110 },
    { field: 'price', header: 'Price', width: 110, align: 'right',
      format: { type: 'number', options: { minimumFractionDigits: 2, maximumFractionDigits: 2 } } },
  ]

  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let running = $state(false)
  let intervalId: ReturnType<typeof setInterval> | null = null
  function start() {
    if (intervalId) return
    running = true
    intervalId = setInterval(() => {
      const next = [...rows, tick()]
      // Roll: drop the oldest when above WINDOW so the chart slides.
      rows = next.length > WINDOW ? next.slice(next.length - WINDOW) : next
    }, 250)
  }
  function stop() {
    running = false
    if (intervalId) { clearInterval(intervalId); intervalId = null }
  }
  onDestroy(stop)

  const spec = $derived.by<ChartSpec>(() => {
    const s = rowsToChartSpec(rows, {
      type: 'line',
      category: 't',
      value: 'price',
      reduce: 'sum',
      width: 720,
      height: 320,
    })
    s.xAxisTitle = 'Tick'
    s.yAxisTitle = 'Price'
    s.series[0]!.smooth = true
    return s
  })
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      Streaming chart with a {WINDOW}-tick rolling window
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      Hit Start. Prices stream in at 4 Hz; the line slides left as new ticks arrive. Smoothing is
      on so the curve flows between samples. The grid mirrors the same rolling buffer.
    </p>
    <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
      {#if !running}
        <button type="button" class="ic-btn" onclick={start}>▶ Start streaming</button>
      {:else}
        <button type="button" class="ic-btn" onclick={stop}>■ Stop</button>
      {/if}
      <span style="color: var(--sg-muted);">Buffered: {rows.length} / {WINDOW} ticks</span>
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
        rowHeight={26}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={(a) => { api = a }}
      />
    </div>
    <div class="shrink-0 rounded-lg border p-3" style="width: 760px; border-color: var(--sg-border); background: var(--sg-bg);">
      <SvGridChart {spec} />
    </div>
  </div>
</section>

<style>
  .ic-btn {
    border: 1px solid var(--sg-border);
    background: var(--sg-bg);
    color: var(--sg-fg);
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .ic-btn:hover { background: var(--sg-row-hover-bg); }
</style>
