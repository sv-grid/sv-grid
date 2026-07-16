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
import { buildPrintDocument, type PrintDocOptions } from './export-print'
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
}

export async function printGrid<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(api: SvGridApi<TFeatures, TData>, opts?: PrintOptions<TData>): Promise<void> {
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
    opts: docOpts,
  })

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
}
