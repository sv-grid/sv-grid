# Financial charts

Candlesticks and OHLC bars, the eight technical indicators as overlays and stacked panes, resampling daily bars into weeks and months, the last-price line and event flags, and the same tools from the grid panel.

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, SvGridChart } from '@svgrid/grid'
</script>
```

## Candlestick and OHLC

Set `ohlc` on the series alongside `values`:

```ts
const spec: ChartSpec = {
  type: 'candlestick',            // or 'ohlc' for tick bars
  xType: 'ordinal-time',          // skip the days the market was shut
  categories: rows.map((r) => r.date),
  series: [{
    label: 'ACME',
    values: rows.map((r) => r.c), // the CLOSES - see below
    ohlc: rows.map((r) => ({ o: r.o, h: r.h, l: r.l, c: r.c })),
    overlay: 'sma:10',            // a moving average, for free
  }],
}
```

A rising bar draws hollow and a falling one filled, so direction reads from the
shape as well as the colour. `candleColors` overrides the pair. A `null` entry
in `ohlc` is a day with no session and draws nothing.

**Put the closing prices in `values` too.** Everything that reads a series
generically reads `values`: the tooltip, the CSV export, the screen-reader
table, and `overlay`. Filling it in is what lets a price series carry a moving
average or export to CSV without a line of candle-specific code.

Give volume its own pane rather than the price chart's right axis. Both axes
share the full plot height, so a right-axis volume series climbs up through the
candles: technically correct, and unreadable. A second short chart over the
same `categories` and the same `xType` is what a trading screen actually does,
and the two stay in register because they share the axis mode.

Candlesticks are cartesian, so zoom, the brush mini-map, the crosshair tooltip
and keyboard navigation all work. The price axis is **not** pinned to zero the
way a bar chart's is, so a series trading between 180 and 195 uses the whole
plot instead of a fifth of it.

<div data-docs-demo="432-chart-candlestick" data-height="620"></div>

## Indicators, panes and price tools

Candlesticks and OHLC bars have been here since the first wave; this section
is the rest of a price chart: the indicators, the panes under the price, the
resampling, the last-price line and the event flags. Everything is free and in
the same engine.

### Indicators

Eight indicators are exported as pure functions over plain arrays, NaN-padded
while their window fills so the result lines up with `categories`:

| Function | Reads | Returns |
| --- | --- | --- |
| `bollingerBands(values, period = 20, k = 2)` | closes | `{ middle, upper, lower }` |
| `rsi(values, period = 14)` | closes | 0..100, Wilder smoothing |
| `macd(values, fast = 12, slow = 26, signal = 9)` | closes | `{ macd, signal, histogram }` |
| `vwap(ohlc, volumes)` | bars + volumes | cumulative volume-weighted average price |
| `atr(ohlc, period = 14)` | bars | average true range, Wilder smoothing |
| `stochastic(ohlc, period = 14, smooth = 3)` | bars | `{ k, d }`, both 0..100 |
| `wma(values, period)` | closes | weighted moving average |
| `obv(closes, volumes)` | closes + volumes | on-balance volume |

The overlays that sit on the price are series `overlay` values, next to the
`sma:N` / `ema:N` / `linear` ones: `'wma:N'`, `'vwap'` (needs `ohlc` and
`volumes` on the series) and `'bb:N:K'`, which draws the middle line dashed
and shades the band between the envelopes:

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const days = Array.from({ length: 60 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10))
  let p = 100
  const closes = days.map((_, i) => (p += Math.sin(i / 6) * 2 + (i % 5 === 0 ? -1.5 : 1)))
  const ohlc = closes.map((c, i) => ({ o: i ? closes[i - 1]! : c, h: c + 1.5, l: c - 1.5, c }))
  const spec: ChartSpec = {
    type: 'candlestick',
    categories: days,
    series: [{ label: 'ACME', values: closes, ohlc, volumes: days.map((_, i) => 800 + (i * 37) % 400), overlay: 'bb:20:2' }],
    xType: 'ordinal-time',
    lastPriceLine: true,
    height: 280,
  }
</script>

<SvChart {spec} legend={false} />
```

### Indicator panes

The oscillators belong under the price, not on it. `indicatorPane(spec, ind)`
builds a complete spec for one: the same categories and x axis, the
indicator's lines or bars, and the lines it is read against (30 / 70 for RSI,
20 / 80 for the stochastic, a zero line for MACD). `SvChartPanes` stacks them
under the price chart with one shared x axis, one value-axis gutter width so
the plots line up, and one crosshair and zoom window across all of them:

```svelte {runnable}
<script lang="ts">
  import { SvChartPanes, type ChartSpec } from '@svgrid/grid'

  const days = Array.from({ length: 90 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10))
  let p = 100
  const closes = days.map((_, i) => (p += Math.sin(i / 7) * 2 + (i % 4 === 0 ? -1.2 : 0.9)))
  const spec: ChartSpec = {
    type: 'candlestick',
    categories: days,
    series: [{
      label: 'ACME',
      values: closes,
      ohlc: closes.map((c, i) => ({ o: i ? closes[i - 1]! : c, h: c + 1.5, l: c - 1.5, c })),
      volumes: days.map((_, i) => 800 + (i * 37) % 400),
      overlay: 'ema:20',
    }],
    xType: 'ordinal-time',
    lastPriceLine: true,
    height: 260,
  }
</script>

<SvChartPanes
  {spec}
  indicators={[{ kind: 'volume', height: 90 }, { kind: 'rsi' }, { kind: 'macd', params: { fast: 8, slow: 21, signal: 5 } }]}
  zoomable={{ wheel: 'modifier', pan: 'shift' }}
  rangePresets
  legend={false}
/>
```

