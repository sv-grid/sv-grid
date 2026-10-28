import type { RowData, TableFeatures, SvGridApi } from '@svgrid/grid'
import { assertEnterpriseLicensed } from './license'
import {
  buildLinkResolver,
  projectRows,
  resolveColumns,
  resolveRowSource,
  type ExportColumn,
  type ExportRowSource,
} from './export'
import { buildPrintDocument, type PrintDocOptions, type PrintGroupRow } from './export-print'
import { buildConditionalResolver } from './export-conditional'
import type { ConditionalFormat } from '@svgrid/grid/format'

export type PrintOptions<TData> = {
  /** Title placed above the printed grid. Defaults to "Grid". */
  title?: string
  /** Smaller line under the title. */
  subtitle?: string
  /** Logo data URL, shown above the title. */
  logo?: string
  /** Columns to print. Defaults to the grid's own visible columns (with their
   *  header labels + `format`, so values print formatted). */
  columns?: ReadonlyArray<ExportColumn<TData>>
  /** Rows to print. Defaults to the current view; accepts the same
   *  `'displayed' | 'selected' | 'all'` shorthand as `exportData`. */
  rows?: ExportRowSource<TData>
  /** Write raw underlying values instead of the formatted display values. */
  rawValues?: boolean
  /** Print orientation. Browsers honor it via `@page { size }`. Default "portrait". */
  orientation?: 'portrait' | 'landscape'
  /** `@page` size keyword, e.g. 'A4' | 'Letter'. Combined with orientation. */
  pageSize?: string
  /** Page margin, e.g. '14mm'. Default '14mm'. */
  margin?: string
  /** Zebra-stripe rows. Default true. */
  zebra?: boolean
  /** Header row background color. */
  headerColor?: string
  /** Conditional formatting rules (same array as `<SvGrid conditionalFormats>`);
   *  carried into the print view as cell background / color / bold + icons. */
  conditionalFormats?: ReadonlyArray<ConditionalFormat<TData>>
  /** Open the print window and its dialog. Default true. `false` only builds
   *  the document and returns it, for a preview pane or a test. */
  open?: boolean
  /** A header row above each group when the grid is grouped, "Column: value
   *  (rows)", indented by level. Default true. */
  groupRows?: boolean
}

/**
 * The group header rows for a grouped grid: where each group starts among the
 * printed rows, in their order, at every grouping level. A group's value is
 * the printed (formatted) text when its column is printed, else the raw value.
 */
function printGroups<TFeatures extends TableFeatures, TData extends RowData>(
  api: SvGridApi<TFeatures, TData>,
  cols: ReadonlyArray<ExportColumn<TData>>,
  sourceRows: ReadonlyArray<TData>,
  projected: ReadonlyArray<Record<string, unknown>>,
): PrintGroupRow[] | undefined {
  const grouping = (api.getState().grouping ?? []) as string[]
  if (!grouping.length) return undefined
  const gridCols = api.getColumns()
  const levels = grouping.map((id) => {
    const printed = cols.find((c) => c.field === id)
    const gridCol = gridCols.find((c) => c.id === id)
    const field = printed?.field ?? gridCol?.field ?? id
    return {
      header: printed?.header ?? gridCol?.header ?? id,
      value: (i: number) =>
        String((printed ? projected[i + 1]![field] : (sourceRows[i] as Record<string, unknown>)[field]) ?? ''),
    }
  })
  const groups: Array<PrintGroupRow & { value: string }> = []
  const open: Array<PrintGroupRow & { value: string }> = []
  for (let i = 0; i < sourceRows.length; i++) {
    let changed = false
    levels.forEach((level, depth) => {
      const value = level.value(i)
      if (!changed && open[depth]?.value === value) return
      changed = true
      const g = { before: i, label: '', depth, value }
      open[depth] = g
      groups.push(g)
    })
  }
  // "(rows)": the rows up to the next group at the same level or above.
  return groups.map((g, k) => {
    let end = sourceRows.length
    for (let j = k + 1; j < groups.length; j++) if (groups[j]!.depth <= g.depth) { end = groups[j]!.before; break }
    return { before: g.before, depth: g.depth, label: `${levels[g.depth]!.header}: ${g.value} (${end - g.before})` }
  })
}

/** Print the grid: builds a printable HTML document of its rows, opens it in a
 *  new window and calls the browser's print dialog. Resolves to that document,
 *  so `{ open: false }` gives a printable view without a window or a dialog. */
export async function printGrid<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(api: SvGridApi<TFeatures, TData>, opts?: PrintOptions<TData>): Promise<string> {
  assertEnterpriseLicensed('Print')
  if (typeof window === 'undefined') {
    throw new Error('@svgrid/enterprise: print requires a browser environment')
  }
  const sourceRows = resolveRowSource(api, opts?.rows)
  if (sourceRows.length === 0) {
    throw new Error('@svgrid/enterprise: nothing to print - the grid has no rows')
  }
  const cols = resolveColumns(api, { columns: opts?.columns }, sourceRows)
  const fields = cols.map((c) => c.field)
  // Formatted display values (or raw when asked) so the print matches the grid.
  const projected = await projectRows(sourceRows, cols, { rawValues: opts?.rawValues })
  const dataRows = projected.slice(1).map((r) => fields.map((f) => String(r[f] ?? '')))
  const columns = cols.map((c) => ({ header: c.header ?? c.field, align: c.align }))

  const docOpts: PrintDocOptions = {
    title: opts?.title ?? 'Grid',
    subtitle: opts?.subtitle,
    logo: opts?.logo,
    orientation: opts?.orientation ?? 'portrait',
    pageSize: opts?.pageSize,
    margin: opts?.margin,
    zebra: opts?.zebra,
    headerColor: opts?.headerColor,
  }
  const visual = buildConditionalResolver(cols, sourceRows, opts?.conditionalFormats)
  const link = buildLinkResolver(cols, sourceRows)
  const html = buildPrintDocument({
    columns,
    rows: dataRows,
    cellStyle: (r, c) => visual(r, c),
    cellLink: link,
    groups: opts?.groupRows === false ? undefined : printGroups(api, cols, sourceRows, projected),
    opts: docOpts,
  })
  if (opts?.open === false) return html

  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) {
    throw new Error(
      '@svgrid/enterprise: print() could not open a window - the browser blocked the popup',
    )
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
  // Give the new window one tick to paint before invoking print.
  w.focus()
  w.addEventListener('load', () => {
    setTimeout(() => w.print(), 50)
  })
  // Some browsers fire 'load' before the listener attaches if the document was
  // already complete. Fall back: try a print after a short delay regardless.
  setTimeout(() => {
    try {
      w.print()
    } catch {
      // ignore - the listener path will have fired
    }
  }, 300)
  return html
}
