/**
 * Technical indicators for financial charts: the overlays that sit on the
 * price (Bollinger bands, VWAP, weighted moving average) and the oscillators
 * that get a pane of their own (RSI, MACD, stochastic, ATR, OBV, volume).
 *
 * Every function is pure, takes plain arrays and returns arrays of the same
 * length, NaN-padded where the window is not full yet, so the result lines up
 * with `categories` and draws as a gap rather than as a fake zero. Wilder's
 * smoothing (RSI, ATR) seeds with a simple average over the first period and
 * then smooths recursively, which is what every charting terminal shows.
 */
import type { ChartReferenceLine, ChartSeries, ChartSpec, OhlcBar, SeriesOverlay } from './chart-types'
import { exponentialFit, exponentialMovingAverage, linearFit, logarithmicFit, polynomialFit, powerFit, simpleMovingAverage, type RegressionFit } from './chart-stats'

/** Which indicator a pane shows, and with what parameters. */
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

const nanArray = (n: number): number[] => new Array(n).fill(Number.NaN)

/** Weighted moving average: the latest value weighs `period`, the oldest 1. */
export function wma(values: ReadonlyArray<number>, period: number): number[] {
  const n = values.length
  const p = Math.max(1, Math.floor(period))
  const out = nanArray(n)
  const denom = (p * (p + 1)) / 2
  for (let i = p - 1; i < n; i += 1) {
    let sum = 0
    let ok = true
    for (let k = 0; k < p; k += 1) {
      const v = values[i - k]!
      if (!Number.isFinite(v)) { ok = false; break }
      sum += v * (p - k)
    }
    if (ok) out[i] = sum / denom
  }
  return out
}

/**
 * Bollinger bands: a simple moving average with a band `k` standard
 * deviations either side (population deviation, as the terminals compute it).
 */
export function bollingerBands(values: ReadonlyArray<number>, period = 20, k = 2): { middle: number[]; upper: number[]; lower: number[] } {
  const n = values.length
  const p = Math.max(1, Math.floor(period))
  const middle = simpleMovingAverage(values as number[], p)
  const upper = nanArray(n)
  const lower = nanArray(n)
  for (let i = p - 1; i < n; i += 1) {
    const m = middle[i]!
    if (!Number.isFinite(m)) continue
    let ss = 0
    let count = 0
    for (let j = i - p + 1; j <= i; j += 1) {
      const v = values[j]!
      if (!Number.isFinite(v)) continue
      ss += (v - m) * (v - m)
      count += 1
    }
    const sd = count ? Math.sqrt(ss / count) : 0
    upper[i] = m + k * sd
    lower[i] = m - k * sd
  }
  return { middle, upper, lower }
}

/**
 * Relative strength index over `period` bars, 0 to 100. The first value lands
 * at index `period`; before it there is nothing to average.
 */
export function rsi(values: ReadonlyArray<number>, period = 14): number[] {
  const n = values.length
  const p = Math.max(1, Math.floor(period))
  const out = nanArray(n)
  if (n <= p) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= p; i += 1) {
    const d = values[i]! - values[i - 1]!
    if (d > 0) gain += d
    else loss -= d
  }
  let avgGain = gain / p
  let avgLoss = loss / p
  const rs = (g: number, l: number) => (l === 0 ? 100 : 100 - 100 / (1 + g / l))
  out[p] = rs(avgGain, avgLoss)
  for (let i = p + 1; i < n; i += 1) {
    const d = values[i]! - values[i - 1]!
    avgGain = (avgGain * (p - 1) + (d > 0 ? d : 0)) / p
    avgLoss = (avgLoss * (p - 1) + (d < 0 ? -d : 0)) / p
    out[i] = rs(avgGain, avgLoss)
  }
  return out
}

/**
 * Moving average convergence / divergence: the fast EMA minus the slow one,
 * its signal EMA, and the histogram between them.
 */
