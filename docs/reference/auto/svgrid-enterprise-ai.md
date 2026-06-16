# `@svgrid/enterprise` · `ai.ts`

Auto-generated. Source: `packages\enterprise\src\ai.ts`.

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

_No JSDoc yet._

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

_No JSDoc yet._

```ts
export type AITask = 'filter' | 'smart-fill' | 'summarize' | 'classify'
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

_No JSDoc yet._

```ts
export function getAIProvider(): AIProvider | null {
  return provider
}
```

### `function hasAIProvider`

_No JSDoc yet._

```ts
export function hasAIProvider(): boolean {
  return provider != null
}
```

### `type AIFilterClause`

_No JSDoc yet._

```ts
export type AIFilterClause = {
  field: string
  operator: 'contains' | 'equals' | 'startsWith' | 'greaterThan' | 'lessThan' | 'isBlank'
  value?: string
}
```

### `type AISortClause`

_No JSDoc yet._

```ts
export type AISortClause = { field: string; desc: boolean }
```

### `type AIFilterResult`

_No JSDoc yet._

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

_No JSDoc yet._

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

_No JSDoc yet._

```ts
export type AISmartFillExample = { input: Record<string, unknown>; output: unknown }
```

### `type AISmartFillResult`

_No JSDoc yet._

```ts
export type AISmartFillResult<TValue = unknown> = {
  field: string
  predictions: Array<{ rowIndex: number; value: TValue; confidence: number }>
  rationale: string
}
```

### `type AISmartFillOptions`

_No JSDoc yet._

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

_No JSDoc yet._

```ts
export type AISummarizeTarget =
```

### `type AISummary`

_No JSDoc yet._

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

_No JSDoc yet._

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

_No JSDoc yet._

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

_No JSDoc yet._

```ts
export type AIClassifyResult = {
  inputField: string
  outputField: string
  predictions: Array<{ rowIndex: number; value: string; confidence: number }>
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
  return '{}'
}
```
