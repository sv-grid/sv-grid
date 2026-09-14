/**
 * A small sample spec per chart type, for a type gallery: the builder's
 * thumbnails, the docs. One tiny seeded dataset, so every card draws the
 * same numbers and the shapes are what differ. Lives in its own module and
 * is imported only by the builder, so a grid that never opens it never pays.
 */
import type { ChartSpec, ChartType } from './chart-types'
import { rowsToBoxSpec, rowsToChartSpec, rowsToHistogramSpec, rowsToRangeSpec, rowsToScatterSpec, specToCalendar, specToSankey, specToTreemap } from './chart'

type Order = { day: string; region: string; channel: string; units: number; cost: number; revenue: number }

let cached: Order[] | null = null
function rows(): Order[] {
  if (cached) return cached
  let seed = 7
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const regions = ['North', 'South', 'East', 'West']
  const channels = ['Web', 'Retail', 'Partner']
  const out: Order[] = []
  const start = Date.UTC(2026, 0, 1)
  for (let i = 0; i < 160; i += 1) {
    const day = new Date(start + Math.floor(rnd() * 180) * 86_400_000).toISOString().slice(0, 10)
    const units = 1 + Math.floor(rnd() * 12)
    const price = 40 + rnd() * 160
    const revenue = Math.round(units * price)
    out.push({ day, region: regions[Math.floor(rnd() * 4)]!, channel: channels[Math.floor(rnd() * 3)]!, units, cost: Math.round(revenue * (0.5 + rnd() * 0.3)), revenue })
  }
  cached = out
  return out
}

/** The label a type gallery shows for each type. */
export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Bar', line: 'Line', area: 'Area', pie: 'Pie', scatter: 'Scatter', heatmap: 'Heat map', waterfall: 'Waterfall',
  funnel: 'Funnel', radar: 'Radar', calendar: 'Calendar', gauge: 'Gauge', treemap: 'Tree map', sankey: 'Sankey',
  candlestick: 'Candlestick', ohlc: 'OHLC', boxplot: 'Box plot', histogram: 'Histogram', 'range-bar': 'Range bar',
  'range-area': 'Range area', lollipop: 'Lollipop', dumbbell: 'Dumbbell', pareto: 'Pareto', stream: 'Stream',
  sunburst: 'Sunburst', 'radial-bar': 'Radial bar', 'radial-column': 'Radial column', nightingale: 'Nightingale',
  chord: 'Chord', bullet: 'Bullet',
}

/**
 * A complete, small spec of the given type, drawn from the shared sample
 * dataset. Pass a `palette` to colour it like the chart it stands in for.
 */