Each pane is a full `SvChart`, so the tooltip, keyboard navigation, the
screen-reader table, export and the context menu come along; the main chart
takes every `SvChart` prop. `axisWidth` sets the shared gutter (default 56)
and `syncGroup` joins the stack to charts outside it. A `ChartIndicatorSpec`
is `{ kind, source?, params?, height? }`: `kind` is `'volume'`, `'rsi'`,
`'macd'`, `'stochastic'`, `'atr'` or `'obv'`; `source` names the series to
read (default: the first with `ohlc`); `params` carries `period`, `fast`,
`slow`, `signal` and `smooth`; `height` is the pane's pixel height (default
a third of the price chart).

### Rows to candles, and resampling

`rowsToOhlcSpec(rows, { date, open, high, low, close, volume?, bucket? })`
builds the candlestick spec straight from rows: sorted by date, on an
ordinal-time axis so weekends leave no gaps, with the volume on the series
when a column is named. `bucket: 'week'` (or `'month'`, `'quarter'`,
`'year'`) rolls daily bars up first through `resampleOhlc`: the first open,
the highest high, the lowest low, the last close, the summed volume.

```ts
const daily = rowsToOhlcSpec(rows, { date: 'day', open: 'o', high: 'h', low: 'l', close: 'c', volume: 'v', lastPriceLine: true })
const weekly = rowsToOhlcSpec(rows, { date: 'day', open: 'o', high: 'h', low: 'l', close: 'c', volume: 'v', bucket: 'week' })
const { categories, ohlc, volumes } = resampleOhlc(daily.categories, daily.series[0].ohlc, { bucket: 'month', volumes: daily.series[0].volumes })
```

### Last price and event flags

`lastPriceLine: true` draws a dashed line at the last close (the last value
of the first series on a line chart) with the value in a filled pill on the
right end, green when the last bar closed up and red when it closed down.
Pass `{ label, color }` to override either.

Annotations gained shapes for the marks a price chart carries: `shape:
'flag'` puts the label inside a flag on a pole (earnings, dividends), `'pin'`
a map pin, `'square'` a square. A `text` on the annotation is read out in a
tooltip on hover and on focus, so a flag can say "E" and explain itself:

```ts
annotations: [
  { at: { category: '2026-02-12' }, label: 'E', shape: 'flag', text: 'Q4 earnings: EPS 1.42 vs 1.30 expected' },
  { at: { category: '2026-03-03' }, label: 'D', shape: 'flag', color: '#16a34a', text: 'Dividend 0.24 ex-date' },
]
```

### From the grid

The chart panel builds a candlestick from a grid of prices: pick
**Candlestick** or **OHLC bars**, and the panel finds the Date, Open, High,
Low, Close and Volume columns by name (change any of them in the pickers).
The **Bucket** picker rolls the bars up to weeks or months, **Candles** picks
classic, hollow or Heikin-Ashi, and the **Indicators** chips add volume, RSI,
MACD, stochastic, ATR and OBV panes under the price, or an SMA, EMA,
Bollinger or VWAP overlay on it. All of it round-trips through
`configureChart({ ohlc, indicators })` and the saved view.

The whole toolkit on one page, standalone and then inside the grid panel:

<div data-docs-demo="437-chart-financial-workbench" data-height="760"></div>

<!-- tutorial:financial-workbench -->
<figure class="docs-tutorial" id="tutorial-financial-workbench" data-docs-tutorial="financial-workbench">
<video class="docs-tutorial-video" src="/tutorials/financial-workbench.mp4" poster="/tutorials/financial-workbench.poster.webp" width="960" height="540" muted loop playsinline preload="none" aria-label="A financial chart workbench in Svelte, 33 second tutorial"><track kind="captions" srclang="en" label="English" src="/tutorials/financial-workbench.vtt" default>Your browser does not play embedded video. <a href="/tutorials/financial-workbench.mp4">Download the MP4</a>.</video>
<figcaption><strong>A financial chart workbench in Svelte</strong> (33 s, silent).</figcaption>
<details class="docs-tutorial-transcript"><summary>Transcript</summary>
<p>A year of sessions as candles, with volume, RSI and MACD panes under the price and Bollinger bands on it.</p>
<p>Toggle an indicator chip and its pane comes and goes.</p>
<p>Ctrl plus wheel zooms the price, and every pane follows.</p>
<p>A range preset jumps to the last month.</p>
<p>The grid's own panel draws the same rows: Candlestick picked, indicator chips, the builder, and the link toggle.</p>
</details>
</figure>
<!-- /tutorial:financial-workbench -->

## More examples

### Synchronized charts with zoom, pan and presets

Two years of daily prices and volumes as two charts that move as one: hover either for a shared crosshair, Ctrl + wheel or pinch to zoom around the pointer, Shift + drag or the hand button to pan, 1W / 1M / 3M / 6M / YTD / 1Y / All presets, and a grid that shows exactly the rows in the window. Right-click for a context menu with export, zoom and series items plus your own. Below: bars that grow in and slide on every data change with multi-selection, and a sunburst that drills down on click with a breadcrumb back up.

<div data-docs-demo="436-chart-sync-zoom" data-height="560"></div>

## See also

- [SvChartPanes](../ui-components/sv-chart-panes.md)
- [Drawing tools](./interaction.md#drawing-tools)
- [Chart types](./types.md)
