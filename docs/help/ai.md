# AI assistant - Enterprise

Bring a language model into your grid with four helpers that stay
strictly model-agnostic: **natural-language filter**, **smart fill**,
**summarise**, and **classify**. Ships in the paid
**[@svgrid/enterprise](https://www.npmjs.com/package/@svgrid/enterprise)** add-on; the
Community build does not include these features.

Run all four helpers live - the demo below is wired to the bundled
deterministic `mockAIProvider`, so no keys required:

<div data-docs-demo="51-ai-assistant" data-height="560"></div>


## What it is

`installEnterprise(api)` (the same call you use for export and print) augments
your `SvGridApi` with an `ai` namespace:

```ts
api.ai.filter(query, opts?)        // NL query -> filter + sort plan
api.ai.smartFill(opts)             // examples -> proposed column values
api.ai.summarize(opts)             // row / selection / group / all -> text + bullets
api.ai.classify(opts)              // free-text cells -> bucketed labels
```

Every call routes through one `AIProvider` you register at app boot.
The grid never bundles a model client - you keep full control of model
choice, routing, and data handling.

## When to use it

- **NL filter** is the highest-leverage feature: it replaces a dozen
  per-column filter operators with one search box for analyst users.
- **Smart fill** is the killer feature for spreadsheet-style entry: type
  one or two examples in a column, accept the rest with one click.
- **Summarise** is for dashboards where the user wants a "what's
  interesting here?" paragraph without clicking through every cell.
- **Classify** is for triage workflows where free-text rows need a
  consistent bucket label before downstream automation runs.

If you don't need natural-language anywhere, skip this module entirely -
the rest of `@svgrid/enterprise` doesn't depend on it.

## Setting up the provider

The grid talks to your model through a single async function. Wire it
once at app startup:

```ts
import { setAIProvider, type AIProvider } from '@svgrid/enterprise'

const myProvider: AIProvider = async ({ prompt, responseFormat, signal, task, maxOutputTokens }) => {
  const r = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, responseFormat, task, maxOutputTokens }),
    signal,
  })
  if (!r.ok) throw new Error(`AI provider returned ${r.status}`)
  return r.text()
}

setAIProvider(myProvider)
```

A few design points worth knowing:

- **`responseFormat: 'json'`** is what `aiFilter`, `aiSmartFill`,
  `aiSummarize`, and `aiClassify` all request. Tell your model to return
  strict JSON only; the grid `JSON.parse`s the result. (A common
  resilience trick: the grid strips a single markdown code fence
  automatically so models that wrap JSON in ` ```json ... ``` ` still
  parse cleanly.)
- **`signal`** is forwarded so consumers can cancel in-flight calls
  when the user moves on.
- **`task`** is a tag (`'filter' | 'smart-fill' | 'summarize' | 'classify'`)
  - useful when you want to route different tasks to different models
  (a cheap one for filter, a stronger one for summarise).
- **`maxOutputTokens`** is a soft hint, also useful for cost routing.

For testing or for demo purposes, the package ships a deterministic
`mockAIProvider` that returns plausible canned shapes per task. Wire it
in development:

```ts
import { setAIProvider, mockAIProvider } from '@svgrid/enterprise'
setAIProvider(mockAIProvider)
```

## 1. Natural-language filter

Translate a sentence into a filter + sort plan against the current
grid's columns. The grid embeds the column schema (names, types, sample
values) in the prompt so the model picks real field names rather than
hallucinating.

```ts
const plan = await api.ai.filter('accounts losing momentum in EMEA, by NPS')
// {
//   filters: [
//     { field: 'region', operator: 'equals', value: 'EMEA' },
//     { field: 'nps',    operator: 'lessThan', value: '30' },
//   ],
//   sort: [{ field: 'nps', desc: false }],
//   rationale: 'EMEA region, low NPS, sorted ascending.',
// }
```

By default `aiFilter` returns the plan but **does not apply it** to the
grid - that lets you show a preview ("here's what I'd do, accept?")
before committing. Pass `{ apply: true }` to apply directly:

```ts
await api.ai.filter('big EMEA deals', { apply: true })
```

### Hallucination guard

If the model invents a column name that doesn't exist in your data, the
helper silently drops that clause rather than passing it to `setFilter`,
which would otherwise throw. This is intentional: you'd rather lose a
clause than crash the page.

## 2. Smart fill

User provides one or two worked examples for a column; the grid asks
the model to propose values for the remaining empty cells.

