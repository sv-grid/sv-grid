/**
 * Pro AI feature pack
 * -------------------
 *
 * Three jobs every analyst wishes a data grid could do:
 *
 *   1. Natural-language filter / sort  (`aiFilter`)
 *      "show me deals closing this quarter over $50k owned by Sasha"
 *      ->  { filters: [...], sort: [...] }
 *
 *   2. Smart fill  (`aiSmartFill`)
 *      User edits two cells in a column with example values; the
 *      Grid proposes the rest. Excel "Flash Fill" pattern.
 *
 *   3. Summarise rows  (`aiSummarize`)
 *      Single row, the current selection, a group key, or the whole
 *      filtered view -> a one-paragraph summary.
 *
 * The grid stays headless / model-agnostic. The consumer supplies an
 * `AIProvider` that knows how to call OpenAI / Anthropic / a local
 * model / a server-side proxy. We never bundle a model client.
 *
 * License gate: every AI call routes through `assertEnterpriseLicensed()`,
 * which soft-gates (still works, adds a watermark, console nudge) when
 * no key is set so demos and evaluation stay frictionless.
 */

import type { RowData, SvGridApi, TableFeatures } from '@svgrid/grid'
import { assertEnterpriseLicensed } from './license'
import { exportGrid, type ExportFormat } from './export'

// ---------------------------------------------------------------------------
// Provider contract
// ---------------------------------------------------------------------------

/**
 * Shape every consumer-provided model adapter must implement. Keeping this
 * tiny (one async call, two response formats) lets the same adapter drive
 * OpenAI's `chat.completions`, Anthropic's `messages`, a self-hosted
 * llama.cpp endpoint, or a server-side proxy. The grid only cares that the
 * provider eventually returns a string we can parse.
 */
export type AIProvider = (request: AIRequest) => Promise<string>

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

export type AITask = 'filter' | 'smart-fill' | 'summarize' | 'classify' | 'export' | 'anomaly' | 'chart'

let provider: AIProvider | null = null

/**
 * Register the model adapter every AI call will route through. Call once
 * at app boot. Passing `null` clears the provider and AI calls revert to
 * throwing "no provider" errors.
 */
export function setAIProvider(p: AIProvider | null): void {
  provider = p
}

export function getAIProvider(): AIProvider | null {
  return provider
}

export function hasAIProvider(): boolean {
  return provider != null
}

class NoProviderError extends Error {
  constructor() {
    super(
      '@svgrid/enterprise/ai: no AI provider registered. Call setAIProvider(fn) ' +
        'with an adapter that talks to OpenAI / Anthropic / your proxy.',
    )
    this.name = 'NoProviderError'
  }
}

class BadJsonError extends Error {
  constructor(raw: string) {
    super(
      '@svgrid/enterprise/ai: provider returned non-JSON for a json-format request. ' +
        `First 200 chars: ${raw.slice(0, 200)}`,
    )
    this.name = 'BadJsonError'
  }
}

async function callProvider(req: AIRequest): Promise<string> {
  if (!provider) throw new NoProviderError()
  return provider(req)
}

async function callJSON<T>(req: AIRequest): Promise<T> {
  const raw = await callProvider({ ...req, responseFormat: 'json' })
  // Models occasionally wrap JSON in markdown code fences even when asked
  // for raw JSON. Strip a single fenced block if present, then parse.
  const stripped = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
  try {
    return JSON.parse(stripped) as T
  } catch {
    throw new BadJsonError(raw)
  }
}

// ---------------------------------------------------------------------------
// Helpers - build column schema + row sample from the grid API
// ---------------------------------------------------------------------------

type ColumnSchemaEntry = {
  field: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'unknown'
  sampleValues: unknown[]
}

/**
 * Inspect the first N rows the grid is holding to infer a typed schema +
 * a handful of sample values per column. This is the context every AI
 * task needs and the most expensive thing to build, so the helpers cache
 * the result inside one task call rather than calling api.getData()
 * repeatedly.
 */
function buildColumnSchema<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(api: SvGridApi<TFeatures, TData>, sampleSize = 50): ColumnSchemaEntry[] {
  const data = api.getData()
  if (data.length === 0) return []
  const slice = data.slice(0, Math.min(data.length, sampleSize))
  const fields = new Set<string>()
  for (const row of slice) {
    for (const k of Object.keys(row as object)) fields.add(k)
  }
  const out: ColumnSchemaEntry[] = []
  for (const field of fields) {
    const values: unknown[] = []
    for (const row of slice) {
      const v = (row as Record<string, unknown>)[field]
      if (v != null) values.push(v)
      if (values.length >= 5) break
    }
    out.push({
      field,
      type: inferType(values),
      sampleValues: values,
    })
  }
  return out
}

