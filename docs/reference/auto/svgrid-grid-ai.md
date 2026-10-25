# `@svgrid/grid` · `ai.ts`

Auto-generated. Source: `packages\grid\src\ai.ts`.

### `type AIProvider`

Shape every consumer-provided model adapter must implement. Keeping this
tiny (one async call, two response formats) lets the same adapter drive
OpenAI's `chat.completions`, Anthropic's `messages`, a self-hosted
llama.cpp endpoint, or a server-side proxy. The grid only cares that the
provider eventually returns a string we can parse.

```ts
export type AIProvider = (request: AIRequest) => Promise<string>
```

### `type AIRequest`

One call out to the model, as the grid builds it. Providers receive this.

```ts
export type AIRequest = {
  /** Full prompt the grid built for the model. Already includes column
   *  schema and any sampled rows where applicable. */
  prompt: string
  /** When 'json', the provider should ask the model to return strict
   *  JSON only - no prose. We parse the response with JSON.parse and
   *  throw a typed error on failure. */
  responseFormat?: 'text' | 'json'
  /** Honored if the underlying transport supports cancellation. */
  signal?: AbortSignal
  /** Free-form tag for telemetry / logging. One of: 'filter',
   *  'smart-fill', 'summarize', 'classify'. */
  task: AITask
  /** Soft hint to the provider about how many tokens we expect back.
   *  Useful for routing small jobs to a cheaper model. */
  maxOutputTokens?: number
}
```

### `type AITask`

Which helper produced a request - carried on {@link AIRequest} for routing and telemetry.

```ts
export type AITask = 'filter' | 'smart-fill' | 'summarize' | 'classify' | 'export' | 'anomaly' | 'chart' | 'explain-chart'
```

### `function setAIProvider`

Register the model adapter every AI call will route through. Call once
at app boot. Passing `null` clears the provider and AI calls revert to
throwing "no provider" errors.

```ts
export function setAIProvider(p: AIProvider | null): void
```

### `function getAIProvider`

The provider registered with `setAIProvider`, or null when none is.

```ts
export function getAIProvider(): AIProvider | null
```

### `function hasAIProvider`

Whether an AI provider is registered. Gate AI affordances on this so the UI stays honest.

```ts
export function hasAIProvider(): boolean
```

### `type AIRowSource`

What the read-only helpers need from a grid: its rows. A full `SvGridApi`
satisfies it, and so does `{ getData: () => rows }`, which lets a chat or a
report summarize data that is not on screen in a grid. `aiFilter` with
`apply: true` and `aiExport` still need the grid itself.

```ts
export type AIRowSource<
  TFeatures extends TableFeatures = TableFeatures,
  TData extends RowData = RowData,
> = Pick<SvGridApi<TFeatures, TData>, 'getData'>
```

### `type AIFilterClause`

One condition in a filter plan: a column, a comparison, and the value to match.

```ts
export type AIFilterClause = {
  field: string
  operator: 'contains' | 'equals' | 'startsWith' | 'greaterThan' | 'lessThan' | 'isBlank'
  value?: string
}
```

### `type AISortClause`

One ordering clause in a filter plan.

```ts
export type AISortClause = { field: string; desc: boolean }
```

### `type AIFilterResult`

A natural-language query turned into filters and sorting, plus the model's reasoning.

```ts
export type AIFilterResult = {
  filters: AIFilterClause[]
  sort: AISortClause[]
  /** Plain-English explanation of how the model interpreted the query.
   *  Surface this in the UI so the user can confirm or undo. */
  rationale: string
}
```

### `type AIFilterOptions`

Options for `aiFilter` - preview the plan, or apply it straight to the grid.

```ts
export type AIFilterOptions = {
  /**
   * When true, the helper not only RETURNS the plan but also applies it
   * to the grid via `api.setFilter` / `api.setSort`. Defaults to false
   * so callers can show a preview before committing.
   */
  apply?: boolean
  signal?: AbortSignal
}
```

### `function aiFilter`

Translate a natural-language query into a filter+sort plan against
the current grid's columns. The grid passes the column schema (names,
types, sample values) to the model so it can pick the right field
names without hallucinating.

