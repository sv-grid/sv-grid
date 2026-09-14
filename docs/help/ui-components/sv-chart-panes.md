# SvChartPanes

A price chart with indicator panes stacked under it, the way a trading
terminal lays them out: one shared x axis labelled on the last pane only,
one value-axis gutter width so the plots line up, and one crosshair and zoom
window across all of them.

```svelte {runnable}
<script lang="ts">
  import { SvChartPanes, rowsToOhlcSpec } from '@svgrid/grid'

  // Sixty sessions of prices as rows, the shape a grid or an API hands over.
  let price = 120
  const rows = Array.from({ length: 60 }, (_, i) => {
    const o = price
    const c = Math.max(50, o + Math.sin(i / 6) * 2 + (i % 5 === 0 ? -2 : 1.2))
    price = c
    return { day: new Date(Date.UTC(2026, 0, 5 + i)).toISOString().slice(0, 10), o, h: Math.max(o, c) + 1.5, l: Math.min(o, c) - 1.5, c, v: 900 + (i * 37) % 500 }
  })
  const spec = rowsToOhlcSpec(rows, { date: 'day', open: 'o', high: 'h', low: 'l', close: 'c', volume: 'v', lastPriceLine: true, label: 'ACME' })
</script>

<SvChartPanes {spec} indicators={[{ kind: 'volume', height: 80 }, { kind: 'rsi' }, { kind: 'macd' }]} zoomable={{ wheel: 'modifier', pan: 'shift' }} rangePresets legend={false} />
```

Composition, not a new layout: every pane is a full [`SvChart`](sv-grid-chart.md)
in a private sync group, so tooltips, keyboard navigation, the screen-reader
table, export and the context menu all come for free. The main chart takes
every `SvChart` prop.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `spec` | `ChartSpec` | required | The price chart: a candlestick / OHLC / line spec whose first series (or the one named by `source`) carries `ohlc` and `volumes` for the volume-based indicators. |
| `indicators` | `ChartIndicatorSpec[]` | `[]` | The panes under the price, top to bottom. |
| `axisWidth` | `number` | `56` | Width of the value-axis gutter every pane uses, so the plots line up. |
| `syncGroup` | `string` | private | Share the crosshair and zoom with charts outside the stack. |
| `zoom` | `ChartZoomWindow \| null` | `null` | The shared zoom window, bindable. |
| everything else | `SvChartProps` | | Forwarded to the main chart: `zoomable`, `rangePresets`, `legend`, `toolbar`, `animate`, `contextMenu`, `drawable`, `onSelect`, `tooltipFormat`, ... |

### ChartIndicatorSpec

| Field | Type | Description |
| --- | --- | --- |
| `kind` | `'volume' \| 'rsi' \| 'macd' \| 'stochastic' \| 'atr' \| 'obv'` | Which indicator the pane shows. |
| `source` | `string` | The series (by label) it reads. Default: the first with `ohlc`, else the first. |
| `params` | `{ period?, fast?, slow?, signal?, smooth? }` | Periods; each has the usual default (14 for RSI / ATR / stochastic %K, 12 / 26 / 9 for MACD, 3 for %D). |
| `height` | `number` | Pane height in px. Default: a third of the price chart. |

`indicatorPane(spec, ind)` is the function behind each pane, exported for a
standalone `SvChart`: it returns a complete spec with the indicator's lines or
bars and the reference lines it is read against (30 / 70 for RSI, 20 / 80 for
the stochastic, zero for MACD). An RSI on its own, at whatever size the page
gives it:

```svelte {runnable}
<script lang="ts">
  import { SvChart, indicatorPane, type ChartSpec } from '@svgrid/grid'

  const days = Array.from({ length: 80 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10))
  let p = 40
  const closes = days.map((_, i) => (p += Math.sin(i / 5) * 1.4 + (i % 7 === 0 ? -1 : 0.5)))
  const price: ChartSpec = { type: 'line', categories: days, series: [{ label: 'Close', values: closes }], xType: 'ordinal-time' }
  const rsi = { ...indicatorPane(price, { kind: 'rsi', params: { period: 10 } }), height: 180 }
</script>

<SvChart spec={rsi} legend={false} />
```

The financial workbench demo stacks volume, RSI and MACD under a year of
candles, with the drawing tools and the presets:

<div data-docs-demo="437-chart-financial-workbench" data-height="760"></div>

The [financial charts page](../charts/financial.md) covers the indicators, the
overlays that sit on the price, resampling, the last-price line and flags.

## See also

- [SvGridChart](sv-grid-chart.md) - the chart each pane is made of, and every prop the main chart takes.
- [Charts guide: financial charts](../charts/financial.md) - the indicators, overlays, resampling, last-price line and flags.
- [SvCard](sv-card.md) - a surface to frame a workbench on a dashboard.