function inferType(samples: unknown[]): ColumnSchemaEntry['type'] {
  if (samples.length === 0) return 'unknown'
  const v = samples[0]
  if (typeof v === 'number') return 'number'
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'string') {
    // Cheap ISO-date sniff so we route date-style filters correctly.
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return 'date'
    return 'string'
  }
  return 'unknown'
}

function schemaToPromptBlock(schema: ColumnSchemaEntry[]): string {
  return schema
    .map(
      (c) =>
        `- ${c.field} (${c.type}): e.g. ${c.sampleValues
          .slice(0, 3)
          .map((v) => JSON.stringify(v))
          .join(', ')}`,
    )
    .join('\n')
}

// ---------------------------------------------------------------------------
// 1. Natural-language filter / sort
// ---------------------------------------------------------------------------

export type AIFilterClause = {
  field: string
  operator: 'contains' | 'equals' | 'startsWith' | 'greaterThan' | 'lessThan' | 'isBlank'
  value?: string
}
export type AISortClause = { field: string; desc: boolean }

export type AIFilterResult = {
  filters: AIFilterClause[]
  sort: AISortClause[]
  /** Plain-English explanation of how the model interpreted the query.
   *  Surface this in the UI so the user can confirm or undo. */
  rationale: string
}

export type AIFilterOptions = {
  /**
   * When true, the helper not only RETURNS the plan but also applies it
   * to the grid via `api.setFilter` / `api.setSort`. Defaults to false
   * so callers can show a preview before committing.
   */
  apply?: boolean
  signal?: AbortSignal
}

/**
 * Translate a natural-language query into a filter+sort plan against
 * the current grid's columns. The grid passes the column schema (names,
 * types, sample values) to the model so it can pick the right field
 * names without hallucinating.
 */
