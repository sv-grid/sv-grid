# `@svgrid/grid` · `chart-financial.ts`

Auto-generated. Source: `packages\grid\src\chart-financial.ts`.

### `function heikinAshi`

Heikin-Ashi ("average bar") candles from ordinary OHLC bars. Each close is
the mean of the four prices, each open the midpoint of the previous
Heikin-Ashi body, and the high / low stretch to include both. Runs of one
colour then read as trends, at the cost of the true open and close.
`null` bars (gaps) stay null and reset the chain.

```ts
export function heikinAshi(bars: ReadonlyArray<OhlcBar | null>): Array<OhlcBar | null>
```

### `function resampleOhlc`

Roll daily (or finer) bars up to a coarser calendar bucket: the first
open, the highest high, the lowest low, the last close, the summed volume.
Categories are ISO dates and come back as the bucket starts (`bucketStart`),
sorted; bars whose date does not parse are dropped. Pass `volumes` to get
them summed alongside.

```ts
export function resampleOhlc(
  categories: ReadonlyArray<string>,
  ohlc: ReadonlyArray<OhlcBar | null>,
  opts: { bucket: ChartTimeBucket; volumes?: ReadonlyArray<number> },
): { categories: string[]; ohlc: Array<OhlcBar | null>; volumes?: number[] }
```

### `type OhlcColumns`

What the grid's chart panel stores for a price chart: the column ids.

```ts
export type OhlcColumns = { open: string | null; high: string | null; low: string | null; close: string | null; volume: string | null }
```

### `function guessOhlcColumns`

Guess the price columns from their names: the first numeric column called
open / high / low / close (or last, price) / volume. What the chart panel
shows before the reader picks anything; a picked column always wins.

```ts
export function guessOhlcColumns(
  measures: ReadonlyArray<{ id: string; field: string; label: string }>,
  picked?: Partial<OhlcColumns> | null,
): OhlcColumns
```

### `function ohlcDirectOptions`

The `rowsToDirectSpec` options for the grid panel's price chart, or null
while a price column is still unpicked. `fieldOf` maps a column id to its
field name; the date column is the category.

```ts
export function ohlcDirectOptions(
  fieldOf: (id: string | null) => string | null | undefined,
  dateId: string | null,
  cols: OhlcColumns,
  extra: { bucket?: ChartTimeBucket | null; candleStyle?: ChartSpec['candleStyle'] | null },
): { category: string; ohlc: NonNullable<Parameters<typeof import('./chart').rowsToDirectSpec>[2]['ohlc']> } | null
```

### `type ChartPanelIndicator`

The indicator names the grid's chart panel offers.

```ts
export type ChartPanelIndicator = 'volume' | 'rsi' | 'macd' | 'stochastic' | 'atr' | 'obv' | 'sma' | 'ema' | 'bb' | 'vwap'
```

### `function splitPanelIndicators`

Split the panel's indicator list into the panes that go under the price
(in order) and the one overlay that rides on it (a series carries a single
`overlay`, so the first overlay kind wins).

```ts
export function splitPanelIndicators(kinds: ReadonlyArray<ChartPanelIndicator>): { panes: ChartIndicatorSpec[]; overlay: SeriesOverlay | null }
```

### `function rowsToOhlcSpec`

A candlestick spec straight from rows: one bar per date (sorted), with the
volume alongside when a field is named, optionally rolled up to a calendar
bucket first. The x axis is ordinal-time, so weekends and holidays leave no
gaps.

```ts
export function rowsToOhlcSpec<T extends Record<string, unknown>>(
  rows: ReadonlyArray<T>,
  opts: {
    date: keyof T & string
    open: keyof T & string
    high: keyof T & string
    low: keyof T & string
    close: keyof T & string
    volume?: keyof T & string
    bucket?: ChartTimeBucket
    /** The series label. Default "Price". */
    label?: string
    type?: 'candlestick' | 'ohlc'
    candleStyle?: ChartSpec['candleStyle']
    lastPriceLine?: boolean
  },
): ChartSpec
```
