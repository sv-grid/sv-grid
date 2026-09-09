# `@svgrid/grid` · `chart-export.ts`

Auto-generated. Source: `packages\grid\src\chart-export.ts`.

### `type ChartExportOptions`

Options for exporting a chart: the filename, and the background to paint behind it. */

```ts
export type ChartExportOptions = {
  /** Background color of the exported image. Default: the grid background. */
  background?: string
  /** PNG pixel scale (1 = viewBox size). Default 2 (retina). */
  scale?: number
}
```

### `function chartToSvgString`

Serialize the chart SVG to a standalone, self-styled SVG string. */

```ts
export function chartToSvgString(
  source: SVGSVGElement | HTMLElement,
  options: ChartExportOptions = {},
): string {
  const svg = resolveSvg(source)
  if (!svg) throw new Error('chartToSvgString: no <svg> found')

  const fg = cssVar(svg, '--sg-fg', '#0f172a')
  const muted = cssVar(svg, '--sg-muted', '#64748b')
  const border = cssVar(svg, '--sg-border', '#e2e8f0')
  const bg = options.background ?? cssVar(svg, '--sg-bg', '#ffffff')

  const vb = svg.viewBox.baseVal
  const w = vb && vb.width ? vb.width : svg.clientWidth || 520
  const h = vb && vb.height ? vb.height : svg.clientHeight || 300

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  // Inline computed paint/text styles so the export is what's on screen -
  // dynamic SVG presentation attributes (a line's `stroke={color}`) and scoped
  // component CSS don't survive a raw clone + XMLSerializer. Walk the live tree
  // and its clone (1:1 here, before we prune hit layers) and copy the resolved
  // style, so line paths etc. export with their real stroke instead of nothing.
  const PAINT_PROPS = [
    'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity',
    'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity',
    'font-size', 'font-family', 'font-weight', 'text-anchor',
  ]
  const liveNodes = svg.querySelectorAll('*')
  const cloneNodes = clone.querySelectorAll('*')
  for (let i = 0; i < liveNodes.length; i += 1) {
    const el = cloneNodes[i] as (SVGElement & { style: CSSStyleDeclaration }) | undefined
    if (!el || !el.style) continue
    const cs = getComputedStyle(liveNodes[i]!)
    for (const prop of PAINT_PROPS) {
      const v = cs.getPropertyValue(prop)
      if (v && v !== 'normal') el.style.setProperty(prop, v)
    }
  }

  // Drop interaction-only hit layers.
  clone.querySelectorAll('.sv-grid-chart-hit').forEach((n) => n.remove())

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = `
    .sv-grid-chart-axis { fill: ${muted}; font-size: 10px; font-family: sans-serif; }
    .sv-grid-chart-gridline { stroke: ${border}; stroke-width: 1; opacity: 0.6; }
    .sv-grid-chart-gridline.is-zero { stroke: ${muted}; opacity: 0.9; }
    .sv-grid-chart-datalabel { fill: ${fg}; font-size: 9.5px; font-weight: 600; font-family: sans-serif; }
    .sv-grid-chart-datalabel.on-bar { fill: #fff; }
    .sv-grid-chart-donut-total { fill: ${fg}; font-size: 16px; font-weight: 800; font-family: sans-serif; }
    .sv-grid-chart-donut-label { fill: ${muted}; font-size: 10px; font-family: sans-serif; }
  `
  clone.insertBefore(style, clone.firstChild)

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('x', '0')
  rect.setAttribute('y', '0')
  rect.setAttribute('width', String(w))
  rect.setAttribute('height', String(h))
  rect.setAttribute('fill', bg)
  clone.insertBefore(rect, style.nextSibling)

  return new XMLSerializer().serializeToString(clone)
}
```

### `function downloadChartSvg`

Download the chart as an `.svg` file. */

```ts
export function downloadChartSvg(
  source: SVGSVGElement | HTMLElement,
  filename = 'chart.svg',
  options: ChartExportOptions = {},
): void {
  const svg = chartToSvgString(source, options)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  triggerDownload(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
```

### `function chartToPngBlob`

Rasterize the chart to a PNG `Blob`. */

```ts
export function chartToPngBlob(
  source: SVGSVGElement | HTMLElement,
  options: ChartExportOptions = {},
): Promise<Blob> {
  const svgStr = chartToSvgString(source, options)
  const scale = options.scale ?? 2
  const svgEl = resolveSvg(source)!
  const vb = svgEl.viewBox.baseVal
  const w = (vb && vb.width ? vb.width : svgEl.clientWidth || 520) * scale
  const h = (vb && vb.height ? vb.height : svgEl.clientHeight || 300) * scale

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w)
      canvas.height = Math.round(h)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('canvas 2d context unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('failed to rasterize chart SVG'))
    }
    img.src = url
  })
}
```

### `function chartSpecToCsv`

Serialize a chart's data to CSV: one row per category, one column per series
(`Category, <series 1>, ...`).

A series that carries more than one number per category widens instead of
losing them. `ohlc` becomes four columns, `boxes` five plus its outliers,
`errors` two. This used to write `values` and nothing else, which quietly
made "Export CSV" on a candlestick chart hand back the closing prices only -
the screen-reader table was given the four real numbers on purpose and the
export, which is what people actually take away, was not.

Scatter has no categories, so it gets its own long-format table of points
rather than exporting nothing at all.

Still empty for the specs with no rectangular data to write: sankey, treemap,
gauge and calendar.

```ts
export function chartSpecToCsv(spec: ChartSpec): string {
  const series = spec.series ?? []
  // Scatter: one row per point. `categories` is empty for these, so the
  // category path below would return '' and the export button would do nothing.
  if (series.some((s) => s.points?.length)) {
    const header = ['Series', 'X', 'Y', 'Size', 'Label'].map(csvCell).join(',')
    const rows: string[] = []
    for (const s of series) {
      for (const p of s.points ?? []) {
        rows.push([s.label, p.x, p.y, p.r ?? '', p.label ?? ''].map(csvCell).join(','))
      }
    }
    return rows.length ? [header, ...rows].join('\n') : ''
  }

  const cats = spec.categories ?? []
  if (!cats.length || !series.length) return ''

  // One header cell per column a series contributes. A plain series keeps its
  // bare label, so an existing export is byte-identical.
  const header: string[] = ['Category']
  for (const s of series) {
    if (s.ohlc) header.push(`${s.label} Open`, `${s.label} High`, `${s.label} Low`, `${s.label} Close`)
    else if (s.boxes) header.push(`${s.label} Min`, `${s.label} Q1`, `${s.label} Median`, `${s.label} Q3`, `${s.label} Max`, `${s.label} Outliers`)
    else if (s.errors) header.push(s.label, `${s.label} Low`, `${s.label} High`)
    else header.push(s.label)
  }

  const rows = cats.map((cat, i) => {
    const cells: unknown[] = [cat]
    for (const s of series) {
      if (s.ohlc) {
        const k = s.ohlc[i]
        cells.push(k?.o ?? '', k?.h ?? '', k?.l ?? '', k?.c ?? '')
      } else if (s.boxes) {
        const b = s.boxes[i]
        // Outliers are a list inside one cell; csvCell quotes it.
        cells.push(b?.min ?? '', b?.q1 ?? '', b?.median ?? '', b?.q3 ?? '', b?.max ?? '', b?.outliers?.join(' ') ?? '')
      } else if (s.errors) {
        const v = s.values[i]
        const e = s.errors[i]
        const lo = e == null ? '' : typeof e === 'number' ? (v ?? 0) - Math.abs(e) : Math.min(e.lo, e.hi)
        const hi = e == null ? '' : typeof e === 'number' ? (v ?? 0) + Math.abs(e) : Math.max(e.lo, e.hi)
        cells.push(v ?? '', lo, hi)
      } else {
        cells.push(s.values[i] ?? '')
      }
    }
    return cells.map(csvCell).join(',')
  })
  return [header.map(csvCell).join(','), ...rows].join('\n')
}
```

### `function chartCsvExportable`

Whether {@link chartSpecToCsv} would produce anything, without building it.

The chart panel disables its CSV menu item on this. It has to be a predicate
rather than `chartSpecToCsv(spec) !== ''` because that runs on every render,
and serialising a 100,000-point series to decide whether to grey out a button
is not a thing to do sixty times a second.

```ts
export function chartCsvExportable(spec: ChartSpec): boolean {
  const series = spec.series ?? []
  if (series.some((s) => s.points?.length)) return true
  return !!(spec.categories?.length && series.length)
}
```

### `function downloadChartCsv`

Download the chart's data as a `.csv` file. Returns false if there's no
 rectangular category/series data to export. */

```ts
export function downloadChartCsv(spec: ChartSpec, filename = 'chart.csv'): boolean {
  const csv = chartSpecToCsv(spec)
  if (!csv) return false
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  triggerDownload(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
```
