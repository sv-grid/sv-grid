# Enterprise reference

Everything that `@svgrid/enterprise` adds on top of the Community surface.
Install + license: see [Enterprise feature pack](../enterprise/README.md).

```ts
import {
  installEnterprise, setLicenseKey,
  exportGrid, printGrid, importData,
  createPivotModel, pivotAggregators,
  type EnterpriseGridApi, type ExportOptions, type ImportOptions, type PivotConfig,
} from '@svgrid/enterprise'

// The AI helpers are free and live in the community package. Enterprise only
// registers its export engine so an AI-planned Excel / PDF export can run.
import { setAIProvider, aiFilter, aiSmartFill, aiSummarize, aiClassify } from '@svgrid/grid'
```

## License

### `setLicenseKey(key)` / `clearLicenseKey()` / `isLicenseKeySet()`

```ts
setLicenseKey('SVENTERPRISE-XXXX-XXXX-XXXX')
```

Call once at app startup. Without a key the Enterprise methods still work
but the grid shows an "unlicensed" watermark + a one-time console
nudge.

### `dismissUnlicensedNudge()`

Hide the console nudge for the rest of the session (useful in tests).

## Augmenting the API

### `installEnterprise(api)`

```ts
function installEnterprise<TFeatures, TData>(
  api: SvGridApi<TFeatures, TData>,
): EnterpriseGridApi<TFeatures, TData>
```

Mutates and returns the same api object, so references captured before the
install see the new methods too. After install the api carries `exportData`,
`copyExport`, `print`, `importData`, the `ai.*` namespace and the `pivot.*`
namespace - and the install also **registers the Kanban board and scheduler
renderers**, the advanced-filter engine, the selection bar and the pivot view,
which is what makes the community `board` / `scheduler` / `pivot` props render
instead of showing an upgrade placeholder.

```svelte
<!-- 1. The usual shape: install in onApiReady and keep the result. -->
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'
  import { installEnterprise, setLicenseKey, type EnterpriseGridApi } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-XXXX-XXXX-XXXX')
  let api = $state<EnterpriseGridApi<typeof features, Order> | null>(null)
</script>

<SvGrid
  data={rows}
  columns={columns}
  features={features}
  onApiReady={(next) => (api = installEnterprise(next))}
/>
<button onclick={() => api?.exportData({ format: 'xlsx' })}>Export</button>
```

```ts
// 2. Install once, use the community api afterwards: it is the same object.
function onApiReady(next: SvGridApi<typeof features, Order>) {
  installEnterprise(next)
  api = next                      // `next.exportData` exists from here on
}

// 3. Skip the install entirely and call the helpers with the api - no
//    enterprise members are added, and nothing is registered.
import { exportGrid, printGrid } from '@svgrid/enterprise'
await exportGrid(api, { format: 'xlsx' })
await printGrid(api)
```

## Export

### `pro.exportData(opts)`

```ts
exportData(opts: ExportOptions<TData>): Promise<ExportResult | undefined>
```

Writes the current view to a file and triggers a download. Formats:
`'xlsx' | 'xls' | 'pdf' | 'csv' | 'tsv' | 'html' | 'json' | 'xml' | 'md'`.
Resolves with the built file - `{ blob, filename, mime, rowCount, byteSize }` -
for every dependency-free path, which is what lets you upload or hash the bytes
instead of downloading them. An empty row scope throws rather than writing a
header-only file.

```ts
// 1. The current view, as a spreadsheet.
await pro.exportData({ format: 'xlsx', filename: 'orders' })

// 2. The checked rows only, as raw values rather than display text - what a
//    downstream pipeline wants.
await pro.exportData({ format: 'csv', rows: 'selected', rawValues: true })

// 3. Take the bytes instead of a download: upload them, or assert on them.
const file = await pro.exportData({ format: 'csv', filename: 'snapshot' })
await fetch('/api/snapshots', { method: 'POST', body: file!.blob })
console.log(file!.rowCount, file!.byteSize)
```

