# `@svgrid/grid` · `chart-indicators.ts`

Auto-generated. Source: `packages\grid\src\chart-indicators.ts`.

### `type ChartIndicatorSpec`

Which indicator a pane shows, and with what parameters.

```ts
export type ChartIndicatorSpec = {
  kind: 'rsi' | 'macd' | 'stochastic' | 'atr' | 'obv' | 'volume'
  /** The series (by label) the indicator reads. Defaults to the first
   *  series with `ohlc`, else the first series. */
  source?: string
  /** Periods: `period` (RSI / ATR / stochastic %K), `fast` / `slow` /
   *  `signal` (MACD), `smooth` (stochastic %D). Each has the usual default. */
  params?: { period?: number; fast?: number; slow?: number; signal?: number; smooth?: number }
  /** Pane height in px; the default is a third of the main chart. */
  height?: number
}
```

### `function wma`

Weighted moving average: the latest value weighs `period`, the oldest 1.

```ts
export function wma(values: ReadonlyArray<number>, period: number): number[]
```

### `function bollingerBands`

Bollinger bands: a simple moving average with a band `k` standard
deviations either side (population deviation, as the terminals compute it).

```ts
export function bollingerBands(values: ReadonlyArray<number>, period = 20, k = 2): { middle: number[]; upper: number[]; lower: number[] }
```

### `function rsi`

Relative strength index over `period` bars, 0 to 100. The first value lands
at index `period`; before it there is nothing to average.

```ts
export function rsi(values: ReadonlyArray<number>, period = 14): number[]
```

### `function macd`

Moving average convergence / divergence: the fast EMA minus the slow one,
its signal EMA, and the histogram between them.

```ts
export function macd(values: ReadonlyArray<number>, fast = 12, slow = 26, signal = 9): { macd: number[]; signal: number[]; histogram: number[] }
```

### `function vwap`

Volume-weighted average price, cumulative from the first bar. Reset it per
session by resampling or slicing before calling.

```ts
export function vwap(ohlc: ReadonlyArray<OhlcBar | null | undefined>, volumes: ReadonlyArray<number>): number[]
```

### `function atr`

Average true range with Wilder's smoothing.

```ts
export function atr(ohlc: ReadonlyArray<OhlcBar | null | undefined>, period = 14): number[]
```

### `function stochastic`

Stochastic oscillator: %K is where the close sits in the last `period`
bars' range (0 to 100), %D its `smooth`-bar simple average.

```ts
export function stochastic(ohlc: ReadonlyArray<OhlcBar | null | undefined>, period = 14, smooth = 3): { k: number[]; d: number[] }
```

### `function obv`

On-balance volume: a running total that adds volume on up closes and
 subtracts it on down closes.

```ts
export function obv(closes: ReadonlyArray<number>, volumes: ReadonlyArray<number>): number[]
```

### `function computeOverlay`

Compute overlay values for a series spec like 'sma:7' / 'ema:14' / 'wma:9' /
'linear'. `'bb:N:K'` returns the band's middle line (the engine draws the
band from `bollingerBands` itself) and `'vwap'` needs bars and volumes, so
it comes back as gaps here; pass `extra` for those two.

```ts
export function computeOverlay(values: number[], spec: SeriesOverlay, extra?: { ohlc?: ReadonlyArray<OhlcBar | null>; volumes?: ReadonlyArray<number> }): number[]
```

### `function computeOverlayFit`

{@link computeOverlay} plus what a regression knows about itself: its
R-squared and equation. The moving averages, the bands and VWAP carry
neither.

```ts
export function computeOverlayFit(values: number[], spec: SeriesOverlay, extra?: { ohlc?: ReadonlyArray<OhlcBar | null>; volumes?: ReadonlyArray<number> }): { values: number[]; r2?: number; equation?: string }
```

### `function regressionFit`

The regression an overlay string names (`linear`, `poly:N`, `exp`, `log`,
`power`), fitted to `values` on their index or on `xs`; `null` for the
moving averages and bands, which are not regressions. A scatter passes its
points' x and y so the curve is y on x, and reads `predict` to draw it.

```ts
export function regressionFit(values: ReadonlyArray<number>, spec: SeriesOverlay, xs?: ReadonlyArray<number>): RegressionFit | null
```

### `function overlayName`

The name a tooltip or legend gives an overlay: `sma:20` reads "SMA 20",
 `poly:3` "poly 3", `bb:20:2` "BB 20", the rest as written.

```ts
export function overlayName(spec: SeriesOverlay): string
```

### `function indicatorPane`

Build the spec of an indicator pane from a price spec: the same categories
and x axis, the indicator's lines or bars, and the reference lines the
indicator is read against (30 / 70 for RSI, 20 / 80 for the stochastic, a
zero line for MACD). `SvChartPanes` stacks these under the price chart and
syncs them; a pane is also a complete spec for a standalone `SvChart`.

```ts
export function indicatorPane(spec: ChartSpec, ind: ChartIndicatorSpec): ChartSpec
```