export function macd(values: ReadonlyArray<number>, fast = 12, slow = 26, signal = 9): { macd: number[]; signal: number[]; histogram: number[] } {
  const n = values.length
  const f = exponentialMovingAverage(values as number[], fast)
  const s = exponentialMovingAverage(values as number[], slow)
  const line = nanArray(n)
  // The slow EMA is only meaningful once it has seen `slow` values; before
  // that both averages are still warming up and the difference is noise.
  for (let i = slow - 1; i < n; i += 1) line[i] = f[i]! - s[i]!
  const sig = nanArray(n)
  const hist = nanArray(n)
  const alpha = 2 / (Math.max(1, signal) + 1)
  let prev: number | null = null
  let seen = 0
  for (let i = 0; i < n; i += 1) {
    const v = line[i]!
    if (!Number.isFinite(v)) continue
    seen += 1
    prev = prev == null ? v : alpha * v + (1 - alpha) * prev
    if (seen >= signal) {
      sig[i] = prev
      hist[i] = v - prev
    }
  }
  return { macd: line, signal: sig, histogram: hist }
}

/** Typical price of a bar: the mean of its high, low and close. */
const typical = (b: OhlcBar) => (b.h + b.l + b.c) / 3

/**
 * Volume-weighted average price, cumulative from the first bar. Reset it per
 * session by resampling or slicing before calling.
 */
export function vwap(ohlc: ReadonlyArray<OhlcBar | null | undefined>, volumes: ReadonlyArray<number>): number[] {
  const n = ohlc.length
  const out = nanArray(n)
  let pv = 0
  let vol = 0
  for (let i = 0; i < n; i += 1) {
    const b = ohlc[i]
    const v = volumes[i]
    if (!b || !Number.isFinite(v)) { out[i] = vol > 0 ? pv / vol : Number.NaN; continue }
    pv += typical(b) * v!
    vol += v!
    out[i] = vol > 0 ? pv / vol : Number.NaN
  }
  return out
}

/** True range of bar i: the widest of high-low, high-prevClose, low-prevClose. */
function trueRange(ohlc: ReadonlyArray<OhlcBar | null | undefined>, i: number): number {
  const b = ohlc[i]
  if (!b) return Number.NaN
  const prev = i > 0 ? ohlc[i - 1] : null
  if (!prev) return b.h - b.l
  return Math.max(b.h - b.l, Math.abs(b.h - prev.c), Math.abs(b.l - prev.c))
}

/** Average true range with Wilder's smoothing. */
export function atr(ohlc: ReadonlyArray<OhlcBar | null | undefined>, period = 14): number[] {
  const n = ohlc.length
  const p = Math.max(1, Math.floor(period))
  const out = nanArray(n)
  if (n < p) return out
  let sum = 0
  for (let i = 0; i < p; i += 1) {
    const tr = trueRange(ohlc, i)
    if (!Number.isFinite(tr)) return out
    sum += tr
  }
  let prev = sum / p
  out[p - 1] = prev
  for (let i = p; i < n; i += 1) {
    const tr = trueRange(ohlc, i)
    if (!Number.isFinite(tr)) { out[i] = Number.NaN; continue }
    prev = (prev * (p - 1) + tr) / p
    out[i] = prev
  }
  return out
}

/**
 * Stochastic oscillator: %K is where the close sits in the last `period`
 * bars' range (0 to 100), %D its `smooth`-bar simple average.
 */
export function stochastic(ohlc: ReadonlyArray<OhlcBar | null | undefined>, period = 14, smooth = 3): { k: number[]; d: number[] } {
  const n = ohlc.length
  const p = Math.max(1, Math.floor(period))
  const k = nanArray(n)
  for (let i = p - 1; i < n; i += 1) {
    let hi = -Infinity
    let lo = Infinity
    let ok = true
    for (let j = i - p + 1; j <= i; j += 1) {
      const b = ohlc[j]
      if (!b) { ok = false; break }
      if (b.h > hi) hi = b.h
      if (b.l < lo) lo = b.l
    }
    const c = ohlc[i]?.c
    if (!ok || c == null) continue
    k[i] = hi === lo ? 50 : ((c - lo) / (hi - lo)) * 100
  }
  // %D is a strict average: it starts once `smooth` %K values exist, rather
  // than averaging whatever is there (which is what the tolerant SMA does).
  const sm = Math.max(1, Math.floor(smooth))
  const d = nanArray(n)
  for (let i = sm - 1; i < n; i += 1) {
    let sum = 0
    let ok = true
    for (let j = i - sm + 1; j <= i; j += 1) {
      if (!Number.isFinite(k[j])) { ok = false; break }
      sum += k[j]!
    }
    if (ok) d[i] = sum / sm
  }
  return { k, d }
}

/** On-balance volume: a running total that adds volume on up closes and
 *  subtracts it on down closes. */