```ts
export async function aiFilter<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  api: AIRowSource<TFeatures, TData>,
  query: string,
  opts: AIFilterOptions = {},
): Promise<AIFilterResult>
```

### `type AISmartFillExample`

One worked example teaching smart-fill what to produce for a row.

```ts
export type AISmartFillExample = { input: Record<string, unknown>; output: unknown }
```

### `type AISmartFillResult`

Proposed values for the blank cells of one column, each with a confidence score.

```ts
export type AISmartFillResult<TValue = unknown> = {
  field: string
  predictions: Array<{ rowIndex: number; value: TValue; confidence: number }>
  rationale: string
}
```

### `type AISmartFillOptions`

Options for `aiSmartFill` - which column to fill, which rows, and the examples to learn from.

```ts
export type AISmartFillOptions = {
  /** Target column - the one whose values we want filled. */
  field: string
  /** Index of rows the model should propose values for. If omitted, every
   *  row whose current `field` value is `null`, `undefined` or `''` is
   *  selected automatically. */
  targetRowIndices?: number[]
  /**
   * Worked examples the user has already filled in. Required - the
   * model needs at least one to know the pattern, two or more to lock
   * the schema. We don't pull these from the grid automatically because
   * "edited" vs "untouched" isn't a state SvGrid exposes today.
   */
  examples: AISmartFillExample[]
  signal?: AbortSignal
}
```

### `function aiSmartFill`

Given a column and a few user-provided examples, propose values for the
untouched rows. Returns predictions only - the caller chooses whether to
commit them via `api.setCellValue`. This is the right shape for an
accept-per-cell UX with confidence-coloured highlights.

```ts
export async function aiSmartFill<
  TFeatures extends TableFeatures,
  TData extends RowData,
  TValue = unknown,
>(
  api: AIRowSource<TFeatures, TData>,
  opts: AISmartFillOptions,
): Promise<AISmartFillResult<TValue>>
```

### `type AISummarizeTarget`

What to summarise: one row, the selection, a group, or the whole set.

```ts
export type AISummarizeTarget =
  | { kind: 'row'; rowIndex: number }
  | { kind: 'all' }
  | { kind: 'selection'; rowIndices: number[] }
  | { kind: 'group'; field: string; value: unknown }
```

### `type AISummary`

A generated summary: prose, bullets, and the columns the model leaned on.

```ts
export type AISummary = {
  text: string
  bullets: string[]
  /** Field names the model thinks are the most load-bearing for the
   *  story it just told. UI can highlight those columns. */
  highlightedFields: string[]
}
```

### `type AISummarizeOptions`

Options for `aiSummarize` - the target, and optionally the question to answer.

```ts
export type AISummarizeOptions = {
  target: AISummarizeTarget
  /** Optional question the user is trying to answer. Helps the model
   *  bias the summary toward the relevant columns. */
  question?: string
  signal?: AbortSignal
}
```

### `function aiSummarize`

Ask the model to summarise a slice of the grid. Caps the row sample at
a model-friendly size; for huge selections it samples uniformly so the
summary stays representative without blowing the context window.

```ts
export async function aiSummarize<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  api: AIRowSource<TFeatures, TData>,
  opts: AISummarizeOptions,
): Promise<AISummary>
```

### `type AIClassifyOptions`

Options for `aiClassify` - the column to label and the categories to choose from.

```ts
export type AIClassifyOptions = {
  /** Column whose free-text we're classifying. */
  inputField: string
  /** Target column the model should write to. */
  outputField: string
  /** Allowed values. The model is constrained to pick one. */
  classes: string[]
  /** Optional one-line description of each class (acts as a labeling rubric). */
  classDescriptions?: Record<string, string>
  /** Rows to classify. Defaults to all. */
  targetRowIndices?: number[]
  signal?: AbortSignal
}
```

### `type AIClassifyResult`

Proposed category labels per row, with the model's reasoning.

```ts
export type AIClassifyResult = {
  inputField: string
  outputField: string
  predictions: Array<{ rowIndex: number; value: string; confidence: number }>
}
```

