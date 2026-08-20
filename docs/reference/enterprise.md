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

Mutates and returns the same api object. After install, the api has
the new methods listed below.

```svelte
<SvGrid
  data={rows} columns={columns} features={features}
  onApiReady={(next) => (api = installEnterprise(next))}
/>
```

## Export

### `pro.exportData(opts)`

```ts
exportData(opts: ExportOptions<TData>): Promise<void>
```

Writes the current view to a file and triggers a download.

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
  format?: ImportFormat                   // auto-detected from filename/MIME
  source: File | Blob | string            // file picker result, drag-drop, or inline text
  columns?: ImportColumnMap<TData>        // header-row → field map
  types?: ImportColumnTypes<TData>        // per-field type coercion
  validate?: ImportValidator<TData>       // per-row validation
  preview?: boolean                       // return parsed rows + errors; do NOT commit
}

type ImportResult<TData> = {
  rows: ReadonlyArray<TData>
  errors: ReadonlyArray<ImportRowError>
  summary: { read: number; accepted: number; rejected: number }
}
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

You write one adapter; the four helpers below route through it.

### `pro.ai.filter(query, opts?)`

Natural-language to filter + sort plan.

```ts
await pro.ai.filter('show me churned customers from Q3 sorted by ARR', {
  apply: true,   // also call api.setFilter/setSort with the result
})
```

### `pro.ai.smartFill(opts)`

Propose values for empty cells from a few worked examples.

### `pro.ai.summarize(opts)`

One-paragraph + bullets summary of a row, selection, group, or the
whole view.

### `pro.ai.classify(opts)`

Classify free-text cells into one of a known label set.

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

### `pro.pivot.build(config)` / `pro.pivot.buildFrom(data, config)`

Same model, with the live api's `getData()` (or an arbitrary array)
as the source.

### `pivotAggregators`

```ts
type PivotAggregatorId =
  | 'sum' | 'avg' | 'min' | 'max'
  | 'count' | 'countDistinct'
  | 'first' | 'last'
```

A custom aggregator is a plain function: `agg: (values) => something`.

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