export async function aiFilter<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  api: SvGridApi<TFeatures, TData>,
  query: string,
  opts: AIFilterOptions = {},
): Promise<AIFilterResult> {
  assertEnterpriseLicensed('AI assistant')
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

// ---------------------------------------------------------------------------
// 2. Smart fill
// ---------------------------------------------------------------------------

export type AISmartFillExample = { input: Record<string, unknown>; output: unknown }

export type AISmartFillResult<TValue = unknown> = {
  field: string
  predictions: Array<{ rowIndex: number; value: TValue; confidence: number }>
  rationale: string
}

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

/**
 * Given a column and a few user-provided examples, propose values for the
 * untouched rows. Returns predictions only - the caller chooses whether to
 * commit them via `api.setCellValue`. This is the right shape for an
 * accept-per-cell UX with confidence-coloured highlights.
 */
export async function aiSmartFill<
  TFeatures extends TableFeatures,
  TData extends RowData,
  TValue = unknown,
>(
  api: SvGridApi<TFeatures, TData>,
  opts: AISmartFillOptions,
): Promise<AISmartFillResult<TValue>> {
  assertEnterpriseLicensed('AI assistant')
  if (opts.examples.length === 0) {
    throw new Error('@svgrid/enterprise/ai: aiSmartFill requires at least one example.')
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

// ---------------------------------------------------------------------------
// 3. Summarise
// ---------------------------------------------------------------------------

export type AISummarizeTarget =
  | { kind: 'row'; rowIndex: number }
  | { kind: 'all' }
  | { kind: 'selection'; rowIndices: number[] }
  | { kind: 'group'; field: string; value: unknown }

export type AISummary = {
  text: string
  bullets: string[]
  /** Field names the model thinks are the most load-bearing for the
   *  story it just told. UI can highlight those columns. */
  highlightedFields: string[]
}

export type AISummarizeOptions = {
  target: AISummarizeTarget
  /** Optional question the user is trying to answer. Helps the model
   *  bias the summary toward the relevant columns. */
  question?: string
  signal?: AbortSignal
}

/**
 * Ask the model to summarise a slice of the grid. Caps the row sample at
 * a model-friendly size; for huge selections it samples uniformly so the
 * summary stays representative without blowing the context window.
 */
export async function aiSummarize<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  api: SvGridApi<TFeatures, TData>,
  opts: AISummarizeOptions,
): Promise<AISummary> {
  assertEnterpriseLicensed('AI assistant')
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

// ---------------------------------------------------------------------------
// 4. Classify (free-text -> bucketed value)
// ---------------------------------------------------------------------------

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

export type AIClassifyResult = {
  inputField: string
  outputField: string
  predictions: Array<{ rowIndex: number; value: string; confidence: number }>
}

/**
 * Bucket free-text cells into one of a known set of classes. The model
 * is constrained to pick from `opts.classes`; predictions outside the set
 * are dropped so the caller can rely on the output being clean enum
 * values it can write straight back into the grid.
 */
export async function aiClassify<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  api: SvGridApi<TFeatures, TData>,
  opts: AIClassifyOptions,
): Promise<AIClassifyResult> {
  assertEnterpriseLicensed('AI assistant')
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

// ---------------------------------------------------------------------------
// 5. Natural-language export
// ---------------------------------------------------------------------------

const EXPORT_FORMATS: ExportFormat[] = ['xlsx', 'xls', 'pdf', 'csv', 'tsv', 'html', 'json', 'xml', 'md']

export type AIExportPlan = {
  format: ExportFormat
  filters: AIFilterClause[]
  sort: AISortClause[]
  groupBy: string[]
  /** Plain-English explanation of how the model read the request. */
  rationale: string
}

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

/**
 * Turn a natural-language request ("export EU orders from Q2 as a grouped PDF")
 * into an export: the model returns a `{ format, filters, sort, groupBy }` plan
 * against the grid's columns; we apply the filter/sort to the grid and hand the
 * result to `exportGrid`. Returns the plan so the UI can show what it did (or
 * preview it first with `run: false`).
 */
export async function aiExport<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  api: SvGridApi<TFeatures, TData>,
  query: string,
  opts: AIExportOptions = {},
): Promise<AIExportPlan> {
  assertEnterpriseLicensed('AI assistant')
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

  if (opts.run !== false) {
    // Compute the export rows from the plan directly (filter + sort + make
    // contiguous by group) rather than reading the grid's reactive displayed
    // rows - so the download always has exactly the intended data.
    const exportRows = applyPlanToRows(api.getData(), plan)
    await exportGrid(api, {
      format: plan.format,
      filename: opts.filename ?? 'export',
      rows: exportRows,
      ...(plan.groupBy.length > 0 ? { groupBy: plan.groupBy } : {}),
    })
  }
  return plan
}

/** Evaluate one AI filter clause against a raw row value. */
function matchesClause(row: Record<string, unknown>, clause: AIFilterClause): boolean {
  const v = row[clause.field]
  const val = clause.value ?? ''
  switch (clause.operator) {
    case 'contains':
      return String(v ?? '').toLowerCase().includes(val.toLowerCase())
    case 'equals':
      return String(v ?? '').toLowerCase() === val.toLowerCase()
    case 'startsWith':
      return String(v ?? '').toLowerCase().startsWith(val.toLowerCase())
    case 'greaterThan':
      return Number(v) > Number(val)
    case 'lessThan':
      return Number(v) < Number(val)
    case 'isBlank':
      return v == null || v === ''
    default:
      return true
  }
}

/** Filter + sort + (stable) group the raw rows per an export plan. */
function applyPlanToRows<TData extends RowData>(
  data: ReadonlyArray<TData>,
  plan: AIExportPlan,
): TData[] {
  let rows: TData[] = data.slice()
  if (plan.filters.length > 0) {
    rows = rows.filter((r) =>
      plan.filters.every((f) => matchesClause(r as Record<string, unknown>, f)),
    )
  }
  const last = plan.sort[plan.sort.length - 1]
  if (last) {
    rows = [...rows].sort((a, b) => {
      const av = (a as Record<string, unknown>)[last.field]
      const bv = (b as Record<string, unknown>)[last.field]
      const na = Number(av)
      const nb = Number(bv)
      let cmp: number
      if (Number.isFinite(na) && Number.isFinite(nb)) cmp = na - nb
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''))
      return last.desc ? -cmp : cmp
    })
  }
  // Contiguous grouping (first-seen order) so PDF group rows + Excel outline
  // line up.
  if (plan.groupBy.length > 0) {
    const buckets = new Map<string, TData[]>()
    for (const r of rows) {
      const key = plan.groupBy
        .map((k) => String((r as Record<string, unknown>)[k] ?? ''))
        .join('')
      const bucket = buckets.get(key)
      if (bucket) bucket.push(r)
      else buckets.set(key, [r])
    }
    rows = [...buckets.values()].flat()
  }
  return rows
}

// ---------------------------------------------------------------------------
// 6. Find anomalies
// ---------------------------------------------------------------------------

export type AIAnomaly = {
  /** Index into the SCANNED rows (target order), when the model pins one row. */
  rowIndex?: number
  field?: string
  value?: unknown
  reason: string
  severity: 'low' | 'medium' | 'high'
}

export type AIAnomalyResult = {
  anomalies: AIAnomaly[]
  summary: string
}

export type AIAnomalyOptions = {
  /** Which rows to scan. Defaults to the whole dataset. */
  target?: AISummarizeTarget
  /** Optional focus, e.g. "look at pricing and margins". */
  question?: string
  signal?: AbortSignal
}