### `function aiClassify`

Bucket free-text cells into one of a known set of classes. The model
is constrained to pick from `opts.classes`; predictions outside the set
are dropped so the caller can rely on the output being clean enum
values it can write straight back into the grid.

```ts
export async function aiClassify<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  api: AIRowSource<TFeatures, TData>,
  opts: AIClassifyOptions,
): Promise<AIClassifyResult>
```

### `type AIExportPlan`

An export the model derived from a request: format, columns, and scope.

```ts
export type AIExportPlan = {
  format: ExportFormat
  filters: AIFilterClause[]
  sort: AISortClause[]
  groupBy: string[]
  /** Plain-English explanation of how the model read the request. */
  rationale: string
}
```

### `type AIExportOptions`

Options for `aiExport` - preview the plan, or run the export it describes.

```ts
export type AIExportOptions = {
  /**
   * Also apply the filter / sort / grouping to the grid (mutating the view) so
   * it mirrors the export. Default FALSE - the export is self-contained (it
   * computes its own rows), so the grid is left untouched unless you opt in.
   */
  apply?: boolean
  /** Actually download the file. Default true; set false to preview the plan. */
  run?: boolean
  /** Base filename (no extension). Default 'export'. */
  filename?: string
  signal?: AbortSignal
}
```

### `function aiExport`

Turn a natural-language request ("export EU orders from Q2 as a grouped PDF")
into an export: the model returns a `{ format, filters, sort, groupBy }` plan
against the grid's columns; we apply the filter/sort to the grid and hand the
result to the registered export engine (@svgrid/enterprise). Returns the plan
so the UI can show what it did (or preview it first with `run: false`).

```ts
export async function aiExport<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  api: SvGridApi<TFeatures, TData>,
  query: string,
  opts: AIExportOptions = {},
): Promise<AIExportPlan>
```

### `type AIAnomaly`

One flagged value, with why it stands out and how strongly.

```ts
export type AIAnomaly = {
  /** Index into the SCANNED rows (target order), when the model pins one row. */
  rowIndex?: number
  field?: string
  value?: unknown
  reason: string
  severity: 'low' | 'medium' | 'high'
}
```

### `type AIAnomalyResult`

Everything an anomaly scan flagged across the rows it looked at.

```ts
export type AIAnomalyResult = {
  anomalies: AIAnomaly[]
  summary: string
}
```

### `type AIAnomalyOptions`

Options for `aiFindAnomalies` - which rows and columns to scan.

```ts
export type AIAnomalyOptions = {
  /** Which rows to scan. Defaults to the whole dataset. */
  target?: AISummarizeTarget
  /** Optional focus, e.g. "look at pricing and margins". */
  question?: string
  signal?: AbortSignal
}
```

### `function aiFindAnomalies`

Scan a slice of the grid (all / selection / group) for anomalies - outliers,
suspicious values, inconsistencies - and return a structured list plus a
one-line summary. Pairs naturally with an export: "find the odd ones, then
export just those".

```ts
export async function aiFindAnomalies<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  api: AIRowSource<TFeatures, TData>,
  opts: AIAnomalyOptions = {},
): Promise<AIAnomalyResult>
```

### `type AIChartType`

Chart shapes the model may choose from when planning a visualisation.

These are exactly the types the built-in panel can build from a dimension, a
measure and an optional split - which is all a chart plan carries. Scatter
is deliberately absent, because a plan cannot express its SECOND measure.
A candlestick can be asked for: the panel finds the open / high / low /
close / volume columns by name, so the plan only needs a date dimension.

```ts
export type AIChartType =
  | 'bar' | 'line' | 'area' | 'pie'
  | 'treemap' | 'funnel' | 'waterfall' | 'radar'
  | 'heatmap' | 'boxplot' | 'gauge' | 'calendar' | 'sankey'
  | 'histogram' | 'lollipop' | 'pareto' | 'sunburst' | 'radial-bar' | 'radial-column' | 'nightingale' | 'bullet' | 'chord' | 'stream'
  | 'candlestick'
```

### `type AIChartIndicator`