```ts
const result = await api.ai.smartFill({
  field: 'tier',
  examples: [
    { input: { company: 'Northwind' }, output: 'enterprise' },
    { input: { company: 'Helios' },    output: 'growth' },
  ],
})
// result.predictions: [{ rowIndex, value, confidence }, ...]
```

You decide what to do with the predictions - accept-all, accept-per-cell,
write them to a `proposedTier` field on the row data and render a "✓"
button in the cell, etc. The example demo does per-cell accept with a
confidence-coloured pill.

If `targetRowIndices` is omitted, the helper auto-selects rows whose
current `field` value is `null`, `undefined`, or `''`.

## 3. Summarise

Drop a slice of the grid into the model and ask for a one-paragraph +
bulleted summary. Four target modes:

```ts
await api.ai.summarize({ target: { kind: 'all' } })
await api.ai.summarize({ target: { kind: 'row', rowIndex: 5 } })
await api.ai.summarize({ target: { kind: 'selection', rowIndices: [1,2,3] } })
await api.ai.summarize({ target: { kind: 'group', field: 'region', value: 'EMEA' } })
```

For large slices the grid samples rows uniformly so the prompt stays
under a sensible token budget. The response shape:

```ts
{
  text: 'One paragraph...',
  bullets: ['punchy bullet 1', 'punchy bullet 2', ...],
  highlightedFields: ['arr', 'nps'],   // columns the summary leans on
}
```

The optional `question` parameter biases the summary toward the columns
that answer the question.

## 4. Classify

Bucket free-text cells into one of a known set of labels:

```ts
const r = await api.ai.classify({
  inputField: 'notes',
  outputField: 'sentiment',
  classes: ['at-risk', 'expanding', 'steady'],
  classDescriptions: {
    'at-risk':   'churn signals, escalations, lost champion',
    'expanding': 'new modules, more seats, additional regions',
    'steady':    'no signals in either direction',
  },
})
```

The helper filters out any predictions whose value is not in `classes`,
so downstream code can trust the output is a clean enum.

## Subscribing the grid to predictions

Cell snippets cache their output by `(row, column)`. If you store
predictions in a *separate* state ref - e.g. a `Map<rowIndex, value>`
that the snippet looks up at render time - the grid won't know to
re-render when that map changes. **Write the proposal onto the row
itself instead:**

```ts
async function runClassify() {
  const result = await api.ai.classify({ /* ... */ })
  const byIdx = new Map(result.predictions.map((p) => [p.rowIndex, p]))
  // Re-assign the data array - Svelte 5 reactivity picks this up and the
  // grid re-renders every visible cell.
  accounts = accounts.map((a, i) => {
    const p = byIdx.get(i)
    return p ? { ...a, proposedSentiment: p.value, sentimentConfidence: p.confidence } : a
  })
}
```

Then your cell snippet reads `props.row.proposedSentiment` and re-renders
exactly when expected.

## License gate

Every AI call routes through the same polite license gate as `exportData`
and `print`:

- **No key set** → call still runs, the grid shows an "unlicensed"
  watermark and the console logs a one-time nudge directing the user to
  pricing. This is intentional for demos and evaluation.
- **`SVENTERPRISE-DEV-...` / `SVENTERPRISE-EVAL-...`** → call runs, a one-time
  `console.info` notes that the key is not for production.
- **Other valid `SVENTERPRISE-` key** → call runs silently.
- **Malformed prefix or revoked key** → call throws.

## See also

- [Demo 21 - Export + Print](../../examples/src/demos/21-export-and-print.svelte) - the other Enterprise
  surface, installed by the same `installEnterprise(api)` call.
- [Demo 51 - AI assistant](../../examples/src/demos/51-ai-assistant.svelte) - the full demo this
  page documents, with all four helpers wired to the mock provider.

## Frequently asked questions

### What AI features does SvGrid have?

The `@svgrid/enterprise` AI assistant ships four model-agnostic helpers:
natural-language filter, smart fill, summarise, and classify. They run through a
bring-your-own-model adapter, so you wire in your own LLM endpoint.

### Which LLM does SvGrid use?

None by default - it is model-agnostic. You supply an adapter for OpenAI,
Anthropic Claude, a local model, or anything else. The demo ships a mock
provider so you can evaluate the flow without an API key.

### Is my grid data sent to an AI provider?

Only if you wire one up and invoke a helper. SvGrid itself makes no network
calls; the AI helpers send exactly the prompt you construct to the adapter you
configure, so you control what leaves the browser.