function sliceForTarget<TFeatures extends TableFeatures, TData extends RowData>(
  api: SvGridApi<TFeatures, TData>,
  target: AISummarizeTarget,
): TData[] {
  const all = api.getData()
  if (target.kind === 'row') {
    const r = all[target.rowIndex]
    return r ? [r] : []
  }
  if (target.kind === 'selection') {
    return target.rowIndices.map((i) => all[i]).filter((r): r is TData => r != null)
  }
  if (target.kind === 'group') {
    return all.filter((r) => (r as Record<string, unknown>)[target.field] === target.value)
  }
  return all.slice()
}

/**
 * Scan a slice of the grid (all / selection / group) for anomalies - outliers,
 * suspicious values, inconsistencies - and return a structured list plus a
 * one-line summary. Pairs naturally with an export: "find the odd ones, then
 * export just those".
 */
export async function aiFindAnomalies<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  api: SvGridApi<TFeatures, TData>,
  opts: AIAnomalyOptions = {},
): Promise<AIAnomalyResult> {
  assertEnterpriseLicensed('AI assistant')
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

// ---------------------------------------------------------------------------
// 7. Natural-language chart ("chart this")
// ---------------------------------------------------------------------------

export type AIChartType = 'bar' | 'line' | 'area' | 'pie'

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

export type AIChartOptions = {
  /** Apply the plan to the grid's chart panel (open + configure). Default false. */
  apply?: boolean
  signal?: AbortSignal
}

/**
 * Translate a natural-language request into a chart plan for the grid's built-in
 * `charting` panel. Validates every field against the real schema, then (with
 * `apply: true`) pushes it into the panel through `api.configureChart`.
 */
export async function aiChart<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  api: SvGridApi<TFeatures, TData>,
  query: string,
  opts: AIChartOptions = {},
): Promise<AIChartPlan> {
  assertEnterpriseLicensed('AI assistant')
  const schema = buildColumnSchema(api)
  const prompt =
    `You are a charting assistant for a data grid. Translate the user's request ` +
    `into a strict-JSON chart plan the grid can render.\n\n` +
    `Columns:\n${schemaToPromptBlock(schema)}\n\n` +
    `Output JSON schema:\n` +
    `{ "type": "bar"|"line"|"area"|"pie", ` +
    `"dimension": "<a categorical column to group by>", ` +
    `"series": "<a second categorical column to split into series, or null>", ` +
    `"measure": "<a numeric column to aggregate>", ` +
    `"reduce": "sum"|"avg"|"count", ` +
    `"stacked": true|false, ` +
    `"logScale": true|false, ` +
    `"timeAxis": true|false, ` +
    `"valueFormat": "number"|"currency"|"percent", ` +
    `"rationale": "<one-sentence explanation>" }\n\n` +
    `Rules: pick "dimension" and "series" from text/date columns and "measure" ` +
    `from a numeric column; use only column names from the list above; ` +
    `"stacked"/"stack" -> stacked:true; "log"/"logarithmic" -> logScale:true; ` +
    `"over time"/"by date"/a date dimension -> timeAxis:true; ` +
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
  const CHART_TYPES: AIChartType[] = ['bar', 'line', 'area', 'pie']
  plan.type = CHART_TYPES.includes(plan.type) ? plan.type : 'bar'
  plan.dimension = plan.dimension && valid.has(plan.dimension) ? plan.dimension : null
  plan.series = plan.series && valid.has(plan.series) && plan.series !== plan.dimension ? plan.series : null
  plan.measure =
    plan.measure && numericFields.has(plan.measure)
      ? plan.measure
      : (schema.find((c) => c.type === 'number')?.field ?? null)
  plan.reduce = ['sum', 'avg', 'count'].includes(plan.reduce) ? plan.reduce : 'sum'
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
    })
  }

  return plan
}

/**
 * Wire the grid's chart-panel AI button to the model: registers a handler (via
 * `api.setChartAiHandler`) that runs `aiChart` and returns the plan for the
 * panel to apply + explain. Call once after `onApiReady`. `installEnterprise`
 * calls this for you.
 */
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

export function disableAiCharting<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(api: SvGridApi<TFeatures, TData>): void {
  const hook = api as unknown as { setChartAiHandler?: (fn: null) => void }
  hook.setChartAiHandler?.(null)
}

// ---------------------------------------------------------------------------
// 8. Mock provider for examples + tests
// ---------------------------------------------------------------------------

/**
 * A deterministic provider that returns canned, schema-shaped responses
 * for each task. Wire it in via `setAIProvider(mockAIProvider)` to make
 * the AI demo work end-to-end without a real model key. Not for production.
 */
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