export function obv(closes: ReadonlyArray<number>, volumes: ReadonlyArray<number>): number[] {
  const n = closes.length
  const out = nanArray(n)
  let total = 0
  for (let i = 0; i < n; i += 1) {
    const v = volumes[i]
    if (!Number.isFinite(closes[i]) || !Number.isFinite(v)) { out[i] = total; continue }
    if (i > 0 && Number.isFinite(closes[i - 1])) {
      if (closes[i]! > closes[i - 1]!) total += v!
      else if (closes[i]! < closes[i - 1]!) total -= v!
    }
    out[i] = total
  }
  return out
}

/**
 * Compute overlay values for a series spec like 'sma:7' / 'ema:14' / 'wma:9' /
 * 'linear'. `'bb:N:K'` returns the band's middle line (the engine draws the
 * band from `bollingerBands` itself) and `'vwap'` needs bars and volumes, so
 * it comes back as gaps here; pass `extra` for those two.
 */
export function computeOverlay(values: number[], spec: SeriesOverlay, extra?: { ohlc?: ReadonlyArray<OhlcBar | null>; volumes?: ReadonlyArray<number> }): number[] {
  return computeOverlayFit(values, spec, extra).values
}

/**
 * {@link computeOverlay} plus what a regression knows about itself: its
 * R-squared and equation. The moving averages, the bands and VWAP carry
 * neither.
 */
export function computeOverlayFit(values: number[], spec: SeriesOverlay, extra?: { ohlc?: ReadonlyArray<OhlcBar | null>; volumes?: ReadonlyArray<number> }): { values: number[]; r2?: number; equation?: string } {
  const fit = (f: { fitted: number[]; r2: number; equation: string }) => (f.equation ? { values: f.fitted, r2: f.r2, equation: f.equation } : { values: f.fitted })
  const reg = regressionFit(values, spec)
  if (reg) return fit(reg)
  return { values: computeOverlayPlain(values, spec, extra) }
}

/**
 * The regression an overlay string names (`linear`, `poly:N`, `exp`, `log`,
 * `power`), fitted to `values` on their index or on `xs`; `null` for the
 * moving averages and bands, which are not regressions. A scatter passes its
 * points' x and y so the curve is y on x, and reads `predict` to draw it.
 */
export function regressionFit(values: ReadonlyArray<number>, spec: SeriesOverlay, xs?: ReadonlyArray<number>): RegressionFit | null {
  if (spec === 'linear') return linearFit(values, xs)
  if (spec === 'exp') return exponentialFit(values, xs)
  if (spec === 'log') return logarithmicFit(values, xs)
  if (spec === 'power') return powerFit(values, xs)
  const poly = /^poly:(\d+)$/.exec(spec)
  if (poly) return polynomialFit(values, Number(poly[1]), xs)
  return null
}

/** The name a tooltip or legend gives an overlay: `sma:20` reads "SMA 20",
 *  `poly:3` "poly 3", `bb:20:2` "BB 20", the rest as written. */
export function overlayName(spec: SeriesOverlay): string {
  const m = /^(sma|ema|wma|bb|poly):(\d+)/.exec(spec)
  if (!m) return spec === 'linear' ? 'trend' : spec
  return `${m[1] === 'poly' ? 'poly' : m[1]!.toUpperCase()} ${m[2]}`
}

function computeOverlayPlain(values: number[], spec: SeriesOverlay, extra?: { ohlc?: ReadonlyArray<OhlcBar | null>; volumes?: ReadonlyArray<number> }): number[] {
  if (spec === 'vwap') return extra?.ohlc && extra.volumes ? vwap(extra.ohlc, extra.volumes) : values.map(() => NaN)
  const bb = /^bb:(\d+):(\d+(?:\.\d+)?)$/.exec(spec)
  if (bb) return bollingerBands(values, Number(bb[1]), Number(bb[2])).middle
  const m = /^(sma|ema|wma):(\d+)$/.exec(spec)
  if (!m) return values.map(() => NaN)
  const period = Number(m[2])
  if (m[1] === 'wma') return wma(values, period)
  return m[1] === 'ema' ? exponentialMovingAverage(values, period) : simpleMovingAverage(values, period)
}

/** The series an indicator reads: by label, else the first with `ohlc`, else the first. */
function sourceSeries(spec: ChartSpec, ind: ChartIndicatorSpec): ChartSeries | null {
  if (ind.source) return spec.series.find((s) => s.label === ind.source) ?? null
  return spec.series.find((s) => s.ohlc) ?? spec.series[0] ?? null
}

