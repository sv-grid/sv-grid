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
export function setAIProvider(p: AIProvider | null): void {
  provider = p
}
```

### `function getAIProvider`

The provider registered with `setAIProvider`, or null when none is.

```ts
export function getAIProvider(): AIProvider | null {
  return provider
}
```

### `function hasAIProvider`

Whether an AI provider is registered. Gate AI affordances on this so the UI stays honest.

```ts
export function hasAIProvider(): boolean {
  return provider != null
}
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
): Promise<AIFilterResult> {
  const schema = buildColumnSchema(api)
  const prompt =
    `You are a data-grid filter planner. Translate the user's natural-language ` +
    `query into a strict-JSON plan that the grid can apply.\n\n` +
    `Columns:\n${schemaToPromptBlock(schema)}\n\n` +
    `Output JSON schema:\n` +
    `{ "filters": [{"field": "<one of the columns above>", ` +
    `"operator": "contains"|"equals"|"startsWith"|"greaterThan"|"lessThan"|"isBlank", ` +
    `"value": "<string>"}], ` +
    `"sort": [{"field": "<column>", "desc": true|false}], ` +
    `"rationale": "<one-sentence explanation>" }\n\n` +
    `User query: ${query}\n\n` +
    `Return JSON only, no prose.`

  const result = await callJSON<AIFilterResult>({
    prompt,
    task: 'filter',
    signal: opts.signal,
    maxOutputTokens: 400,
  })

  // Defensive: drop anything that doesn't match a real column. Models love
  // to invent plausible-sounding field names; we'd rather skip a clause
  // than throw at runtime.
  const valid = new Set(schema.map((c) => c.field))
  result.filters = (result.filters ?? []).filter((f) => valid.has(f.field))
  result.sort = (result.sort ?? []).filter((s) => valid.has(s.field))

  if (opts.apply) {
    if (!isGridApi(api)) throw new Error('aiFilter: apply needs the grid api, not a { getData } row source')
    api.clearAllFilters()
    api.clearSort()
    for (const f of result.filters) {
      api.setFilter(f.field, { operator: f.operator, value: f.value ?? '' })
    }
    // Multiple sort clauses get applied last-wins because the public
    // `setSort` is single-key. Multi-sort is on the roadmap.
    const last = result.sort[result.sort.length - 1]
    if (last) api.setSort(last.field, last.desc ? 'desc' : 'asc')
  }

  return result
}
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
): Promise<AISmartFillResult<TValue>> {
  if (opts.examples.length === 0) {
    throw new Error('@svgrid/grid ai: aiSmartFill requires at least one example.')
  }
  const data = api.getData()
  const targets =
    opts.targetRowIndices ??
    data
      .map((row, i) => {
        const v = (row as Record<string, unknown>)[opts.field]
        return v == null || v === '' ? i : -1
      })
      .filter((i) => i >= 0)

  if (targets.length === 0) {
    return { field: opts.field, predictions: [], rationale: 'No empty cells to fill.' }
  }

  const examplesBlock = opts.examples
    .map((ex, i) => `Example ${i + 1}: input=${JSON.stringify(ex.input)} -> output=${JSON.stringify(ex.output)}`)
    .join('\n')

  const targetRowsBlock = targets
    .map((i) => `Row ${i}: ${JSON.stringify(data[i])}`)
    .join('\n')

  const prompt =
    `You are filling in a single column of a data grid based on user-provided ` +
    `examples. Match the pattern in the examples exactly.\n\n` +
    `Target column: ${opts.field}\n\n` +
    `Examples:\n${examplesBlock}\n\n` +
    `Rows to fill:\n${targetRowsBlock}\n\n` +
    `Return strict JSON only:\n` +
    `{ "predictions": [{"rowIndex": <number>, "value": <inferred value>, ` +
    `"confidence": <0..1>}], "rationale": "<one-sentence pattern description>" }`

  const result = await callJSON<{
    predictions: Array<{ rowIndex: number; value: TValue; confidence: number }>
    rationale: string
  }>({
    prompt,
    task: 'smart-fill',
    signal: opts.signal,
    maxOutputTokens: 600,
  })

  return {
    field: opts.field,
    predictions: result.predictions ?? [],
    rationale: result.rationale ?? '',
  }
}
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
): Promise<AISummary> {
  const all = api.getData()
  const rows: TData[] = (() => {
    const t = opts.target
    if (t.kind === 'row') {
      const r = all[t.rowIndex]
      return r ? [r] : []
    }
    if (t.kind === 'selection') {
      return t.rowIndices.map((i) => all[i]).filter((r): r is TData => r != null)
    }
    if (t.kind === 'group') {
      return all.filter((r) => (r as Record<string, unknown>)[t.field] === t.value)
    }
    return all.slice()
  })()

  if (rows.length === 0) {
    return { text: 'No rows in scope.', bullets: [], highlightedFields: [] }
  }

  // Uniform sample to stay inside a sensible context budget.
  const MAX_SAMPLE = 25
  const sample = rows.length <= MAX_SAMPLE
    ? rows
    : Array.from({ length: MAX_SAMPLE }, (_, i) => rows[Math.floor((i / MAX_SAMPLE) * rows.length)]!)

  const schema = buildColumnSchema(api, 30)
  const prompt =
    `You are summarising a slice of a business data grid for a busy analyst.\n\n` +
    `Columns:\n${schemaToPromptBlock(schema)}\n\n` +
    `Slice size: ${rows.length} row(s). Sampled rows shown below.\n` +
    `${sample.map((r) => JSON.stringify(r)).join('\n')}\n\n` +
    (opts.question ? `User's question: ${opts.question}\n\n` : '') +
    `Return strict JSON only:\n` +
    `{ "text": "<one short paragraph>", ` +
    `"bullets": ["<3-5 punchy bullets>"], ` +
    `"highlightedFields": ["<column names the summary leans on>"] }`

  const result = await callJSON<AISummary>({
    prompt,
    task: 'summarize',
    signal: opts.signal,
    maxOutputTokens: 600,
  })
  return {
    text: result.text ?? '',
    bullets: result.bullets ?? [],
    highlightedFields: result.highlightedFields ?? [],
  }
}
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
): Promise<AIClassifyResult> {
  const data = api.getData()
  const targets = opts.targetRowIndices ?? data.map((_, i) => i)
  const rubric = opts.classDescriptions
    ? Object.entries(opts.classDescriptions)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n')
    : opts.classes.map((c) => `- ${c}`).join('\n')

  const rowsBlock = targets
    .map((i) => `Row ${i}: ${JSON.stringify((data[i] as Record<string, unknown>)?.[opts.inputField] ?? '')}`)
    .join('\n')

  const prompt =
    `You are a strict text classifier. For each row, pick exactly one ` +
    `label from the list. If unsure, pick the closest match and lower the ` +
    `confidence.\n\n` +
    `Allowed labels (with optional rubric):\n${rubric}\n\n` +
    `Rows to classify (text from column "${opts.inputField}"):\n${rowsBlock}\n\n` +
    `Return strict JSON only:\n` +
    `{ "predictions": [{"rowIndex": <number>, "value": "<label>", "confidence": <0..1>}] }`

  const result = await callJSON<{
    predictions: Array<{ rowIndex: number; value: string; confidence: number }>
  }>({
    prompt,
    task: 'classify',
    signal: opts.signal,
    maxOutputTokens: Math.min(2000, 30 + targets.length * 30),
  })

  const allowed = new Set(opts.classes)
  return {
    inputField: opts.inputField,
    outputField: opts.outputField,
    predictions: (result.predictions ?? []).filter((p) => allowed.has(p.value)),
  }
}
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
): Promise<AIExportPlan> {
  const schema = buildColumnSchema(api)
  const prompt =
    `You are an export assistant for a data grid. Translate the user's request ` +
    `into a strict-JSON export plan.\n\n` +
    `Columns:\n${schemaToPromptBlock(schema)}\n\n` +
    `Output JSON schema:\n` +
    `{ "format": "xlsx"|"xls"|"pdf"|"csv"|"tsv"|"html"|"json"|"xml"|"md", ` +
    `"filters": [{"field":"<column>","operator":"contains"|"equals"|"startsWith"|"greaterThan"|"lessThan"|"isBlank","value":"<string>"}], ` +
    `"sort": [{"field":"<column>","desc":true|false}], ` +
    `"groupBy": ["<column>"], ` +
    `"rationale": "<one sentence>" }\n\n` +
    `Rules: use the format the user names (default "xlsx"); only use column ` +
    `names from the list above; "grouped" / "group by X" -> groupBy. ` +
    `Return JSON only, no prose.\n\n` +
    `User request: ${query}`

  const plan = await callJSON<AIExportPlan>({
    prompt,
    task: 'export',
    signal: opts.signal,
    maxOutputTokens: 500,
  })

  // Defensive validation - drop invented fields, clamp the format.
  const valid = new Set(schema.map((c) => c.field))
  plan.format = EXPORT_FORMATS.includes(plan.format) ? plan.format : 'xlsx'
  plan.filters = (plan.filters ?? []).filter((f) => valid.has(f.field))
  plan.sort = (plan.sort ?? []).filter((s) => valid.has(s.field))
  plan.groupBy = (plan.groupBy ?? []).filter((g) => valid.has(g))
  plan.rationale = plan.rationale ?? ''

  // Optionally mirror the plan onto the grid (opt-in). Off by default so the
  // export never disturbs the user's current view.
  if (opts.apply === true) {
    api.clearAllFilters()
    api.clearSort()
    for (const f of plan.filters) {
      api.setFilter(f.field, { operator: f.operator, value: f.value ?? '' })
    }
    const last = plan.sort[plan.sort.length - 1]
    if (last) api.setSort(last.field, last.desc ? 'desc' : 'asc')
    if (plan.groupBy.length > 0) {
      try {
        api.setGroupBy(plan.groupBy)
      } catch {
        // grouping feature not enabled - the export still groups on its own
      }
    }
  }

  // Planning is always free; WRITING the file uses the export engine registered
  // by @svgrid/enterprise (export-provider seam). Without it, we return the plan
  // so the UI can still show what the AI decided - the download just no-ops.
  const runExport = getExportProvider()
  if (opts.run !== false && runExport) {
    // Compute the export rows from the plan directly (filter + sort + make
    // contiguous by group) rather than reading the grid's reactive displayed
    // rows - so the download always has exactly the intended data.
    const exportRows = applyPlanToRows(api.getData(), plan)
    await runExport(api, {
      format: plan.format,
      filename: opts.filename ?? 'export',
      rows: exportRows,
      ...(plan.groupBy.length > 0 ? { groupBy: plan.groupBy } : {}),
    })
  }
  return plan
}
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
): Promise<AIAnomalyResult> {
  const rows = sliceForTarget(api, opts.target ?? { kind: 'all' })
  if (rows.length === 0) return { anomalies: [], summary: 'No rows in scope.' }

  const MAX_SAMPLE = 40
  const sample =
    rows.length <= MAX_SAMPLE
      ? rows
      : Array.from(
          { length: MAX_SAMPLE },
          (_, i) => rows[Math.floor((i / MAX_SAMPLE) * rows.length)]!,
        )

  const schema = buildColumnSchema(api, 30)
  const prompt =
    `You are a data-quality analyst. Scan the rows below for anomalies: ` +
    `numeric outliers, impossible / inconsistent values, unexpected blanks, ` +
    `and values that break the pattern of the column.\n\n` +
    `Columns:\n${schemaToPromptBlock(schema)}\n\n` +
    `Rows (index is 0-based into this list):\n` +
    `${sample.map((r, i) => `${i}: ${JSON.stringify(r)}`).join('\n')}\n\n` +
    (opts.question ? `Focus: ${opts.question}\n\n` : '') +
    `Return strict JSON only:\n` +
    `{ "anomalies": [{"rowIndex": <number|null>, "field": "<column|null>", ` +
    `"reason": "<why it's odd>", "severity": "low"|"medium"|"high"}], ` +
    `"summary": "<one sentence>" }`

  const result = await callJSON<AIAnomalyResult>({
    prompt,
    task: 'anomaly',
    signal: opts.signal,
    maxOutputTokens: 800,
  })
  return {
    anomalies: result.anomalies ?? [],
    summary: result.summary ?? '',
  }
}
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
): Promise<AIChartPlan> {
  const schema = buildColumnSchema(api)
  const prompt =
    `You are a charting assistant for a data grid. Translate the user's request ` +
    `into a strict-JSON chart plan the grid can render.\n\n` +
    `Columns:\n${schemaToPromptBlock(schema)}\n\n` +
    `Output JSON schema:\n` +
    `{ "type": "bar"|"line"|"area"|"pie"|"treemap"|"funnel"|"waterfall"|"radar"|"heatmap"|"boxplot"|"gauge"|"calendar"|"sankey"|"histogram"|"lollipop"|"pareto"|"sunburst"|"radial-bar"|"radial-column"|"nightingale"|"bullet"|"chord"|"stream"|"candlestick", ` +
    `"dimension": "<a categorical column to group by>", ` +
    `"series": "<a second categorical column to split into series, or null>", ` +
    `"measure": "<a numeric column to aggregate>", ` +
    `"reduce": "sum"|"avg"|"count"|"min"|"max"|"median"|"p90"|"first"|"last"|"countDistinct", ` +
    `"bucket": "day"|"week"|"month"|"quarter"|"year"|null, ` +
    `"stacked": true|false, ` +
    `"logScale": true|false, ` +
    `"timeAxis": true|false, ` +
    `"valueFormat": "number"|"currency"|"percent", ` +
    `"indicators": ["volume"|"rsi"|"macd"|"stochastic"|"atr"|"obv"|"sma"|"ema"|"bb"|"vwap", ...] (candlestick only, else omit), ` +
    `"rationale": "<one-sentence explanation>" }\n\n` +
    `Rules: pick "dimension" and "series" from text/date columns and "measure" ` +
    `from a numeric column; use only column names from the list above; ` +
    `default to "bar" unless the request clearly wants another type. ` +
    `Type hints: share/proportion/breakdown -> pie; nested/hierarchy/"what makes ` +
    `up" -> treemap; drop-off/conversion/stages/pipeline -> funnel; ` +
    `running total/contribution/bridge -> waterfall; comparing several measures ` +
    `per item -> radar; a grid of two dimensions -> heatmap (needs "series"); ` +
    `spread/distribution/variance/outliers/percentiles -> boxplot; a single ` +
    `number vs a target -> gauge (leave "dimension" null); a year of daily ` +
    `activity -> calendar (dimension must be a date column); flow between two ` +
    `things -> sankey (needs "series": dimension is the source, series the ` +
    `target); flows between groups round a circle -> chord (needs "series"); ` +
    `frequency/how many fall in each range -> histogram (leave "dimension" null); ` +
    `vital few/80-20/biggest contributors -> pareto; drilldown/rings/nested share -> sunburst; ` +
    `progress rings/circular -> radial-bar; polar/rose -> nightingale or radial-column; ` +
    `actual vs target per item -> bullet; layered over time/stream -> stream (needs "series"); ` +
    `price/candles/OHLC/stock/ticker -> candlestick (dimension is the date column; the open/high/low/close/volume columns are found by name), ` +
    `with "volume"/"RSI"/"MACD"/"Bollinger"/"moving average" -> indicators. ` +
    `"stacked"/"stack" -> stacked:true; "log"/"logarithmic" -> logScale:true; ` +
    `"over time"/"by date"/a date dimension -> timeAxis:true; ` +
    `"monthly"/"per month"/"by month" -> bucket:"month" (likewise daily/weekly/quarterly/yearly), else bucket:null; ` +
    `"median"/"typical" -> reduce:"median"; "highest"/"peak" -> "max"; "lowest" -> "min"; "unique"/"distinct" -> "countDistinct"; ` +
    `money/revenue/price/$ -> valueFormat:"currency"; rate/%/share -> valueFormat:"percent"; ` +
    `else valueFormat:"number". default reduce is "sum". ` +
    `Return JSON only, no prose.\n\n` +
    `User request: ${query}`

  const plan = await callJSON<AIChartPlan>({
    prompt,
    task: 'chart',
    signal: opts.signal,
    maxOutputTokens: 300,
  })

  const valid = new Set(schema.map((c) => c.field))
  const numericFields = new Set(schema.filter((c) => c.type === 'number').map((c) => c.field))
  const CHART_TYPES: AIChartType[] = [
    'bar', 'line', 'area', 'pie',
    'treemap', 'funnel', 'waterfall', 'radar',
    'heatmap', 'boxplot', 'gauge', 'calendar', 'sankey',
    'histogram', 'lollipop', 'pareto', 'sunburst', 'radial-bar', 'radial-column', 'nightingale', 'bullet', 'chord', 'stream',
    'candlestick',
  ]
  plan.type = CHART_TYPES.includes(plan.type) ? plan.type : 'bar'
  plan.dimension = plan.dimension && valid.has(plan.dimension) ? plan.dimension : null
  plan.series = plan.series && valid.has(plan.series) && plan.series !== plan.dimension ? plan.series : null
  plan.measure =
    plan.measure && numericFields.has(plan.measure)
      ? plan.measure
      : (schema.find((c) => c.type === 'number')?.field ?? null)
  // Shape check. Some types need more than a dimension and a measure, and a
  // plan that does not satisfy one renders an empty frame - the model asked for
  // a chart the data cannot make. Fall back to a bar, which any dimension and
  // measure can draw, rather than showing nothing and blaming the request.
  const dateFields = new Set(schema.filter((c) => c.type === 'date').map((c) => c.field))
  const needsSplit = plan.type === 'heatmap' || plan.type === 'sankey' || plan.type === 'chord' || plan.type === 'stream'
  if (needsSplit && !plan.series) plan.type = 'bar'
  if (plan.type === 'calendar' && !(plan.dimension && dateFields.has(plan.dimension))) plan.type = 'bar'
  // A candlestick needs a date to run along and four prices to draw; the
  // panel finds the price columns by name, so the shape check is the count.
  if (plan.type === 'candlestick' && !(plan.dimension && dateFields.has(plan.dimension) && numericFields.size >= 4)) plan.type = 'bar'
  plan.indicators = plan.type === 'candlestick' && Array.isArray(plan.indicators)
    ? plan.indicators.filter((k): k is AIChartIndicator => AI_INDICATORS.includes(k))
    : undefined
  if (plan.indicators === undefined) delete plan.indicators
  // A gauge is one number: it has no category axis, so a dimension is noise.
  // A histogram bins the measure itself, so a dimension is noise there too.
  if (plan.type === 'gauge' || plan.type === 'histogram') plan.dimension = null
  if (plan.type !== 'gauge' && plan.type !== 'histogram' && !plan.dimension) plan.type = 'bar'

  plan.reduce = AI_REDUCERS.includes(plan.reduce) ? plan.reduce : 'sum'
  // A bucket only means something on a date dimension.
  const BUCKETS = ['day', 'week', 'month', 'quarter', 'year'] as const
  plan.bucket =
    plan.bucket && (BUCKETS as ReadonlyArray<string>).includes(plan.bucket) && plan.dimension && dateFields.has(plan.dimension)
      ? plan.bucket
      : null
  plan.stacked = plan.stacked === true
  plan.logScale = plan.logScale === true
  plan.timeAxis = plan.timeAxis === true
  plan.valueFormat = ['number', 'currency', 'percent'].includes(plan.valueFormat) ? plan.valueFormat : 'number'
  plan.rationale = plan.rationale ?? ''

  if (opts.apply === true) {
    const cfg = api as unknown as { configureChart?: (c: Record<string, unknown>) => void }
    cfg.configureChart?.({
      open: true,
      type: plan.type,
      dimension: plan.dimension,
      series: plan.series,
      measure: plan.measure,
      reduce: plan.reduce,
      stacked: plan.stacked,
      logScale: plan.logScale,
      timeAxis: plan.timeAxis,
      valueFormat: plan.valueFormat,
      ...(plan.indicators ? { indicators: plan.indicators } : {}),
      bucket: plan.bucket,
    })
    // The panel built a spec from the plan; if it cannot draw as intended,
    // say so on the plan rather than showing an empty frame in silence.
    const spec = (api as unknown as { getChartSpec?: () => unknown }).getChartSpec?.()
    if (spec) plan.diagnostics = validateChartSpec(spec).filter((d) => d.severity === 'error')
  }

  return plan
}
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
>(api: SvGridApi<TFeatures, TData>, opts: AIExplainChartOptions = {}): Promise<AIChartExplanation> {
  const spec = opts.spec ?? (api as unknown as { getChartSpec?: () => ChartSpec | null }).getChartSpec?.() ?? null
  if (!spec) return { summary: 'No chart to explain.', insights: [] }
  const summary = chartSummary(spec)
  const cats = spec.categories.slice(0, 50)
  const table = cats.length
    ? `${['category', ...spec.series.map((s) => s.label)].join('\t')}\n` +
      cats.map((c, i) => [c, ...spec.series.map((s) => String(s.values[i] ?? ''))].join('\t')).join('\n')
    : ''
  const prompt =
    `You are explaining a ${spec.type} chart to a busy reader.\n\n` +
    `Reading of the chart: ${summary}\n\n` +
    (table ? `Data (first ${cats.length} categories, tab separated):\n${table}\n\n` : '') +
    `Return strict JSON only: { "insights": ["<2-3 short observations a reader would miss at a glance: comparisons, outliers, what to look at next>"] }`
  const out = await callJSON<{ insights?: unknown }>({ prompt, task: 'explain-chart', signal: opts.signal, maxOutputTokens: 300 })
  const insights = Array.isArray(out.insights) ? out.insights.filter((x): x is string => typeof x === 'string').slice(0, 3) : []
  return { summary, insights }
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
      bucket: plan.bucket,
      rationale: plan.rationale,
    }
  })
  // And the Explain button beside it.
  const explain = api as unknown as { setChartExplainHandler?: (fn: (() => Promise<AIChartExplanation | null>) | null) => void }
  explain.setChartExplainHandler?.(() => aiExplainChart(api))
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
  const hook = api as unknown as { setChartAiHandler?: (fn: null) => void; setChartExplainHandler?: (fn: null) => void }
  hook.setChartAiHandler?.(null)
  hook.setChartExplainHandler?.(null)
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
  if (req.task === 'explain-chart') {
    // Two canned observations round the reading the prompt was grounded on.
    const reading = /Reading of the chart: ([^\n]+)/.exec(req.prompt)?.[1] ?? ''
    const rises = /rises/.test(reading)
    return JSON.stringify({
      insights: [
        rises ? 'The growth is front-loaded: the early categories carry most of the change.' : 'The movement is gradual with no single category driving it.',
        'Compare the peak against the same category a period earlier before reading it as a trend.',
      ],
    })
  }
  return '{}'
}
```
