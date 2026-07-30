import type { RowData, TableFeatures, SvGridApi } from '@svgrid/grid'
import {
  exportGrid,
  copyExportToClipboard,
  type ExportOptions,
  type ExportResult,
  type ClipboardExportOptions,
} from './export'
import { printGrid, type PrintOptions } from './print'
import { importData, type ImportOptions, type ImportResult } from './import'
import { isLicenseKeySet } from './license'
import { emitUnlicensedNudge } from './watermark'
import {
  aiFilter, aiSmartFill, aiSummarize, aiClassify, aiExport, aiFindAnomalies,
  aiChart, enableAiCharting,
  type AIChartOptions, type AIChartPlan,
  type AIFilterOptions, type AIFilterResult,
  type AISmartFillOptions, type AISmartFillResult,
  type AISummarizeOptions, type AISummary,
  type AIClassifyOptions, type AIClassifyResult,
  type AIExportOptions, type AIExportPlan,
  type AIAnomalyOptions, type AIAnomalyResult,
} from './ai'
import {
  createPivotModel,
  type PivotConfig,
  type PivotResult,
} from './pivot'
import { enableSchedulerView } from './scheduler'

export type EnterpriseAIApi<TData extends RowData> = {
  /** Natural-language -> filter + sort plan (and optionally apply it). */
  filter(query: string, opts?: AIFilterOptions): Promise<AIFilterResult>
  /** Propose values for empty cells based on a few worked examples. */
  smartFill<TValue = unknown>(opts: AISmartFillOptions): Promise<AISmartFillResult<TValue>>
  /** One-paragraph + bullets summary of a row, selection, group, or the whole view. */
  summarize(opts: AISummarizeOptions): Promise<AISummary>
  /** Classify free-text cells into one of a known set of labels. */
  classify(opts: AIClassifyOptions): Promise<AIClassifyResult>
  /** Natural-language export: "export EU orders from Q2 as a grouped PDF". */
  export(query: string, opts?: AIExportOptions): Promise<AIExportPlan>
  /** Scan a slice for anomalies / outliers, returning a structured list. */
  findAnomalies(opts?: AIAnomalyOptions): Promise<AIAnomalyResult>
  /** Natural-language chart: "revenue by region, stacked by product". */
  chart(query: string, opts?: AIChartOptions): Promise<AIChartPlan>
  // TData is referenced so the type stays bound to the row shape even
  // though the helpers all read through `api.getData()`. Lets callers
  // get correct inference downstream without explicit generics.
  readonly _rowType?: TData
}

export type EnterprisePivotApi<
  TFeatures extends TableFeatures,
  TData extends RowData,
> = {
  /**
   * Build a pivot row/column model from the grid's current data. Returns
   * `{ rows, columns }` you can feed to a separate `<SvGrid>` instance
   * (the typical pattern - the source grid stays unmodified). Pure: no
   * mutation, no DOM access.
   */
  build(config: PivotConfig<TData>): PivotResult<TFeatures>
  /**
   * Build a pivot from an arbitrary array (not necessarily the grid's
   * data). Useful for previewing a designer's config against a sample
   * before committing.
   */
  buildFrom<TIn extends RowData>(
    data: ReadonlyArray<TIn>,
    config: PivotConfig<TIn>,
  ): PivotResult<TFeatures>
}

export type EnterpriseGridApi<
  TFeatures extends TableFeatures,
  TData extends RowData,
> = SvGridApi<TFeatures, TData> & {
  /** Export the current visible rows to the chosen format. Returns the built
   *  file ({@link ExportResult}) for the dependency-free paths (undefined for
   *  the vendored-writer xlsx paths, which download directly). */
  exportData(opts: ExportOptions<TData>): Promise<ExportResult | undefined>
  /** Copy the grid (view / selection / all) to the clipboard in a native text
   *  format (default `tsv`, pastes into Excel / Sheets as columns). */
  copyExport(opts?: ClipboardExportOptions<TData>): Promise<void>
  /** Open a printable view of the current visible rows in a new window. */
  print(opts?: PrintOptions<TData>): Promise<void>
  /** Read an Excel / CSV / TSV / JSON file (or inline text) into typed
   *  rows. Caller decides whether to commit into the grid or preview
   *  the parsed result first via the returned `ImportResult`. */
  importData(opts: ImportOptions<TData>): Promise<ImportResult<TData>>
  /** AI helpers (Pro). All calls route through a consumer-registered
   *  AIProvider via setAIProvider(); no model client is bundled. */
  ai: EnterpriseAIApi<TData>
  /** Pivot table builder (Pro). Pure - returns `{ rows, columns }` you
   *  hand to a separate `<SvGrid>` instance. */
  pivot: EnterprisePivotApi<TFeatures, TData>
}

/**
 * Augment a SvGridApi instance with Pro methods (`exportData`, `print`,
 * `ai.*`). Mutates and returns the same object so existing references
 * keep working.
 *
 * If no license key has been set, the Pro methods still function but the
 * grid shows a small "unlicensed" watermark linking to jqwidgets.com and
 * the console emits a one-time nudge. Revoked or malformed keys throw on
 * first call.
 */
export function installEnterprise<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(api: SvGridApi<TFeatures, TData>): EnterpriseGridApi<TFeatures, TData> {
  const pro = api as EnterpriseGridApi<TFeatures, TData>
  pro.exportData = (opts) => exportGrid(pro, opts)
  pro.copyExport = (opts) => copyExportToClipboard(pro, opts)
  pro.print = (opts) => printGrid(pro, opts)
  pro.importData = (opts) => importData(pro, opts)
  pro.ai = {
    filter: (query, opts) => aiFilter(pro, query, opts),
    smartFill: (opts) => aiSmartFill(pro, opts),
    summarize: (opts) => aiSummarize(pro, opts),
    classify: (opts) => aiClassify(pro, opts),
    export: (query, opts) => aiExport(pro, query, opts),
    findAnomalies: (opts) => aiFindAnomalies(pro, opts),
    chart: (query, opts) => aiChart(pro, query, opts),
  }
  // Wire the built-in chart panel's AI button (no-op without the `charting` prop).
  enableAiCharting(pro)
  // Register the scheduler / calendar view (no-op without the `scheduler` prop).
  enableSchedulerView()
  pro.pivot = {
    build: (config) =>
      createPivotModel<TFeatures, TData>(pro.getData(), config),
    buildFrom: <TIn extends RowData>(data: ReadonlyArray<TIn>, config: PivotConfig<TIn>) =>
      // PivotConfig is variance-strict in TIn; the runtime call only needs
      // the row shape to match config.rows / config.cols field names, which
      // the caller-side generic enforces.
      createPivotModel<TFeatures, TIn>(data, config),
  }
  // Surface the soft-gate state at install time so the watermark appears
  // alongside the grid, not just after the user clicks Export.
  if (!isLicenseKeySet()) emitUnlicensedNudge()
  return pro
}