function buildMockChart(prompt: string): AIChartPlan {
  const q = extractUserRequest(prompt)
  const typed = extractFieldTypes(prompt)
  const textFields = typed.filter((f) => f.type === 'string' || f.type === 'date').map((f) => f.name)
  const numberFields = typed.filter((f) => f.type === 'number').map((f) => f.name)

  const type: AIChartType =
    /\bline\b|\btrend\b|over time/.test(q) ? 'line'
    : /\barea\b/.test(q) ? 'area'
    : /\bpie\b|share|proportion|breakdown/.test(q) ? 'pie'
    : 'bar'

  const byMatch = q.match(/\bby\s+([a-z0-9_ ]+?)(?:\s+(?:split|stacked|grouped|by|as|,|$))/)
  const pickText = (hint?: string): string | null => {
    if (hint) {
      const f = textFields.find((t) => t.toLowerCase() === hint.trim() || (hint.trim().length >= 4 && t.toLowerCase().includes(hint.trim())))
      if (f) return f
    }
    return null
  }
  const dimension = pickText(byMatch?.[1]) ?? textFields[0] ?? null
  const series =
    /\b(split|stack(?:ed)?|by product|by category|per)\b/.test(q)
      ? (textFields.find((t) => t !== dimension) ?? null)
      : null
  const measure = numberFields.find((n) => q.includes(n.toLowerCase())) ?? numberFields[0] ?? null
  const reduce: 'sum' | 'avg' | 'count' =
    /\b(average|avg|mean)\b/.test(q) ? 'avg' : /\b(count|number of|how many)\b/.test(q) ? 'count' : 'sum'
  const stacked = /\bstack(ed)?\b/.test(q)
  const logScale = /\b(log|logarithmic)\b/.test(q)
  const timeAxis = /\b(over time|by date|by day|by month|by week|time series|timeline|trend)\b/.test(q)
  const valueFormat: 'number' | 'currency' | 'percent' =
    /\b(currency|money|revenue|sales|price|cost|\$|dollar)\b/.test(q) || /(price|revenue|amount|cost|sales)/i.test(measure ?? '')
      ? 'currency'
      : /\b(percent|percentage|%|rate|share)\b/.test(q)
        ? 'percent'
        : 'number'

  return {
    type, dimension, series, measure, reduce, stacked, logScale, timeAxis, valueFormat,
    rationale:
      `${type} chart of ${reduce}(${measure ?? 'value'}) by ${dimension ?? 'category'}` +
      `${series ? `, split by ${series}` : ''}${stacked ? ', stacked' : ''}` +
      `${logScale ? ', log scale' : ''}${timeAxis ? ', date axis' : ''} (mock - wire a real model for genuine parsing).`,
  }
}

function extractUserRequest(prompt: string): string {
  const m = prompt.match(/User request:\s*([\s\S]+)$/)
  return (m?.[1] ?? '').trim().toLowerCase()
}

function buildMockExport(prompt: string): AIExportPlan {
  const q = extractUserRequest(prompt)
  const fields = extractFields(prompt)
  // Reuse the filter mock (it reads "User query:"; feed it a compatible line).
  const filterPlan = buildMockFilter(prompt + `\nUser query: ${q}\n`, q)

  // Format keyword routing.
  const format: ExportFormat =
    /\bpdf\b/.test(q) ? 'pdf'
    : /\bxls\b(?!x)/.test(q) || /97-2003|legacy excel/.test(q) ? 'xls'
    : /\b(xlsx|excel|spreadsheet|workbook)\b/.test(q) ? 'xlsx'
    : /\b(markdown|md)\b/.test(q) ? 'md'
    : /\bjson\b/.test(q) ? 'json'
    : /\bxml\b/.test(q) ? 'xml'
    : /\btsv\b/.test(q) ? 'tsv'
    : /\bhtml\b/.test(q) ? 'html'
    : /\bcsv\b/.test(q) ? 'csv'
    : 'xlsx'

  // Grouping: "group by X" / "grouped by X", else "grouped" -> a categorical field.
  const groupBy: string[] = []
  const byMatch = q.match(/group(?:ed)?\s+by\s+([a-z0-9_ ,]+)/)
  if (byMatch) {
    for (const token of byMatch[1]!.split(/[, ]+/).filter(Boolean)) {
      // Exact field match, or a substring match only for tokens long enough to
      // be meaningful (so "a"/"as" don't match "amount").
      const f = fields.find(
        (ff) => ff.toLowerCase() === token || (token.length >= 4 && ff.toLowerCase().includes(token)),
      )
      if (f && !groupBy.includes(f)) groupBy.push(f)
    }
  } else if (/\bgroup(ed)?\b/.test(q)) {
    const cat = fields.find((f) => /region|country|category|status|stage|type|group|dept|team/i.test(f))
    if (cat) groupBy.push(cat)
  }

  return {
    format,
    filters: filterPlan.filters,
    sort: filterPlan.sort,
    groupBy,
    rationale: `Export as ${format}${groupBy.length ? `, grouped by ${groupBy.join(' / ')}` : ''}${filterPlan.filters.length ? `; ${filterPlan.rationale}` : ''}`,
  }
}

