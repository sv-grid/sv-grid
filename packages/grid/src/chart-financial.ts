/**
 * Price-chart helpers: candle transforms, calendar resampling and the
 * row-to-candlestick adapter. Indicators live in chart-indicators. DOM-free.
 */
import type { ChartSeries, ChartSpec, OhlcBar, SeriesOverlay } from './chart-types'
import { bucketStart, type ChartTimeBucket } from './chart-stats'
import type { ChartIndicatorSpec } from './chart-indicators'

/**
 * Heikin-Ashi ("average bar") candles from ordinary OHLC bars. Each close is
 * the mean of the four prices, each open the midpoint of the previous
 * Heikin-Ashi body, and the high / low stretch to include both. Runs of one
 * colour then read as trends, at the cost of the true open and close.
 * `null` bars (gaps) stay null and reset the chain.
 */
export function heikinAshi(bars: ReadonlyArray<OhlcBar | null>): Array<OhlcBar | null> {
  const out: Array<OhlcBar | null> = new Array(bars.length)
  let prev: OhlcBar | null = null
  for (let i = 0; i < bars.length; i += 1) {
    const b = bars[i]
    if (!b || ![b.o, b.h, b.l, b.c].every(Number.isFinite)) {
      out[i] = null
      prev = null
      continue
    }
    const c = (b.o + b.h + b.l + b.c) / 4
    const o = prev ? (prev.o + prev.c) / 2 : (b.o + b.c) / 2
    const ha: OhlcBar = { o, c, h: Math.max(b.h, o, c), l: Math.min(b.l, o, c) }
    out[i] = ha
    prev = ha
  }
  return out
}

/**
 * Roll daily (or finer) bars up to a coarser calendar bucket: the first
 * open, the highest high, the lowest low, the last close, the summed volume.
 * Categories are ISO dates and come back as the bucket starts (`bucketStart`),
 * sorted; bars whose date does not parse are dropped. Pass `volumes` to get
 * them summed alongside.
 */
export function resampleOhlc(
  categories: ReadonlyArray<string>,
  ohlc: ReadonlyArray<OhlcBar | null>,
  opts: { bucket: ChartTimeBucket; volumes?: ReadonlyArray<number> },
): { categories: string[]; ohlc: Array<OhlcBar | null>; volumes?: number[] } {
  const groups = new Map<string, { bar: OhlcBar | null; vol: number; first: number; last: number }>()
  const order: Array<[string, number]> = []
  for (let i = 0; i < categories.length; i += 1) {
    const t = Date.parse(categories[i]!)
    if (!Number.isFinite(t)) continue
    const key = bucketStart(t, opts.bucket)
    if (!key) continue
    let g = groups.get(key)
    if (!g) {
      g = { bar: null, vol: 0, first: Infinity, last: -Infinity }
      groups.set(key, g)
      order.push([key, Date.parse(key)])
    }
    const b = ohlc[i]
    if (b) {
      // Rows may arrive out of order: the open is the EARLIEST bar's and the
      // close the LATEST bar's, by date, not by position.
      if (!g.bar) g.bar = { ...b }
      else {
        g.bar.h = Math.max(g.bar.h, b.h)
        g.bar.l = Math.min(g.bar.l, b.l)
        if (t >= g.last) g.bar.c = b.c
        if (t <= g.first) g.bar.o = b.o
      }
      if (t > g.last) g.last = t
      if (t < g.first) g.first = t
    }
    const v = opts.volumes?.[i]
    if (Number.isFinite(v)) g.vol += v!
  }
  order.sort((a, b) => a[1] - b[1])
  const out = {
    categories: order.map(([k]) => k),
    ohlc: order.map(([k]) => groups.get(k)!.bar),
    ...(opts.volumes ? { volumes: order.map(([k]) => groups.get(k)!.vol) } : {}),
  }
  return out
}

/** What the grid's chart panel stores for a price chart: the column ids. */
export type OhlcColumns = { open: string | null; high: string | null; low: string | null; close: string | null; volume: string | null }

/**
 * Guess the price columns from their names: the first numeric column called
 * open / high / low / close (or last, price) / volume. What the chart panel
 * shows before the reader picks anything; a picked column always wins.
 */