```ts
type ExportOptions<TData> = {
  format: 'xlsx' | 'pdf' | 'csv' | 'tsv' | 'html'
  filename?: string                        // base name; extension auto-appended
  columns?: ReadonlyArray<ExportColumn>    // defaults to every key on the first row
  rows?: ReadonlyArray<TData>              // defaults to api.getDisplayedRows()
  pageOrientation?: 'portrait' | 'landscape'  // pdf only

  // Style + branding
  styles?: ExportStyles
  header?: ReadonlyArray<ExportHeaderFooterLine>
  footer?: ReadonlyArray<ExportHeaderFooterLine>

  // Embedded images
  imageFields?: ReadonlyArray<string>

  // Multi-sheet workbook (xlsx only)
  sheets?: ReadonlyArray<ExportSheet<TData>>
}
```

See [Data export](../help/export.md) for the option-by-option
walk-through and the demo links.

### `pro.print(opts?)`

```ts
print(opts?: PrintOptions<TData>): Promise<void>
```

Opens a printable view in a new window with repeat-on-page headers,
optional cover page, configurable page-size + orientation, and a
print-CSS theme.

```ts
// 1. Print what is on screen.
await pro.print()

// 2. Titled, landscape, A4.
await pro.print({
  title: 'Q2 orders',
  subtitle: 'EMEA region',
  orientation: 'landscape',
  pageSize: 'A4',
})

// 3. Print the selection, with a logo above the title.
await pro.print({ rows: 'selected', logo: logoDataUrl })
```

### `pro.copyExport(opts?)`

```ts
copyExport(opts?: ClipboardExportOptions<TData>): Promise<void>
```

Copies the grid to the system clipboard in a native text format. No BOM is
written, so the payload pastes into Excel / Sheets as columns rather than with a
stray character in the first cell.

```ts
// 1. Default: the current view as tsv.
await pro.copyExport()

// 2. The selection, as csv.
await pro.copyExport({ format: 'csv', rows: 'selected' })

// 3. Markdown, for pasting into an issue or a PR.
await pro.copyExport({ format: 'markdown' })
```

### Static helpers

If you don't want to install Enterprise onto the api, use the module-level
helpers directly:

```ts
import { exportGrid, printGrid } from '@svgrid/enterprise'
await exportGrid(api, { format: 'xlsx' })
await printGrid(api)
```

## Import

### `pro.importData(opts)`

```ts
importData(opts: ImportOptions<TData>): Promise<ImportResult<TData>>

type ImportOptions<TData> = {
  file: File | Blob | string          // a picked file, a drop, or inline text
  format?: ImportFormat               // 'auto' by default: extension, else sniffed
  columnMap?: ImportColumnMap         // source header -> target field; null drops one
  columnTypes?: ImportColumnTypes     // per-field strict coercion
  autoMap?: boolean                   // fuzzy-match headers against the grid columns
  validator?: ImportValidator<TData>  // per-row validation; errors land in the result
  commit?: boolean                    // false (default) = preview, true = add to the grid
  commitAt?: 'top' | 'bottom' | number
}

type ImportResult<TData> = {
  headers: string[]                   // source headers, in file order
  rows: TData[]                       // parsed + mapped
  errors: ImportRowError[]            // empty when the file was clean
  skipped: number                     // entirely blank source rows
  total: number                       // source rows the parser saw
  format: Exclude<ImportFormat, 'auto'>
}
```

Preview first by default - nothing reaches the grid until you say so.

```ts
// 1. Preview: parse, then show the user what would be added.
const result = await pro.importData({ file: picked })
console.log(result.total, result.rows.length, result.errors)

// 2. Line the file up with the grid's own columns and commit it.
await pro.importData({ file: picked, autoMap: true, commit: true, commitAt: 'top' })

// 3. Strict types plus a validator, for a file you do not trust.
const checked = await pro.importData({
  file: pastedCsv,
  columnMap: { 'Order ID': 'id', Customer: 'customer', Total: 'total' },
  columnTypes: { total: 'number' },
  validator: (row) => (row.total > 0 ? [] : [{ field: 'total', message: 'must be positive' }]),
})
if (checked.errors.length === 0) pro.addRows(checked.rows)
```

See [Data import](../help/import.md).

## AI

### `setAIProvider(provider)`

```ts
type AIProvider = (req: AIRequest) => Promise<unknown>

setAIProvider(async (req) => {
  // call your model - OpenAI, Anthropic, Ollama, local. ANY provider.
  return { /* shape depends on req.task */ }
})
```