The indicators a chart plan may ask for on a candlestick.

```ts
export type AIChartIndicator = 'volume' | 'rsi' | 'macd' | 'stochastic' | 'atr' | 'obv' | 'sma' | 'ema' | 'bb' | 'vwap'
```

### `type AIChartPlan`

A chart the model proposed: its type, and the fields to plot.

```ts
export type AIChartPlan = {
  type: AIChartType
  /** Group-by (category-axis) column field, or null. */
  dimension: string | null
  /** Split-by column field: one series per distinct value, or null. */
  series: string | null
  /** Measure (value-axis) column field, or null. */
  measure: string | null
  reduce: AIChartReduce
  stacked: boolean
  logScale: boolean
  timeAxis: boolean
  valueFormat: 'number' | 'currency' | 'percent'
  /** Calendar unit to group a date dimension by, or null for exact values. */
  bucket: 'day' | 'week' | 'month' | 'quarter' | 'year' | null
  /** Candlestick only: indicator panes and overlays to add. */
  indicators?: AIChartIndicator[]
  rationale: string
  /** With `apply`: what `validateChartSpec` flagged as an error on the spec
   *  the panel built from the plan, empty when it drew cleanly. */
  diagnostics?: ChartDiagnostic[]
}
```

### `type AIChartReduce`

The reducers a chart plan may name: the panel's full list.

```ts
export type AIChartReduce =
  | 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median' | 'p90' | 'first' | 'last' | 'countDistinct'
```

### `type AIChartOptions`

Options for `aiChart` - preview the plan, or render it into the grid.

```ts
export type AIChartOptions = {
  /** Apply the plan to the grid's chart panel (open + configure). Default false. */
  apply?: boolean
  signal?: AbortSignal
}
```

### `function aiChart`

Translate a natural-language request into a chart plan for the grid's built-in
`charting` panel. Validates every field against the real schema, then (with
`apply: true`) pushes it into the panel through `api.configureChart`.

```ts
export async function aiChart<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  api: SvGridApi<TFeatures, TData>,
  query: string,
  opts: AIChartOptions = {},
): Promise<AIChartPlan>
```

### `type AIChartExplanation`

What `aiExplainChart` returns: the grounded summary and the model's insights.

```ts
export type AIChartExplanation = {
  /** The plain-language reading of the chart (`chartSummary`), as the model saw it. */
  summary: string
  /** Two to three observations the model added: comparisons, outliers, what to look at next. */
  insights: string[]
}
```

### `type AIExplainChartOptions`

Options for `aiExplainChart`.

```ts
export type AIExplainChartOptions = {
  /** The spec to explain. Default: the grid panel's active chart. */
  spec?: ChartSpec
  signal?: AbortSignal
}
```

### `function aiExplainChart`

Explain a chart in plain words. The prompt is grounded on `chartSummary`
(the same sentence a screen reader hears) plus a compact table of the
first 50 categories, so the model comments on numbers it was given rather
than on an image. Returns the summary and up to three insights.

```ts
export async function aiExplainChart<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(api: SvGridApi<TFeatures, TData>, opts: AIExplainChartOptions = {}): Promise<AIChartExplanation>
```

### `function enableAiCharting`

Wire the grid's chart-panel AI button to the model: registers a handler (via
`api.setChartAiHandler`) that runs `aiChart` and returns the plan for the
panel to apply + explain. Call once after `onApiReady`. `installEnterprise`
calls this for you.

```ts
export function enableAiCharting<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(api: SvGridApi<TFeatures, TData>): void
```

### `function disableAiCharting`

Remove the natural-language chart handler, hiding the AI button in the chart
panel. The inverse of `enableAiCharting`; safe to call when none was set.

```ts
export function disableAiCharting<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(api: SvGridApi<TFeatures, TData>): void
```

### `const mockAIProvider`

A deterministic provider that returns canned, schema-shaped responses
for each task. Wire it in via `setAIProvider(mockAIProvider)` to make
the AI demo work end-to-end without a real model key. Not for production.

```ts
export const mockAIProvider: AIProvider = async (req) => ...
```
