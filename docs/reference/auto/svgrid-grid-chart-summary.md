# `@svgrid/grid` · `chart-summary.ts`

Auto-generated. Source: `packages\grid\src\chart-summary.ts`.

### `type ChartSummaryOptions`

What {@link chartSummary} takes.

```ts
export type ChartSummaryOptions = {
  /** How numbers are written. Default: the spec's `valueFormat` / `locale` / `currency`. */
  formatValue?: (v: number) => string
  /** How many series a cartesian chart describes before it says "and N more". Default 4. */
  maxSeries?: number
}
```

### `function chartSummary`

Describe a spec in plain words. Never throws: an empty spec of any type
comes back as "No data." so a live region always has something to say.

```ts
export function chartSummary(spec: ChartSpec, opts: ChartSummaryOptions = {}): string {
  const fmt = opts.formatValue ?? ((v: number) => formatChartValue(v, spec.valueFormat, spec))
  const max = opts.maxSeries ?? 4
  const cats = spec.categories ?? []
  const series = (spec.series ?? []).filter((s) => s.visible !== false)
  const type = spec.type
  try {
    if (type === 'pie' || type === 'radial-bar' || type === 'nightingale') {
      const s = series[0]
      if (!s || !s.values.some(finite)) return 'No data.'
      return shares(cats, s.values, fmt, 'slice')
    }
    if (type === 'treemap' || type === 'sunburst') {
      const root = spec.treemap ?? spec.tree
      const kids = root?.children ?? []
      if (!kids.length) return 'No data.'
      const total = (n: { value?: number; children?: Array<{ value?: number; children?: unknown[] }> }): number =>
        n.value ?? (n.children ?? []).reduce((a, c) => a + total(c as never), 0)
      return shares(kids.map((k) => k.name), kids.map((k) => total(k)), fmt, 'node')
    }
    if (type === 'gauge') {
      if (!finite(spec.gaugeValue)) return 'No data.'
      const lo = spec.gaugeMin ?? 0
      const hi = spec.gaugeMax ?? 100
      const share = hi > lo ? Math.round(((spec.gaugeValue - lo) / (hi - lo)) * 100) : 0
      const target = finite(spec.gaugeTarget) ? `, ${spec.gaugeValue >= spec.gaugeTarget ? 'above' : 'below'} the target of ${fmt(spec.gaugeTarget)}` : ''
      return `${fmt(spec.gaugeValue)}${spec.gaugeUnit ? ' ' + spec.gaugeUnit : ''}, ${share}% of the way from ${fmt(lo)} to ${fmt(hi)}${target}.`
    }
    if (type === 'scatter') {
      const pts = series.flatMap((s) => s.points ?? []).filter((p) => finite(p.x) && finite(p.y))
      if (!pts.length) return 'No data.'
      const r = pearson(pts.map((p) => p.x), pts.map((p) => p.y))
      const strength = Math.abs(r) >= 0.7 ? 'strong' : Math.abs(r) >= 0.4 ? 'moderate' : Math.abs(r) >= 0.2 ? 'weak' : 'no'
      const sign = r > 0 ? 'positive' : 'negative'
      const rel = strength === 'no' ? 'no clear correlation' : `a ${strength} ${sign} correlation (r ${r.toFixed(2)})`
      return `${pts.length} points in ${series.length} series with ${rel} between x and y.`
    }
    if (type === 'candlestick' || type === 'ohlc') {
      const s = series.find((x) => x.ohlc) ?? series[0]
      const bars = (s?.ohlc ?? []).filter((b): b is NonNullable<typeof b> => !!b)
      if (!s || !bars.length) return 'No data.'
      const last = bars[bars.length - 1]!
      const prev = bars.length > 1 ? bars[bars.length - 2]! : null
      const hi = Math.max(...bars.map((b) => b.h))
      const lo = Math.min(...bars.map((b) => b.l))
      const move = prev ? `, ${last.c >= prev.c ? 'up' : 'down'} ${pct(prev.c, last.c)} on the session` : ''
      return `${s.label}: last close ${fmt(last.c)}${move}, ranging ${fmt(lo)} to ${fmt(hi)} over ${bars.length} bars.`
    }
    if (type === 'heatmap') {
      let best: { v: number; row: string; col: string } | null = null
      for (const s of series) s.values.forEach((v, i) => { if (finite(v) && (!best || v > best.v)) best = { v, row: s.label, col: cats[i] ?? String(i) } })
      if (!best) return 'No data.'
      const b = best as { v: number; row: string; col: string }
      return `${series.length} rows by ${cats.length} columns; the highest cell is ${fmt(b.v)} at ${b.row} and ${b.col}.`
    }
    if (type === 'calendar') {
      const days = (spec.calendarValues ?? []).filter((d) => finite(d.value))
      if (!days.length) return 'No data.'
      const top = days.reduce((a, d) => (d.value > a.value ? d : a), days[0]!)
      const total = days.reduce((a, d) => a + d.value, 0)
      return `${days.length} days totalling ${fmt(total)}; the busiest is ${top.date} at ${fmt(top.value)}.`
    }
    if (type === 'funnel') {
      const s = series[0]
      const vals = (s?.values ?? []).filter(finite)
      if (!s || vals.length < 2) return s && vals.length === 1 ? `${cats[0] ?? s.label}: ${fmt(vals[0]!)}.` : 'No data.'
      const first = vals[0]!
      const last = vals[vals.length - 1]!
      const conv = first ? Math.round((last / first) * 100) : 0
      let worstDrop = 0
      let worstAt = ''
      for (let i = 1; i < vals.length; i += 1) {
        const drop = vals[i - 1]! ? 1 - vals[i]! / vals[i - 1]! : 0
        if (drop > worstDrop) { worstDrop = drop; worstAt = cats[i] ?? `step ${i + 1}` }
      }
      return `${conv}% of ${fmt(first)} at ${cats[0] ?? 'the top'} reach ${cats[vals.length - 1] ?? 'the bottom'}${worstAt ? `; the biggest drop is into ${worstAt} (${Math.round(worstDrop * 100)}% lost)` : ''}.`
    }
    if (type === 'boxplot') {
      let widest: { label: string; spread: number } | null = null
      for (const s of series) for (const b of s.boxes ?? []) {
        if (!b) continue
        const spread = b.q3 - b.q1
        if (!widest || spread > widest.spread) widest = { label: s.label, spread }
      }
      if (!widest) return 'No data.'
      return `${series.length} distributions over ${cats.length} categories; ${widest.label} has the widest interquartile range at ${fmt(widest.spread)}.`
    }
    if (type === 'sankey' || type === 'chord') {
      const links = spec.sankeyLinks ?? []
      if (!links.length) return 'No data.'
      const total = links.reduce((a, l) => a + (finite(l.value) ? l.value : 0), 0)
      const top = [...links].sort((a, b) => b.value - a.value)[0]!
      return `${links.length} flows totalling ${fmt(total)}; the largest is ${top.source} to ${top.target} at ${fmt(top.value)}.`
    }
    // Cartesian families: one sentence per series, up to the cap.
    const usable = series.filter((s) => s.values.some(finite) || s.ohlc)
    if (!usable.length) return 'No data.'
    const shown = usable.slice(0, max)
    const parts = shown.map((s) => describeSeries(s, cats, fmt))
    const more = usable.length > shown.length ? ` And ${usable.length - shown.length} more series.` : ''
    return `${parts.join(' ')}${more}`
  } catch {
    return 'No data.'
  }
}
```