You write one adapter; the seven helpers below route through it. All of them are
free in `@svgrid/grid` - `installEnterprise` only groups them under `pro.ai` and
registers the export engine `ai.export` writes through.

### `pro.ai.filter(query, opts?)`

Natural language to a filter + sort plan.

```ts
// 1. Plan only: show the user what it would do.
const plan = await pro.ai.filter('churned customers from Q3 sorted by ARR')

// 2. Plan and apply it to the grid in one call.
await pro.ai.filter('orders over 10k in EMEA', { apply: true })

// 3. Cancel a slow request.
const controller = new AbortController()
const pending = pro.ai.filter('...', { signal: controller.signal })
controller.abort()
```

### `pro.ai.summarize(opts)`

Prose, bullets and the fields the model leaned on, for a slice of the grid.

```ts
// 1. The whole dataset.
await pro.ai.summarize({ target: { kind: 'all' } })

// 2. One row, e.g. behind a "explain this record" button.
await pro.ai.summarize({ target: { kind: 'row', rowIndex: 4 } })

// 3. A group, with the question the user is actually asking.
await pro.ai.summarize({
  target: { kind: 'group', field: 'region', value: 'EMEA' },
  question: 'why is margin down?',
})
```

### `pro.ai.smartFill(opts)`

Propose values for a column from worked examples. `field` and at least one
example are required.

```ts
// 1. Fill the blanks in one column. An example is `{ input, output }`: the row
//    fields the model should look at, and the value you would have typed.
await pro.ai.smartFill({
  field: 'category',
  examples: [{ input: { product: 'Widget' }, output: 'hardware' }],
})

// 2. Restrict it to specific rows.
await pro.ai.smartFill({
  field: 'category',
  targetRowIndices: [3, 4, 5],
  examples: [
    { input: { product: 'Widget' }, output: 'hardware' },
    { input: { product: 'Licence' }, output: 'software' },
  ],
})

// 3. Commit the predictions yourself - the helper never writes.
const { predictions } = await pro.ai.smartFill({ field: 'category', examples })
for (const p of predictions) if (p.confidence > 0.8) pro.setCellValue(p.rowIndex, 'category', p.value)
```

### `pro.ai.classify(opts)`

Classify free text into one of a known label set: read `inputField`, write
`outputField`, choose from `classes`.

```ts
// 1. The minimum.
await pro.ai.classify({ inputField: 'feedback', outputField: 'sentiment', classes: ['good', 'bad'] })

// 2. With a rubric, which is what makes the labels stable.
await pro.ai.classify({
  inputField: 'feedback',
  outputField: 'sentiment',
  classes: ['promoter', 'passive', 'detractor'],
  classDescriptions: { promoter: 'would recommend', detractor: 'would warn others' },
})

// 3. Only the rows the user selected.
await pro.ai.classify({
  inputField: 'feedback',
  outputField: 'sentiment',
  classes: ['good', 'bad'],
  targetRowIndices: pro.getSelectedRows().map((_, i) => i),
})
```

### `pro.ai.findAnomalies(opts?)`, `pro.ai.chart(query, opts?)`, `pro.ai.export(query, opts?)`

```ts
// 1. Outliers in the current dataset, as a structured list.
const { anomalies } = await pro.ai.findAnomalies({ target: { kind: 'all' } })

// 2. "Chart this" - returns a plan the built-in chart panel can apply.
const plan = await pro.ai.chart('revenue by region, stacked by product')

// 3. Natural-language export - the plan names the format, and the enterprise
//    engine registered by installEnterprise writes the file.
await pro.ai.export('export EU orders from Q2 as a grouped PDF')
```

Full options + return shapes: [AI assistant](../help/ai.md).

## Pivot

### `createPivotModel(data, config)`

```ts
function createPivotModel<TFeatures, TData>(
  data: ReadonlyArray<TData>,
  config: PivotConfig<TData>,
): PivotResult<TFeatures>

type PivotResult<TFeatures> = {
  rows: PivotRow[]
  columns: Array<ColumnDef<TFeatures, PivotRow>>
}
```