function buildMockAnomaly(prompt: string): AIAnomalyResult {
  // Parse the sampled rows, flag the numeric outliers per numeric field.
  const rowsBlock = prompt.match(/Rows \(index is 0-based into this list\):\n([\s\S]*?)\n\n/)?.[1] ?? ''
  const parsed = rowsBlock
    .split('\n')
    .map((line) => {
      const m = line.match(/^(\d+):\s*(\{[\s\S]*\})$/)
      if (!m) return null
      const row = safeParse(m[2]!) as Record<string, unknown> | null
      return row ? { idx: parseInt(m[1]!, 10), row } : null
    })
    .filter((r): r is { idx: number; row: Record<string, unknown> } => !!r)

  if (parsed.length === 0) {
    return { anomalies: [], summary: 'No rows to scan (mock).' }
  }

  // Genuinely numeric fields only: every value is null or a real number (so
  // booleans like `inStock` and id-ish strings are excluded). Also skip
  // identifier / row-index columns - a max "id" isn't an anomaly.
  const isIdLike = (f: string) => /(^id$|_id$|index|idx|^#|guid|uuid|serial|rownum)/i.test(f)
  const numericFields = Object.keys(parsed[0]!.row).filter(
    (f) =>
      !isIdLike(f) &&
      parsed.some((p) => typeof p.row[f] === 'number') &&
      parsed.every((p) => p.row[f] == null || typeof p.row[f] === 'number'),
  )

  const anomalies: AIAnomaly[] = []
  for (const f of numericFields.slice(0, 2)) {
    let maxIdx = -1
    let maxVal = -Infinity
    for (const p of parsed) {
      const n = Number(p.row[f])
      if (Number.isFinite(n) && n > maxVal) {
        maxVal = n
        maxIdx = p.idx
      }
    }
    if (maxIdx >= 0) {
      anomalies.push({
        rowIndex: maxIdx,
        field: f,
        value: maxVal,
        reason: `${f} = ${maxVal} is the highest in the sample and may be an outlier`,
        severity: 'medium',
      })
    }
  }

  return {
    anomalies,
    summary:
      anomalies.length > 0
        ? `Flagged ${anomalies.length} potential outlier${anomalies.length === 1 ? '' : 's'} (mock heuristic - wire a real model for genuine analysis).`
        : 'No obvious anomalies in the sample (mock).',
  }
}

function extractUserQuery(prompt: string): string {
  const m = prompt.match(/User query:\s*(.+?)\n/)
  return (m?.[1] ?? '').toLowerCase()
}

function extractFields(prompt: string): string[] {
  const m = prompt.match(/Columns:\n([\s\S]*?)\n\n/)
  if (!m) return []
  return (m[1] ?? '')
    .split('\n')
    .map((l) => l.match(/^- (\w+)/)?.[1])
    .filter((s): s is string => !!s)
}

/** Parse the "- name (type): ..." schema block into {name, type} pairs. */
function extractFieldTypes(prompt: string): Array<{ name: string; type: string }> {
  const m = prompt.match(/Columns:\n([\s\S]*?)\n\n/)
  if (!m) return []
  return (m[1] ?? '')
    .split('\n')
    .map((l) => {
      const mm = l.match(/^- (\w+)\s*\((\w+)\)/)
      return mm ? { name: mm[1]!, type: mm[2]! } : null
    })
    .filter((x): x is { name: string; type: string } => !!x)
}

function buildMockFilter(prompt: string, q: string): AIFilterResult {
  const fields = extractFields(prompt)
  const filters: AIFilterClause[] = []
  const sort: AISortClause[] = []
  const rationale: string[] = []

  // Greedy keyword routing. Real model would be smarter; this only needs
  // to convince the demo viewer the pipeline works.
  const numberWord = q.match(/(?:over|above|>|greater than)\s+\$?([\d.,]+)([kmb])?/)
  const lessWord   = q.match(/(?:under|below|<|less than)\s+\$?([\d.,]+)([kmb])?/)
  // Pick a NUMBER-typed field (never a boolean like `inStock`), money-named
  // ones first so "$300" targets price/amount rather than a count/index.
  const numberTyped = extractFieldTypes(prompt).filter((f) => f.type === 'number').map((f) => f.name)
  const moneyRe = /(price|amount|cost|revenue|total|value|salary|arr|fee|spend|budget|sales)/i
  const numberPool = numberTyped.length > 0 ? numberTyped : fields
  const numberFields = [
    ...numberPool.filter((f) => moneyRe.test(f)),
    ...numberPool.filter((f) => !moneyRe.test(f)),
  ]

  if (numberWord && numberFields[0]) {
    const raw = parseFloat(numberWord[1]!.replace(/,/g, ''))
    const mul = numberWord[2] === 'k' ? 1_000 : numberWord[2] === 'm' ? 1_000_000 : numberWord[2] === 'b' ? 1_000_000_000 : 1
    filters.push({ field: numberFields[0], operator: 'greaterThan', value: String(raw * mul) })
    rationale.push(`amount > ${raw}${numberWord[2] ?? ''}`)
  } else if (lessWord && numberFields[0]) {
    const raw = parseFloat(lessWord[1]!.replace(/,/g, ''))
    const mul = lessWord[2] === 'k' ? 1_000 : lessWord[2] === 'm' ? 1_000_000 : 1
    filters.push({ field: numberFields[0], operator: 'lessThan', value: String(raw * mul) })
    rationale.push(`amount < ${raw}${lessWord[2] ?? ''}`)
  }

  // Quoted phrases -> contains on a likely text field.
  const quote = q.match(/"([^"]+)"|'([^']+)'/)
  const textFields = fields.filter((f) => /(name|company|customer|title|owner|status|region|category|industry)/i.test(f))
  if (quote) {
    const term = quote[1] ?? quote[2] ?? ''
    if (textFields[0]) {
      filters.push({ field: textFields[0], operator: 'contains', value: term })
      rationale.push(`text contains "${term}"`)
    }
  }

  // Person-name routing -> match owner/contact fields.
  const personOwners = ['sasha', 'jamie', 'casey', 'drew', 'robin', 'morgan', 'riley', 'quinn']
  for (const n of personOwners) {
    if (q.includes(n)) {
      const ownerField = fields.find((f) => /owner|rep|assigned/i.test(f)) ?? fields.find((f) => /name/i.test(f))
      if (ownerField) {
        filters.push({ field: ownerField, operator: 'contains', value: n })
        rationale.push(`owner ~ "${n}"`)
        break
      }
    }
  }

  // Region routing.
  for (const r of ['NA', 'EMEA', 'APAC', 'LATAM']) {
    if (q.toUpperCase().includes(r)) {
      const regionField = fields.find((f) => /region/i.test(f))
      if (regionField) {
        filters.push({ field: regionField, operator: 'equals', value: r })
        rationale.push(`region = ${r}`)
        break
      }
    }
  }

  // Status routing - any token in the query that matches a known status.
  for (const s of ['active', 'pending', 'won', 'lost', 'live', 'paused', 'shipped', 'delivered']) {
    if (q.includes(s)) {
      const f = fields.find((f) => /status|stage/i.test(f))
      if (f) {
        filters.push({ field: f, operator: 'equals', value: s })
        rationale.push(`status = ${s}`)
        break
      }
    }
  }

  // Sort detection.
  if (/(highest|largest|biggest|top|most)/.test(q)) {
    const f = numberFields[0]
    if (f) { sort.push({ field: f, desc: true }); rationale.push(`sort by ${f} desc`) }
  } else if (/(lowest|smallest|least|cheapest)/.test(q)) {
    const f = numberFields[0]
    if (f) { sort.push({ field: f, desc: false }); rationale.push(`sort by ${f} asc`) }
  } else if (/(newest|recent|latest)/.test(q)) {
    const dateField = fields.find((f) => /date|at|time/i.test(f))
    if (dateField) { sort.push({ field: dateField, desc: true }); rationale.push(`sort by ${dateField} desc`) }
  } else if (/(oldest)/.test(q)) {
    const dateField = fields.find((f) => /date|at|time/i.test(f))
    if (dateField) { sort.push({ field: dateField, desc: false }); rationale.push(`sort by ${dateField} asc`) }
  }

  return {
    filters,
    sort,
    rationale: rationale.length
      ? `Interpreted: ${rationale.join(' AND ')}.`
      : `Couldn't identify a clear filter for "${q}". Showing all rows.`,
  }
}

