/**
 * export-provider seam. The free grid ships built-in text export (CSV / TSV /
 * JSON via the api) but the rich Excel / PDF / HTML export engine lives in
 * `@svgrid/enterprise`. `aiExport` (a free, built-in AI feature) plans an export
 * and, when it needs to actually WRITE an enterprise format, delegates to the
 * engine registered here. Enterprise registers `exportGrid` at install time; if
 * it is absent, `aiExport` returns the plan without running the download.
 *
 * ```ts
 * // in @svgrid/enterprise, at install:
 * import { registerExportProvider } from '@svgrid/grid'
 * import { exportGrid } from './export'
 * registerExportProvider(exportGrid)
 * ```
 */
import type { SvGridApi } from './index'

export type GridExportRunOptions = {
  format: string
  filename?: string
  rows?: ReadonlyArray<Record<string, unknown>>
  groupBy?: string[]
}

export type GridExportProvider = (
  api: SvGridApi<any, any>,
  opts: GridExportRunOptions,
) => Promise<unknown>

let provider: GridExportProvider | null = null

/** Register the export engine that runs AI-planned exports. Enterprise calls this. */
export function registerExportProvider(fn: GridExportProvider | null): void {
  provider = fn
}

/** The registered export engine, or null when @svgrid/enterprise is not installed. */
export function getExportProvider(): GridExportProvider | null {
  return provider
}
