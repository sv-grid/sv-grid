<!-- Documented in: docs/help/charts/financial.md -->
<script lang="ts">
  /**
   * 437. Financial workbench
   * ------------------------
   * A year of daily prices as a trading-terminal layout, all of it free in
   * @svgrid/grid:
   *
   * - `rowsToOhlcSpec` turns the rows into candles (with volume), and
   *   `bucket: 'week'` rolls them up through `resampleOhlc`.
   * - Bollinger bands and an EMA 20 ride on the price as `overlay`s; volume,
   *   RSI and MACD are panes under it, stacked by `SvChartPanes` with one
   *   x axis, one gutter and one crosshair.
   * - `lastPriceLine` pins the last close on the axis; earnings and dividend
   *   flags are annotations with `shape: 'flag'` and a tooltip `text`.
   * - `drawable` puts the drawing tools in the toolbar: trend lines, rays,
   *   Fibonacci retracements, rectangles, arrows, notes, all stored as data
   *   points so they survive zoom and the daily / weekly toggle.
   * - Presets, Ctrl + wheel zoom, Shift + drag pan, PDF and print.
   *
   * The second half is the grid's own chart panel on the same rows, with
   * Candlestick picked, the indicator chips, the Build button's gallery and
   * Format tab, and the link toggle that freezes a chart while you filter.
   */
  import {
    SvChartPanes, SvGrid, rowsToOhlcSpec, tableFeatures, rowSortingFeature, columnFilteringFeature,
    type ChartAnnotation, type ChartDrawing, type ChartIndicatorSpec, type ChartSpec, type GridColumns, type SeriesOverlay,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Bar = { day: string; open: number; high: number; low: number; close: number; volume: number }
  const rows: Bar[] = (() => {
    let seed = 42
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
    const start = Date.UTC(2025, 8, 15)
    const out: Bar[] = []
    let price = 182
    for (let i = 0; i < 365; i += 1) {
      const d = new Date(start + i * 86_400_000)
      const dow = d.getUTCDay()
      if (dow === 0 || dow === 6) continue
      const open = price
      const drift = Math.sin(i / 40) * 0.6 + (rnd() - 0.47) * 3.2
      const close = Math.max(60, open + drift)
      const high = Math.max(open, close) + rnd() * 2.2
      const low = Math.min(open, close) - rnd() * 2.2
      out.push({ day: d.toISOString().slice(0, 10), open: round2(open), high: round2(high), low: round2(low), close: round2(close), volume: Math.round(1_800_000 + rnd() * 1_400_000 + Math.abs(close - open) * 500_000) })
      price = close
    }
    return out
  })()
  function round2(v: number) { return Math.round(v * 100) / 100 }

  let bucket = $state<'day' | 'week'>('day')
  let overlay = $state<SeriesOverlay | ''>('bb:20:2')
  let indicators = $state<ChartIndicatorSpec['kind'][]>(['volume', 'rsi', 'macd'])
  let drawings = $state<ChartDrawing[]>([
    { id: 'support', kind: 'hray', points: [{ x: rows[40]!.day, y: round2(rows[40]!.low) }], color: '#16a34a' },
  ])
  const flags: ChartAnnotation[] = [
    { at: { category: rows[62]!.day }, label: 'E', shape: 'flag', text: `Earnings ${rows[62]!.day}: EPS 1.42 vs 1.30 expected` },
    { at: { category: rows[126]!.day }, label: 'D', shape: 'flag', color: '#16a34a', text: `Dividend 0.24, ex-date ${rows[126]!.day}` },
    { at: { category: rows[188]!.day }, label: 'E', shape: 'flag', text: `Earnings ${rows[188]!.day}: EPS 1.51 vs 1.47 expected` },
  ]
  const ALL_INDICATORS: Array<{ kind: ChartIndicatorSpec['kind']; label: string }> = [
    { kind: 'volume', label: 'Volume' }, { kind: 'rsi', label: 'RSI' }, { kind: 'macd', label: 'MACD' },
    { kind: 'stochastic', label: 'Stochastic' }, { kind: 'atr', label: 'ATR' }, { kind: 'obv', label: 'OBV' },
  ]
  const toggle = (k: ChartIndicatorSpec['kind']) => (indicators = indicators.includes(k) ? indicators.filter((x) => x !== k) : [...indicators, k])

  const spec = $derived.by<ChartSpec>(() => {
    const base = rowsToOhlcSpec(rows, {
      date: 'day', open: 'open', high: 'high', low: 'low', close: 'close', volume: 'volume',
      ...(bucket === 'week' ? { bucket: 'week' } : {}),
      label: 'ACME', lastPriceLine: true,
    })
    return {
      ...base,
      title: `ACME ${bucket === 'week' ? 'weekly' : 'daily'}`,
      series: base.series.map((s) => ({ ...s, ...(overlay ? { overlay } : {}) })),
      annotations: bucket === 'day' ? flags : [],
      drawings,
      valueFormat: 'currency',
      currency: 'USD',
      height: 300,
    }
  })
  const paneSpecs = $derived<ChartIndicatorSpec[]>(indicators.map((kind) => ({ kind, height: kind === 'volume' ? 80 : 100 })))

  const columns: GridColumns<Bar> = [
    { field: 'day', header: 'Day', width: 110, cellDataType: 'date' },
    { field: 'open', header: 'Open', width: 90, align: 'right', cellDataType: 'number' },
    { field: 'high', header: 'High', width: 90, align: 'right', cellDataType: 'number' },
    { field: 'low', header: 'Low', width: 90, align: 'right', cellDataType: 'number' },
    { field: 'close', header: 'Close', width: 90, align: 'right', cellDataType: 'number' },
    { field: 'volume', header: 'Volume', width: 110, align: 'right', cellDataType: 'number' },
  ]
</script>

<section class="wrap">
  <header class="chrome">
    <label class="ctl">
      Bars
      <select bind:value={bucket}>
        <option value="day">Daily</option>
        <option value="week">Weekly</option>
      </select>
    </label>
    <label class="ctl">
      Overlay
      <select bind:value={overlay}>
        <option value="">none</option>
        <option value="bb:20:2">Bollinger 20 / 2</option>
        <option value="ema:20">EMA 20</option>
        <option value="sma:50">SMA 50</option>
        <option value="vwap">VWAP</option>
      </select>
    </label>
    <span class="chips" role="group" aria-label="Indicator panes">
      {#each ALL_INDICATORS as ind (ind.kind)}
        <button type="button" class="chip" class:is-on={indicators.includes(ind.kind)} aria-pressed={indicators.includes(ind.kind)} onclick={() => toggle(ind.kind)}>{ind.label}</button>
      {/each}
    </span>
    <span class="note">{drawings.length} drawing{drawings.length === 1 ? '' : 's'}. Ctrl + wheel zooms, Shift + drag pans, the presets jump.</span>
  </header>

  <div class="pane demo-workbench">
    <SvChartPanes
      spec={spec}
      indicators={paneSpecs}
      zoomable={{ wheel: 'modifier', pinch: true, pan: 'shift' }}
      rangePresets
      drawable
      onDrawingsChange={(d) => (drawings = d)}
      legend={false}
      animate={{ enter: 'wipe' }}
      contextMenu
    />
  </div>

  <div class="pane demo-panel">
    <div class="bar">
      <span class="note">The same rows in the grid's own chart panel: Candlestick picked, indicator chips, the Build button's gallery and Format tab, and the link toggle.</span>
    </div>
    <div class="grid-host">
      <SvGrid
        data={rows}
        {columns}
        {features}
        sortable
        filterable
        rowHeight={28}
        containerHeight="100%"
        fitColumns
        responsive
        charting={{
          defaultOpen: true, defaultType: 'candlestick', position: 'right', width: 520,
          zoom: { wheel: 'modifier', pan: 'shift' }, rangePresets: true, export: true, contextMenu: true,
        }}
      />
    </div>
  </div>
</section>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 10px;
    overflow: auto;
  }
  .chrome {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    flex: none;
  }
  .note {
    font-size: 12px;
    color: var(--sg-muted, #64748b);
  }
  .ctl {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
  }
  .ctl select {
    font: inherit;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 6px;
    background: var(--sg-bg, #fff);
    color: inherit;
    padding: 2px 6px;
  }
  .chips {
    display: inline-flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .chip {
    font: inherit;
    font-size: 11px;
    line-height: 1;
    padding: 4px 8px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 999px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    cursor: pointer;
  }
  .chip.is-on {
    background: var(--sg-accent, #2563eb);
    border-color: var(--sg-accent, #2563eb);
    color: #fff;
  }
  .pane {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #fff);
    padding: 8px 10px;
    min-width: 0;
    flex: none;
  }
  .bar {
    margin-bottom: 6px;
  }
  .grid-host {
    height: 460px;
    min-width: 0;
  }
</style>
