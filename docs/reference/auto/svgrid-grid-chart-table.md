# `@svgrid/grid` · `chart-table.ts`

Auto-generated. Source: `packages\grid\src\chart-table.ts`.

### `type ChartTableColumn`

One column of a chart's table: what `SvGrid` needs to draw it.

```ts
export type ChartTableColumn = {
  field: string
  header: string
  cellDataType?: 'number' | 'text' | 'date'
  format?: CellFormatConfig
  width?: number
}
```

### `type ChartTable`

A chart's data as a table: grid columns and plain row objects.

```ts
export type ChartTable = {
  columns: ChartTableColumn[]
  rows: Array<Record<string, unknown>>
}
```

### `function chartSpecToTable`

The rows and columns a chart spec amounts to. Never throws: a spec with
nothing to tabulate comes back with no rows and no columns.

```ts
export function chartSpecToTable(spec: ChartSpec): ChartTable {
  const fmt = formatOf(spec.valueFormat, spec)
  // A series on the right axis reads in that axis's format: a margin of 0.29
  // beside a revenue in dollars is "29%", not "$0.29".
  const fmt2 = formatOf(spec.y2Axis?.format, spec)
  const numCol = (field: string, header: string, right = false): ChartTableColumn => {
    const f = right ? fmt2 : fmt
    return { field, header, cellDataType: 'number', ...(f ? { format: f } : {}) }
  }
  const textCol = (field: string, header: string): ChartTableColumn => ({ field, header })
  const series = spec.series ?? []

  // Scatter and bubble: one row per point.
  if (series.some((s) => s.points?.length)) {
    const rows: Array<Record<string, unknown>> = []
    for (const s of series) for (const p of s.points ?? []) rows.push({ series: s.label, x: num(p.x), y: num(p.y), size: num(p.r), label: p.label ?? '' })
    return { columns: [textCol('series', 'Series'), numCol('x', 'X'), numCol('y', 'Y'), numCol('size', 'Size'), textCol('label', 'Label')], rows }
  }
  // Sankey and chord: one row per link.
  if (spec.sankeyLinks?.length) {
    const names = new Map((spec.sankeyNodes ?? []).map((n) => [n.id, n.label ?? n.id]))
    const rows = spec.sankeyLinks.map((l) => ({ source: names.get(l.source) ?? l.source, target: names.get(l.target) ?? l.target, value: num(l.value) }))
    return { columns: [textCol('source', 'Source'), textCol('target', 'Target'), numCol('value', 'Value')], rows }
  }
  // Tree map and sunburst: one row per leaf, a column per level.
  const tree = spec.tree ?? spec.treemap
  if (tree && (spec.type === 'treemap' || spec.type === 'sunburst' || !spec.categories?.length)) {
    const rows: Array<Record<string, unknown>> = []
    let depth = 0
    const walk = (n: TreeNode, path: string[]) => {
      if (n.children?.length) {
        for (const c of n.children) walk(c, [...path, c.name])
        return
      }
      depth = Math.max(depth, path.length)
      const row: Record<string, unknown> = { value: num(n.value) }
      path.forEach((seg, i) => (row[`level${i + 1}`] = seg))
      rows.push(row)
    }
    walk(tree, [])
    const columns: ChartTableColumn[] = []
    for (let i = 1; i <= depth; i += 1) columns.push(textCol(`level${i}`, depth === 1 ? 'Name' : `Level ${i}`))
    columns.push(numCol('value', 'Value'))
    return { columns, rows }
  }
  // Calendar: one row per day.
  if (spec.calendarValues?.length) {
    return {
      columns: [{ field: 'date', header: 'Date', cellDataType: 'date' }, numCol('value', 'Value')],
      rows: spec.calendarValues.map((d) => ({ date: d.date, value: num(d.value) })),
    }
  }
  // Gauge: the one reading and its scale.
  if (spec.type === 'gauge') {
    return {
      columns: [textCol('metric', 'Metric'), numCol('value', spec.gaugeUnit ? `Value (${spec.gaugeUnit})` : 'Value'), numCol('min', 'Min'), numCol('max', 'Max'), numCol('target', 'Target')],
      rows: [{ metric: spec.title ?? spec.series[0]?.label ?? 'Value', value: num(spec.gaugeValue), min: num(spec.gaugeMin ?? 0), max: num(spec.gaugeMax ?? 100), target: num(spec.gaugeTarget) }],
    }
  }

  // Everything else reads categories x series: one row per category, one
  // column per number a series carries.
  const cats = spec.categories ?? []
  if (!cats.length || !series.length) return { columns: [], rows: [] }
  const columns: ChartTableColumn[] = []
  const groups = spec.categoryGroups
  if (groups?.length) columns.push(textCol('group', 'Group'))
  const edges = spec.binEdges
  const xType = spec.xAxis?.type ?? spec.xType
  const dated = xType === 'time' || xType === 'ordinal-time'
  const catHeader = spec.xAxis?.title ?? spec.xAxisTitle ?? (dated ? 'Date' : 'Category')
  if (edges && edges.length === cats.length + 1) columns.push(numCol('from', 'From'), numCol('to', 'To'))
  else columns.push(dated ? { field: 'category', header: catHeader, cellDataType: 'date' } : textCol('category', catHeader))
  const fields: Array<{ field: string; pick: (i: number) => unknown }> = []
  series.forEach((s, si) => {
    const key = (suffix: string) => `s${si}${suffix}`
    const add = (suffix: string, header: string, pick: (i: number) => unknown) => {
      columns.push(numCol(key(suffix), header, s.axis === 'right'))
      fields.push({ field: key(suffix), pick })
    }
    if (s.ohlc) {
      add('o', `${s.label} Open`, (i) => num(s.ohlc![i]?.o))
      add('h', `${s.label} High`, (i) => num(s.ohlc![i]?.h))
      add('l', `${s.label} Low`, (i) => num(s.ohlc![i]?.l))
      add('c', `${s.label} Close`, (i) => num(s.ohlc![i]?.c))
      if (s.volumes) add('v', `${s.label} Volume`, (i) => num(s.volumes![i]))
    } else if (s.boxes) {
      add('min', `${s.label} Min`, (i) => num(s.boxes![i]?.min))
      add('q1', `${s.label} Q1`, (i) => num(s.boxes![i]?.q1))
      add('med', `${s.label} Median`, (i) => num(s.boxes![i]?.median))
      add('q3', `${s.label} Q3`, (i) => num(s.boxes![i]?.q3))
      add('max', `${s.label} Max`, (i) => num(s.boxes![i]?.max))
      columns.push(textCol(key('out'), `${s.label} Outliers`))
      fields.push({ field: key('out'), pick: (i) => s.boxes![i]?.outliers?.join(' ') ?? '' })
    } else if (s.errors) {
      add('', s.label, (i) => num(s.values[i]))
      add('lo', `${s.label} Low`, (i) => {
        const v = s.values[i], e = s.errors![i]
        return e == null || !Number.isFinite(v) ? null : typeof e === 'number' ? (v as number) - Math.abs(e) : Math.min(e.lo, e.hi)
      })
      add('hi', `${s.label} High`, (i) => {
        const v = s.values[i], e = s.errors![i]
        return e == null || !Number.isFinite(v) ? null : typeof e === 'number' ? (v as number) + Math.abs(e) : Math.max(e.lo, e.hi)
      })
    } else if (s.lowValues) {
      add('lo', `${s.label} Low`, (i) => num(s.lowValues![i]))
      add('hi', `${s.label} High`, (i) => num(s.values[i]))
    } else if (s.targets) {
      add('', s.label, (i) => num(s.values[i]))
      add('t', `${s.label} Target`, (i) => num(s.targets![i]))
    } else {
      add('', s.label, (i) => num(s.values[i]))
    }
  })
  // A category's group, from the spans.
  const groupOf: string[] = []
  if (groups?.length) for (const g of groups) for (let k = 0; k < g.span; k += 1) groupOf.push(g.label)
  const rows = cats.map((cat, i) => {
    const row: Record<string, unknown> = {}
    if (groups?.length) row.group = groupOf[i] ?? ''
    if (edges && edges.length === cats.length + 1) {
      row.from = num(edges[i])
      row.to = num(edges[i + 1])
    } else row.category = cat
    for (const f of fields) row[f.field] = f.pick(i)
    return row
  })
  return { columns, rows }
}
```
