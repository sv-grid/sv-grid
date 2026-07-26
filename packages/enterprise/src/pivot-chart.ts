/**
 * Pivot -> chart bridge.
 *
 * Turns a computed {@link PivotResult} (the row/column/value matrix the pivot
 * engine produces) into a core {@link ChartSpec} the free `SvGridChart` can
 * render - so one pivot layout drives both a table and a chart (the Excel
 * PivotTable <-> PivotChart pairing).
 *
 * Mapping:
 *   - categories = the row-axis LEAF rows (deepest grouping; subtotals and the
 *     grand-total row are skipped). With no row dims, the single total row.
 *   - series     = the column-axis leaf value columns (one per col-path x
 *     measure). The grand-total column is excluded unless `includeTotals`.
 *   - values     = each leaf row's aggregated cell for that series column.
 */
import type { ChartSpec, ChartType, TableFeatures } from '@svgrid/grid'
import type { PivotResult } from './pivot'

export type PivotChartOptions = {
  /** Chart type. Default `'bar'`. */
  type?: ChartType
  /** Stack the series. Default false. */
  stacked?: boolean
  /** Include the grand-total column / row as a series / category. Default false. */
  includeTotals?: boolean
  /** Cap the number of categories (row leaves) charted. */
  maxCategories?: number
}

type LooseColumn = {
  id?: string
  header?: unknown
  columns?: LooseColumn[]
}

export function pivotToChartSpec<TFeatures extends TableFeatures>(
  result: PivotResult<TFeatures>,
  opts: PivotChartOptions = {},
): ChartSpec {
  const type: ChartType = opts.type ?? 'bar'

  // Category rows: the row-axis leaves. Fall back to the grand-total (single
  // "All") row when no row dims are configured, then to every row.
  let catRows = result.rows.filter((r) => r.__pivotKind === 'leaf')
  if (!catRows.length) catRows = result.rows.filter((r) => r.__pivotKind === 'grandTotal')
  if (!catRows.length) catRows = result.rows.slice()
  if (opts.maxCategories && catRows.length > opts.maxCategories) {
    catRows = catRows.slice(0, opts.maxCategories)
  }
  // Categories are the leaf's OWN label; when rows are nested, emit a parent
  // tier (categoryGroups) so the axis reads "Americas | Canada · USA ..." as a
  // grouped axis rather than colliding on a bare repeated leaf label.
  const byId = new Map(result.rows.map((r) => [r.__pivotId, r]))
  const ownLabel = (r: (typeof result.rows)[number]) => String(r.__pivotLabel ?? '').trim() || '(blank)'
  const categories = catRows.map(ownLabel)

  const parentOf = (r: (typeof result.rows)[number]) =>
    r.__pivotParentId ? byId.get(r.__pivotParentId) : undefined
  const nested = catRows.length > 0 && catRows.every((r) => parentOf(r) !== undefined)
  let categoryGroups: Array<{ label: string; span: number }> | undefined
  if (nested) {
    categoryGroups = []
    let prevId: string | null | undefined
    for (const r of catRows) {
      const pid = r.__pivotParentId
      const last = categoryGroups[categoryGroups.length - 1]
      if (last && pid === prevId) last.span += 1
      else {
        categoryGroups.push({ label: ownLabel(parentOf(r)!), span: 1 })
        prevId = pid
      }
    }
  }

  // Collect the leaf value columns, carrying the accumulated column-group path
  // so a series can be labelled by its column path (e.g. "Q1", "Q1 · Revenue").
  type Leaf = { id: string; path: string[]; header: string }
  const leaves: Leaf[] = []
  const walk = (cols: LooseColumn[] | undefined, path: string[]): void => {
    for (const c of cols ?? []) {
      if (!c || c.id === '__pivotRowHeader') continue
      // Skip the grand-total column group (and its leaves) unless asked for.
      if (!opts.includeTotals && typeof c.id === 'string' && c.id.startsWith('pv_group__grand')) continue
      if (Array.isArray(c.columns)) walk(c.columns, [...path, String(c.header ?? '')])
      else if (typeof c.id === 'string') leaves.push({ id: c.id, path, header: String(c.header ?? '') })
    }
  }
  walk(result.columns as unknown as LooseColumn[], [])

  const filtered = opts.includeTotals ? leaves : leaves.filter((l) => !l.id.includes('__total'))
  const uniqueHeaders = new Set(filtered.map((l) => l.header))
  const series = filtered.map((l) => ({
    label:
      l.path.length === 0
        ? l.header
        : uniqueHeaders.size > 1
          ? [...l.path, l.header].join(' · ')
          : l.path.join(' · '),
    values: catRows.map((r) => {
      const v = r[l.id]
      return typeof v === 'number' ? v : Number(v) || 0
    }),
  }))

  return {
    type,
    categories,
    series,
    ...(categoryGroups && categoryGroups.length > 1 ? { categoryGroups } : {}),
    ...(opts.stacked ? { stacked: true } : {}),
  }
}