export function sampleChartSpec(type: ChartType, palette?: string[]): ChartSpec {
  const data = rows()
  const byRegion = rowsToChartSpec(data, { type: 'bar', category: 'region', value: 'revenue' })
  const byRegionChannel = rowsToChartSpec(data, { type: 'bar', category: 'region', value: 'revenue', series: 'channel' })
  const byMonth = rowsToChartSpec(data, { type: 'line', category: 'day', value: 'revenue', bucket: 'month' })
  const byMonthChannel = rowsToChartSpec(data, { type: 'area', category: 'day', value: 'revenue', series: 'channel', bucket: 'month' })
  const ranged = () => rowsToRangeSpec(
    byRegion.categories.map((c, i) => ({ region: c, cost: byRegion.series[0]!.values[i]! * 0.6, revenue: byRegion.series[0]!.values[i]! })),
    { category: 'region', low: 'cost', high: 'revenue' },
  )
  const ohlc = () => {
    const v = byMonth.series[0]!.values
    const bars = v.map((c, i) => { const o = i ? v[i - 1]! : c * 0.95; return { o, c, h: Math.max(o, c) * 1.04, l: Math.min(o, c) * 0.96 } })
    return { categories: byMonth.categories, series: [{ label: 'Revenue', values: v, ohlc: bars }], xType: 'ordinal-time' as const }
  }
  let spec: ChartSpec
  switch (type) {
    case 'line': spec = { ...byMonthChannel, type: 'line' }; break
    case 'area': spec = { ...byMonthChannel, type: 'area', stacked: true }; break
    case 'lollipop': spec = { ...byRegion, type: 'lollipop' }; break
    case 'dumbbell': spec = { ...ranged(), type: 'dumbbell' }; break
    case 'range-bar': spec = ranged(); break
    case 'range-area': spec = { ...byMonth, type: 'range-area', series: [{ label: 'Band', values: byMonth.series[0]!.values.map((v) => v * 1.15), lowValues: byMonth.series[0]!.values.map((v) => v * 0.85) }] }; break
    case 'pareto': spec = { ...rowsToChartSpec(data, { type: 'bar', category: 'channel', value: 'units' }), type: 'pareto' }; break
    case 'radial-column': spec = { ...byRegionChannel, type: 'radial-column', stacked: true }; break
    case 'radial-bar': spec = { ...byRegion, type: 'radial-bar' }; break
    case 'nightingale': spec = { ...byMonth, type: 'nightingale' }; break
    case 'pie': spec = { ...byRegion, type: 'pie', innerRadius: 0.55 }; break
    case 'treemap': spec = { ...byRegionChannel, type: 'treemap', treemap: specToTreemap(byRegionChannel) }; break
    case 'sunburst': spec = { ...byRegionChannel, type: 'sunburst', tree: specToTreemap(byRegionChannel) }; break
    case 'funnel': spec = { type: 'funnel', categories: ['Visits', 'Sign-ups', 'Trials', 'Paid'], series: [{ label: 'Users', values: [12400, 5100, 2300, 880] }] }; break
    case 'waterfall': spec = { type: 'waterfall', categories: ['Start', 'Web', 'Retail', 'Partner', 'Returns', 'End'], series: [{ label: 'P&L', values: [120, 48, 31, 22, -19, 0] }], waterfallTotals: [true, false, false, false, false, true] }; break
    case 'sankey': { const f = specToSankey(byRegionChannel); spec = { ...byRegionChannel, type: 'sankey', sankeyNodes: f.nodes, sankeyLinks: f.links }; break }
    case 'chord': { const f = specToSankey(byRegionChannel); spec = { ...byRegionChannel, type: 'chord', sankeyNodes: f.nodes, sankeyLinks: f.links }; break }
    case 'radar': spec = { ...byRegionChannel, type: 'radar' }; break
    case 'heatmap': spec = { ...byRegionChannel, type: 'heatmap' }; break
    case 'scatter': spec = rowsToScatterSpec(data.slice(0, 80), { x: 'cost', y: 'revenue', series: 'channel', r: 'units' }); break
    case 'boxplot': spec = rowsToBoxSpec(data, { category: 'region', value: 'revenue' }); break
    case 'histogram': spec = rowsToHistogramSpec(data, { value: 'revenue', bins: 10 }); break
    case 'gauge': spec = { type: 'gauge', categories: [], series: [], gaugeValue: 72, gaugeMin: 0, gaugeMax: 100, gaugeTarget: 80, gaugeUnit: '%', gaugeRanges: [{ from: 0, to: 50, color: '#ef4444' }, { from: 50, to: 75, color: '#f59e0b' }, { from: 75, to: 100, color: '#16a34a' }] }; break
    case 'bullet': spec = { type: 'bullet', categories: byRegion.categories, series: [{ label: 'Revenue', values: byRegion.series[0]!.values, targets: byRegion.series[0]!.values.map((v, i) => v * (0.9 + (i % 3) * 0.1)) }] }; break
    case 'calendar': { const daily = rowsToChartSpec(data, { type: 'bar', category: 'day', value: 'units' }); spec = { ...daily, type: 'calendar', calendarValues: specToCalendar(daily) }; break }
    case 'stream': spec = { ...byMonthChannel, type: 'stream', stacked: true, stackOffset: 'wiggle' }; break
    case 'candlestick': spec = { type: 'candlestick', ...ohlc() }; break
    case 'ohlc': spec = { type: 'ohlc', ...ohlc() }; break
    case 'bar':
    default: spec = { ...byRegionChannel, type: 'bar' }
  }
  return palette ? { ...spec, palette } : spec
}

/** A sample spec trimmed for a thumbnail: no titles, no axis labels, small. */
export function sampleChartThumb(type: ChartType, palette?: string[], width = 150, height = 92): ChartSpec {
  const s = sampleChartSpec(type, palette)
  return {
    ...s, width, height, title: undefined, yAxisTitle: undefined, xAxisTitle: undefined, referenceLines: undefined,
    xAxis: { ...(s.xAxis ?? {}), labels: false, title: undefined },
    yAxis: { ...(s.yAxis ?? {}), labels: false, title: undefined },
    y2Axis: { ...(s.y2Axis ?? {}), labels: false, title: undefined },
  }
}