function buildMockSmartFill(prompt: string): { predictions: Array<{ rowIndex: number; value: unknown; confidence: number }>; rationale: string } {
  // Extract the target column and the rows-to-fill block; copy the first
  // example's "output" pattern verbatim so the demo always returns
  // something believable. Real models do much better - that's the point.
  const fieldMatch = prompt.match(/Target column:\s*(\w+)/)
  const rowsMatch = prompt.match(/Rows to fill:\n([\s\S]*?)\n\n/)
  const exMatch = prompt.match(/Example 1: input=.* -> output=(.+)/)
  const targetField = fieldMatch?.[1] ?? ''
  const rowLines = (rowsMatch?.[1] ?? '').split('\n').filter(Boolean)
  const exampleOutput = exMatch?.[1] ? safeParse(exMatch[1]) : ''
  const predictions = rowLines
    .map((line) => {
      const m = line.match(/^Row (\d+): (\{.+\})/)
      if (!m) return null
      const rowIndex = parseInt(m[1]!, 10)
      const row = safeParse(m[2]!) as Record<string, unknown> | null
      if (!row) return null
      const value = inferFromRow(targetField, row, exampleOutput)
      return { rowIndex, value, confidence: 0.78 + Math.random() * 0.18 }
    })
    .filter((p): p is { rowIndex: number; value: unknown; confidence: number } => !!p)
  return {
    predictions,
    rationale: `Inferred from ${exMatch ? 'the supplied' : 'no'} examples; mocked deterministically for the demo.`,
  }
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s) } catch { return null }
}