Pure - no DOM, no api required. Hand the result to a regular
`<SvGrid>` instance.

```ts
// 1. One row dimension, one column dimension, one measure.
const model = createPivotModel(orders, {
  rows: ['region'],
  cols: ['product'],
  values: [{ field: 'amount', agg: 'sum' }],
})

// 2. Nested rows, two measures, no grand total.
const detail = createPivotModel(orders, {
  rows: ['region', 'rep'],
  cols: ['quarter'],
  values: [
    { field: 'amount', agg: 'sum' },
    { field: 'amount', agg: 'count' },
  ],
  grandTotalRow: false,
})

// 3. Render it: the result IS a grid's data + columns.
```

```svelte
<SvGrid data={model.rows} columns={model.columns} features={features} />
```

### `pro.pivot.build(config)` / `pro.pivot.buildFrom(data, config)`

Same model, with the live api's `getData()` (or an arbitrary array) as the
source. Both are pure: the source grid is untouched, which is why the usual
pattern is a second `<SvGrid>` fed from the result.

```ts
// 1. Pivot what the grid currently holds, including edits and added rows.
const model = pro.pivot.build({
  rows: ['region'],
  cols: ['product'],
  values: [{ field: 'amount', agg: 'sum' }],
})

// 2. Preview a designer's config against a sample before committing to it.
const preview = pro.pivot.buildFrom(sampleRows, draftConfig)

// 3. Re-build after the data changes - there is no subscription.
pro.addRow(newOrder)
const fresh = pro.pivot.build(config)
```

### `pivotAggregators`

```ts
type PivotAggregatorId =
  | 'sum' | 'avg' | 'min' | 'max'
  | 'count' | 'countDistinct'
  | 'first' | 'last'
```

```ts
// 1. Name one of the built-ins.
values: [{ field: 'amount', agg: 'avg' }]

// 2. A custom reducer - a plain function over the bucket's values.
values: [{ field: 'amount', agg: (vs) => vs.filter((v) => Number(v) > 1000).length }]

// 3. Call one directly, e.g. in a footer of your own.
import { pivotAggregators } from '@svgrid/enterprise'
const total = pivotAggregators.sum(rows.map((r) => r.amount))
```

Two behaviours worth knowing: `Number(null)` is 0, so a null cell counts as zero
in `sum` / `min` / `max` (a non-numeric value is skipped instead), and every
reducer walks the bucket in one pass, so a measure over a very large pivot cell
aggregates rather than overflowing the call stack.

Full reference: [Pivot tables](../help/pivot.md).

## Subpath imports

The package ships per-feature subpaths so you can tree-shake:

```ts
import { exportGrid }      from '@svgrid/enterprise/export'
import { importData }      from '@svgrid/enterprise/import'
import { aiFilter }        from '@svgrid/grid'
import { createPivotModel } from '@svgrid/enterprise/pivot'
```

If you only need export, the AI plumbing, pivot engine, and import
parser don't ship in your bundle.

## Types

```ts
import type {
  EnterpriseGridApi,            // SvGridApi + Enterprise methods
  EnterpriseAIApi,              // .ai namespace shape
  EnterprisePivotApi,           // .pivot namespace shape

  ExportFormat,
  ExportOptions,
  ExportColumn,
  ExportCellStyle,
  ExportStyles,
  ExportHeaderFooterLine,
  ExportSheet,

  ImportFormat,
  ImportOptions,
  ImportResult,
  ImportColumnMap,
  ImportColumnTypes,
  ImportRowError,
  ImportValidator,
  ImportFieldType,

  PivotAggregator,
  PivotAggregatorId,
  PivotConfig,
  PivotResult,
  PivotRow,
  PivotRowKind,
  PivotValueConfig,
} from '@svgrid/enterprise'

// AI types come from the community package alongside the helpers themselves.
import type {
  AIProvider,
  AIRequest,
  AITask,
  AIFilterOptions,
  AIFilterResult,
  AIFilterClause,
  AISortClause,
  AISmartFillOptions,
  AISmartFillResult,
  AISmartFillExample,
  AISummarizeOptions,
  AISummarizeTarget,
  AISummary,
  AIClassifyOptions,
  AIClassifyResult,
} from '@svgrid/grid'
```