export function guessOhlcColumns(
  measures: ReadonlyArray<{ id: string; field: string; label: string }>,
  picked?: Partial<OhlcColumns> | null,
): OhlcColumns {
  const guess = (re: RegExp) => measures.find((m) => re.test(m.field) || re.test(m.label))?.id ?? null
  return {
    open: picked?.open ?? guess(/open/i),
    high: picked?.high ?? guess(/high/i),
    low: picked?.low ?? guess(/low/i),
    close: picked?.close ?? guess(/close|last|price/i),
    volume: picked?.volume ?? guess(/vol/i),
  }
}

/**
 * The `rowsToDirectSpec` options for the grid panel's price chart, or null
 * while a price column is still unpicked. `fieldOf` maps a column id to its
 * field name; the date column is the category.
 */
export function ohlcDirectOptions(
  fieldOf: (id: string | null) => string | null | undefined,
  dateId: string | null,
  cols: OhlcColumns,
  extra: { bucket?: ChartTimeBucket | null; candleStyle?: ChartSpec['candleStyle'] | null },
): { category: string; ohlc: NonNullable<Parameters<typeof import('./chart').rowsToDirectSpec>[2]['ohlc']> } | null {
  const date = fieldOf(dateId)
  const open = fieldOf(cols.open)
  const high = fieldOf(cols.high)
  const low = fieldOf(cols.low)
  const close = fieldOf(cols.close)
  if (!date || !open || !high || !low || !close) return null
  const volume = fieldOf(cols.volume)
  return {
    category: date,
    ohlc: {
      open, high, low, close,
      ...(volume ? { volume } : {}),
      ...(extra.bucket ? { bucket: extra.bucket } : {}),
      ...(extra.candleStyle ? { candleStyle: extra.candleStyle } : {}),
      lastPriceLine: true,
    },
  }
}

/** The indicator names the grid's chart panel offers. */
export type ChartPanelIndicator = 'volume' | 'rsi' | 'macd' | 'stochastic' | 'atr' | 'obv' | 'sma' | 'ema' | 'bb' | 'vwap'

/**
 * Split the panel's indicator list into the panes that go under the price
 * (in order) and the one overlay that rides on it (a series carries a single
 * `overlay`, so the first overlay kind wins).
 */
export function splitPanelIndicators(kinds: ReadonlyArray<ChartPanelIndicator>): { panes: ChartIndicatorSpec[]; overlay: SeriesOverlay | null } {
  const OVERLAY: Partial<Record<ChartPanelIndicator, SeriesOverlay>> = { sma: 'sma:20', ema: 'ema:20', bb: 'bb:20:2', vwap: 'vwap' }
  const panes: ChartIndicatorSpec[] = []
  let overlay: SeriesOverlay | null = null
  for (const k of kinds) {
    const o = OVERLAY[k]
    if (o) { overlay ??= o; continue }
    if (k === 'volume' || k === 'rsi' || k === 'macd' || k === 'stochastic' || k === 'atr' || k === 'obv') panes.push({ kind: k })
  }
  return { panes, overlay }
}

/**
 * A candlestick spec straight from rows: one bar per date (sorted), with the
 * volume alongside when a field is named, optionally rolled up to a calendar
 * bucket first. The x axis is ordinal-time, so weekends and holidays leave no
 * gaps.
 */
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
): ChartSpec {
  const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v))
  const sorted = rows
    .map((r) => ({ r, t: Date.parse(String(r[opts.date])) }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t)
  let categories = sorted.map((x) => new Date(x.t).toISOString().slice(0, 10))
  let ohlc: Array<OhlcBar | null> = sorted.map(({ r }) => {
    const b = { o: num(r[opts.open]), h: num(r[opts.high]), l: num(r[opts.low]), c: num(r[opts.close]) }
    return [b.o, b.h, b.l, b.c].every(Number.isFinite) ? b : null
  })
  let volumes = opts.volume ? sorted.map(({ r }) => num(r[opts.volume!])) : undefined
  if (opts.bucket) {
    const rolled = resampleOhlc(categories, ohlc, { bucket: opts.bucket, volumes })
    categories = rolled.categories
    ohlc = rolled.ohlc
    volumes = rolled.volumes
  }
  const label = opts.label ?? 'Price'
  const series: ChartSeries = { label, values: ohlc.map((b) => (b ? b.c : Number.NaN)), ohlc, ...(volumes ? { volumes } : {}) }
  return {
    type: opts.type ?? 'candlestick',
    categories,
    series: [series],
    xType: 'ordinal-time',
    ...(opts.candleStyle ? { candleStyle: opts.candleStyle } : {}),
    ...(opts.lastPriceLine ? { lastPriceLine: true } : {}),
  }
}