function inferFromRow(field: string, row: Record<string, unknown>, exampleOutput: unknown): unknown {
  // Mock heuristics that produce a value that "looks right" in common
  // demo scenarios. The real provider would route through a real model.
  if (field === 'priority') {
    const arr = Number(row.arr ?? row.amount ?? row.price ?? 0)
    return arr > 100_000 ? 'high' : arr > 30_000 ? 'medium' : 'low'
  }
  if (field === 'tier') {
    const arr = Number(row.arr ?? row.amount ?? 0)
    return arr > 500_000 ? 'enterprise' : arr > 100_000 ? 'growth' : 'starter'
  }
  if (field === 'tags' || field === 'category') {
    return typeof exampleOutput === 'string' ? exampleOutput : 'auto-tag'
  }
  if (typeof exampleOutput === 'string') return exampleOutput
  if (typeof exampleOutput === 'number') return exampleOutput
  return exampleOutput ?? 'auto'
}

function buildMockSummary(prompt: string): AISummary {
  const sliceMatch = prompt.match(/Slice size: (\d+) row/)
  const n = sliceMatch ? parseInt(sliceMatch[1]!, 10) : 0
  const fields = extractSummaryFields(prompt)
  return {
    text:
      n === 1
        ? `Single record. Notable signals come from ${fields.slice(0, 2).join(' and ') || 'the available fields'}.`
        : `${n} rows in scope. The distribution skews toward live / active records, with a long tail in ${fields[0] ?? 'amount'}.`,
    bullets: [
      `${n} row${n === 1 ? '' : 's'} sampled`,
      fields[0] ? `Largest variance in ${fields[0]}` : 'Tight clustering across visible fields',
      fields[1] ? `${fields[1]} concentrates around the median` : 'Few outliers',
      'Mock summary - wire setAIProvider() to a real model for actual analysis',
    ],
    highlightedFields: fields.slice(0, 3),
  }
}

function extractSummaryFields(prompt: string): string[] {
  const m = prompt.match(/Columns:\n([\s\S]*?)\n\n/)
  if (!m) return []
  return (m[1] ?? '')
    .split('\n')
    .map((l) => l.match(/^- (\w+)/)?.[1])
    .filter((s): s is string => !!s)
}

function buildMockClassify(prompt: string): { predictions: Array<{ rowIndex: number; value: string; confidence: number }> } {
  const labelsMatch = prompt.match(/Allowed labels[\s\S]*?:\n([\s\S]*?)\n\n/)
  // Capture the label up to the first colon, whitespace or end-of-line so
  // we don't pick up the rubric ("- at-risk: churn signals..." -> "at-risk").
  const labels = (labelsMatch?.[1] ?? '')
    .split('\n')
    .map((l) => l.match(/^-\s*([^\s:]+)/)?.[1])
    .filter((s): s is string => !!s)
  const rowLines = (prompt.match(/Rows to classify[\s\S]*?:\n([\s\S]*?)\n\n/)?.[1] ?? '').split('\n').filter(Boolean)
  const predictions = rowLines.map((line) => {
    const m = line.match(/^Row (\d+): "(.*)"/)
    if (!m || labels.length === 0) return null
    const rowIndex = parseInt(m[1]!, 10)
    const text = (m[2] ?? '').toLowerCase()
    // Pick the label whose token appears in the text; otherwise hash.
    const hit = labels.find((l) => text.includes(l.toLowerCase()))
    const value = hit ?? labels[Math.abs(hashStr(text)) % labels.length]!
    return { rowIndex, value, confidence: hit ? 0.92 : 0.6 + Math.random() * 0.2 }
  }).filter((p): p is { rowIndex: number; value: string; confidence: number } => !!p)
  return { predictions }
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
