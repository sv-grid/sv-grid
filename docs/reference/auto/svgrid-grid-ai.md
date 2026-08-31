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

One call out to the model, as the grid builds it. Providers receive this. */

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

Which helper produced a request - carried on {@link AIRequest} for routing and telemetry. */

```ts
export type AITask = 'filter' | 'smart-fill' | 'summarize' | 'classify' | 'export' | 'anomaly' | 'chart'
```

### `function setAIProvider`

Register the model adapter every AI call will route through. Call once
at app boot. Passing `null` clears the provider and AI calls revert to
throwing "no provider" errors.

```ts
export function setAIProvider(p: AIProvider | null): void {
  provider = p
}
```

### `function getAIProvider`

The provider registered with `setAIProvider`, or null when none is. */

```ts
export function getAIProvider(): AIProvider | null {
  return provider
}
```

### `function hasAIProvider`

Whether an AI provider is registered. Gate AI affordances on this so the UI stays honest. */

```ts
export function hasAIProvider(): boolean {
  return provider != null
}
```

### `type AIFilterClause`

One condition in a filter plan: a column, a comparison, and the value to match. */

```ts
export type AIFilterClause = {
  field: string
  operator: 'contains' | 'equals' | 'startsWith' | 'greaterThan' | 'lessThan' | 'isBlank'
  value?: string
}
```

### `type AISortClause`

One ordering clause in a filter plan. */

```ts
export type AISortClause = { field: string; desc: boolean }
```

### `type AIFilterResult`

A natural-language query turned into filters and sorting, plus the model's reasoning. */

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

Options for `aiFilter` - preview the plan, or apply it straight to the grid. */

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

### `type AISmartFillExample`

One worked example teaching smart-fill what to produce for a row. */

```ts
export type AISmartFillExample = { input: Record<string, unknown>; output: unknown }
```

### `type AISmartFillResult`

Proposed values for the blank cells of one column, each with a confidence score. */

```ts
export type AISmartFillResult<TValue = unknown> = {
  field: string
  predictions: Array<{ rowIndex: number; value: TValue; confidence: number }>
  rationale: string
}
```

### `type AISmartFillOptions`

Options for `aiSmartFill` - which column to fill, which rows, and the examples to learn from. */

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

### `type AISummarizeTarget`

What to summarise: one row, the selection, a group, or the whole set. */

```ts
export type AISummarizeTarget =
  | { kind: 'row'; rowIndex: number }
  | { kind: 'all' }
  | { kind: 'selection'; rowIndices: number[] }
  | { kind: 'group'; field: string; value: unknown }
```

### `type AISummary`

A generated summary: prose, bullets, and the columns the model leaned on. */

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

Options for `aiSummarize` - the target, and optionally the question to answer. */

```ts
export type AISummarizeOptions = {
  target: AISummarizeTarget
  /** Optional question the user is trying to answer. Helps the model
   *  bias the summary toward the relevant columns. */
  question?: string
  signal?: AbortSignal
}
```

### `type AIClassifyOptions`

Options for `aiClassify` - the column to label and the categories to choose from. */

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

Proposed category labels per row, with the model's reasoning. */

```ts
export type AIClassifyResult = {
  inputField: string
  outputField: string
  predictions: Array<{ rowIndex: number; value: string; confidence: number }>
}
```

### `type AIExportPlan`

An export the model derived from a request: format, columns, and scope. */

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

Options for `aiExport` - preview the plan, or run the export it describes. */

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

### `type AIAnomaly`

One flagged value, with why it stands out and how strongly. */

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

Everything an anomaly scan flagged across the rows it looked at. */

```ts
export type AIAnomalyResult = {
  anomalies: AIAnomaly[]
  summary: string
}
```

### `type AIAnomalyOptions`

Options for `aiFindAnomalies` - which rows and columns to scan. */

```ts
export type AIAnomalyOptions = {
  /** Which rows to scan. Defaults to the whole dataset. */
  target?: AISummarizeTarget
  /** Optional focus, e.g. "look at pricing and margins". */
  question?: string
  signal?: AbortSignal
}
```

### `type AIChartType`

Chart shapes the model may choose from when planning a visualisation. */

```ts
export type AIChartType = 'bar' | 'line' | 'area' | 'pie'
```

### `type AIChartPlan`

A chart the model proposed: its type, and the fields to plot. */

```ts
export type AIChartPlan = {
  type: AIChartType
  /** Group-by (category-axis) column field, or null. */
  dimension: string | null
  /** Split-by column field: one series per distinct value, or null. */
  series: string | null
  /** Measure (value-axis) column field, or null. */
  measure: string | null
  reduce: 'sum' | 'avg' | 'count'
  stacked: boolean
  logScale: boolean
  timeAxis: boolean
  valueFormat: 'number' | 'currency' | 'percent'
  rationale: string
}
```

### `type AIChartOptions`

Options for `aiChart` - preview the plan, or render it into the grid. */

```ts
export type AIChartOptions = {
  /** Apply the plan to the grid's chart panel (open + configure). Default false. */
  apply?: boolean
  signal?: AbortSignal
}
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
>(api: SvGridApi<TFeatures, TData>): void {
  const hook = api as unknown as {
    setChartAiHandler?: (
      fn: ((prompt: string) => Promise<Record<string, unknown> | null>) | null,
    ) => void
  }
  hook.setChartAiHandler?.(async (prompt: string) => {
    const plan = await aiChart(api, prompt)
    return {
      type: plan.type,
      dimension: plan.dimension,
      series: plan.series,
      measure: plan.measure,
      reduce: plan.reduce,
      stacked: plan.stacked,
      logScale: plan.logScale,
      timeAxis: plan.timeAxis,
      valueFormat: plan.valueFormat,
      rationale: plan.rationale,
    }
  })
}
```

### `function disableAiCharting`

Remove the natural-language chart handler, hiding the AI button in the chart
panel. The inverse of `enableAiCharting`; safe to call when none was set.

```ts
export function disableAiCharting<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(api: SvGridApi<TFeatures, TData>): void {
  const hook = api as unknown as { setChartAiHandler?: (fn: null) => void }
  hook.setChartAiHandler?.(null)
}
```

### `const mockAIProvider`

A deterministic provider that returns canned, schema-shaped responses
for each task. Wire it in via `setAIProvider(mockAIProvider)` to make
the AI demo work end-to-end without a real model key. Not for production.

```ts
export const mockAIProvider: AIProvider = async (req) => {
  // Tiny artificial delay so the UI's "thinking" state is visible.
  await new Promise((r) => setTimeout(r, 350 + Math.random() * 400))

  if (req.task === 'filter') {
    const q = extractUserQuery(req.prompt)
    return JSON.stringify(buildMockFilter(req.prompt, q))
  }
  if (req.task === 'smart-fill') {
    return JSON.stringify(buildMockSmartFill(req.prompt))
  }
  if (req.task === 'summarize') {
    return JSON.stringify(buildMockSummary(req.prompt))
  }
  if (req.task === 'classify') {
    return JSON.stringify(buildMockClassify(req.prompt))
  }
  if (req.task === 'export') {
    return JSON.stringify(buildMockExport(req.prompt))
  }
  if (req.task === 'anomaly') {
    return JSON.stringify(buildMockAnomaly(req.prompt))
  }
  if (req.task === 'chart') {
    return JSON.stringify(buildMockChart(req.prompt))
  }
  return '{}'
}
```
