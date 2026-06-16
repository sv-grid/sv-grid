import type { RowData, TableFeatures, SvGridApi } from 'sv-grid-core'
import { assertProLicensed } from './license'
import { installSmartShim } from './smart-shim'
import type { ExportColumn } from './export'

export type PrintOptions<TData> = {
  /** Title placed above the printed grid. Defaults to "Grid". */
  title?: string
  /** Columns to print. If omitted, every key of the first row is printed. */
  columns?: ReadonlyArray<ExportColumn>
  /** Rows to print. If omitted, the api's displayed rows are used. */
  rows?: ReadonlyArray<TData>
  /**
   * Print orientation hint. Browsers honor it via `@page { size: ... }`.
   * Defaults to "portrait".
   */
  orientation?: 'portrait' | 'landscape'
}

type DataExporterCtor = new (
  options: Record<string, unknown>,
) => {
  exportData(
    data: ReadonlyArray<Record<string, unknown>>,
    format: string,
    filename?: string,
  ): unknown
}

let exporterCtorPromise: Promise<DataExporterCtor> | null = null

async function getDataExporter(): Promise<DataExporterCtor> {
  if (typeof window === 'undefined') {
    throw new Error('sv-grid-pro: print requires a browser environment')
  }
  if (!exporterCtorPromise) {
    exporterCtorPromise = (async () => {
      installSmartShim()
      await import('./smart.export.js')
      const Ctor = window.Smart?.Utilities?.DataExporter as DataExporterCtor | undefined
      if (!Ctor) {
        throw new Error('sv-grid-pro: failed to load Smart.Utilities.DataExporter')
      }
      return Ctor
    })()
  }
  return exporterCtorPromise
}

export async function printGrid<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(api: SvGridApi<TFeatures, TData>, opts?: PrintOptions<TData>): Promise<void> {
  assertProLicensed('Print')
  const sourceRows: ReadonlyArray<TData> = opts?.rows ?? api.getDisplayedRows()
  let cols: ReadonlyArray<ExportColumn>
  if (opts?.columns && opts.columns.length > 0) {
    cols = opts.columns
  } else if (sourceRows.length > 0) {
    cols = Object.keys(sourceRows[0] as Record<string, unknown>)
      .filter((k) => !k.startsWith('_'))
      .map((field) => ({ field }))
  } else {
    cols = []
  }
  if (sourceRows.length === 0) {
    throw new Error('sv-grid-pro: nothing to print - the grid has no rows')
  }
  const header: Record<string, unknown> = {}
  for (const c of cols) header[c.field] = c.header ?? c.field
  const projected: Array<Record<string, unknown>> = [header]
  for (const r of sourceRows) {
    const out: Record<string, unknown> = {}
    const src = r as unknown as Record<string, unknown>
    for (const c of cols) out[c.field] = src[c.field]
    projected.push(out)
  }

  const Ctor = await getDataExporter()
  const exporter = new Ctor({ exportHeader: true })
  // No filename means exportData returns the HTML string instead of triggering
  // a download (see downloadFile in smart.export.js: when filename is falsy it
  // returns the raw content unchanged).
  const html = exporter.exportData(projected, 'html') as string

  const title = (opts?.title ?? 'Grid').replace(/[<>]/g, '')
  const orientation = opts?.orientation ?? 'portrait'
  const wrapped = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: ${orientation}; margin: 14mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; }
  h1 { font-size: 16pt; margin: 0 0 8mm 0; }
  table { border-collapse: collapse; width: 100%; font-size: 9pt; }
  th, td { border: 1px solid #444; padding: 4px 6px; text-align: left; }
  thead { background: #eee; }
</style></head>
<body>
  <h1>${title}</h1>
  ${html.replace(/^[\s\S]*?<body>/i, '').replace(/<\/body>[\s\S]*$/i, '')}
</body></html>`

  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) {
    throw new Error(
      'sv-grid-pro: print() could not open a window - the browser blocked the popup',
    )
  }
  w.document.open()
  w.document.write(wrapped)
  w.document.close()
  // Give the new window one tick to paint before invoking print.
  w.focus()
  w.addEventListener('load', () => {
    setTimeout(() => w.print(), 50)
  })
  // Some browsers fire 'load' before the listener attaches if document was
  // already complete. Fall back: try a print after a short delay regardless.
  setTimeout(() => {
    try {
      w.print()
    } catch {
      // ignore - listener path will have fired
    }
  }, 300)
}