/** Closes of a series: its `ohlc` closes when it has them, else its values. */
function closesOf(s: ChartSeries): number[] {
  if (s.ohlc) return s.ohlc.map((b) => (b ? b.c : Number.NaN))
  return s.values.slice()
}

/**
 * Build the spec of an indicator pane from a price spec: the same categories
 * and x axis, the indicator's lines or bars, and the reference lines the
 * indicator is read against (30 / 70 for RSI, 20 / 80 for the stochastic, a
 * zero line for MACD). `SvChartPanes` stacks these under the price chart and
 * syncs them; a pane is also a complete spec for a standalone `SvChart`.
 */
export function indicatorPane(spec: ChartSpec, ind: ChartIndicatorSpec): ChartSpec {
  const src = sourceSeries(spec, ind)
  const n = spec.categories.length
  const closes = src ? closesOf(src) : nanArray(n)
  const ohlc = src?.ohlc ?? closes.map((c) => (Number.isFinite(c) ? { o: c, h: c, l: c, c } : null))
  const volumes = src?.volumes ?? nanArray(n)
  const params = ind.params ?? {}
  const base: Pick<ChartSpec, 'categories' | 'xType' | 'xAxis' | 'height' | 'palette' | 'valueFormat' | 'locale'> = {
    categories: spec.categories,
    xType: spec.xType,
    xAxis: spec.xAxis,
    height: ind.height ?? Math.max(90, Math.round((spec.height ?? 300) / 3)),
    palette: spec.palette,
    valueFormat: 'number',
    locale: spec.locale,
  }
  const refs = (lines: Array<[number, string]>): ChartReferenceLine[] =>
    lines.map(([value, label]) => ({ value, label, dashed: true }))
  switch (ind.kind) {
    case 'rsi': {
      const p = params.period ?? 14
      return { ...base, type: 'line', title: `RSI ${p}`, series: [{ label: `RSI ${p}`, values: rsi(closes, p), marker: 'none' }],
        yAxis: { min: 0, max: 100, tickInterval: 50, nice: false }, referenceLines: refs([[30, '30'], [70, '70']]) }
    }
    case 'stochastic': {
      const p = params.period ?? 14
      const sm = params.smooth ?? 3
      const { k, d } = stochastic(ohlc, p, sm)
      return { ...base, type: 'line', title: `Stochastic ${p}, ${sm}`, series: [
        { label: '%K', values: k, marker: 'none' }, { label: '%D', values: d, marker: 'none', dash: [4, 3] },
      ], yAxis: { min: 0, max: 100, tickInterval: 50, nice: false }, referenceLines: refs([[20, '20'], [80, '80']]) }
    }
    case 'macd': {
      const fast = params.fast ?? 12
      const slow = params.slow ?? 26
      const signal = params.signal ?? 9
      const m = macd(closes, fast, slow, signal)
      return { ...base, type: 'bar', title: `MACD ${fast}, ${slow}, ${signal}`, series: [
        { label: 'Histogram', values: m.histogram, colors: m.histogram.map((v) => (v < 0 ? '#ef4444' : '#16a34a')) },
        { label: 'MACD', values: m.macd, type: 'line', marker: 'none' },
        { label: 'Signal', values: m.signal, type: 'line', marker: 'none', dash: [4, 3] },
      ], referenceLines: refs([[0, '']]) }
    }
    case 'atr': {
      const p = params.period ?? 14
      return { ...base, type: 'line', title: `ATR ${p}`, series: [{ label: `ATR ${p}`, values: atr(ohlc, p), marker: 'none' }], yAxis: { min: 0 } }
    }
    case 'obv':
      return { ...base, type: 'line', title: 'OBV', series: [{ label: 'OBV', values: obv(closes, volumes), marker: 'none' }], valueFormat: 'compact' }
    case 'volume':
    default: {
      // Up bars in the up colour, down bars in the down colour, like the candles.
      const colors = ohlc.map((b, i) => {
        if (!b) return null
        const prev = i > 0 ? ohlc[i - 1] : null
        const up = prev ? b.c >= prev.c : b.c >= b.o
        return up ? '#16a34a' : '#ef4444'
      })
      return { ...base, type: 'bar', title: 'Volume', series: [{ label: 'Volume', values: volumes.slice(), colors }], yAxis: { min: 0 }, valueFormat: 'compact' }
    }
  }
}
