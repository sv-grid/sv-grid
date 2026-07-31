# AI Toolkit

Everything SvGrid ships for building with language models, in one place.
The toolkit spans two axes: **AI inside your running app** (helpers your
users invoke - natural-language filter, smart fill, summarise, classify)
and **AI inside your editor** (the MCP server + grounding files that make
Claude, Cursor, and friends write correct SvGrid code).

Nothing here bundles a model. SvGrid is **model-agnostic and
bring-your-own-key**: you register one adapter and keep full control of
model choice, routing, and what data leaves the browser.

<div data-docs-demo="51-ai-assistant" data-height="560"></div>

## The two surfaces

| | AI in your app (runtime) | AI in your editor (build time) |
| --- | --- | --- |
| **Who invokes it** | your end users | you and your coding agent |
| **What it does** | filter / fill / summarise / classify / export the live grid | scaffold columns, generate CRUD screens, answer API questions |
| **Package** | `@svgrid/enterprise` (`api.ai.*`) | `@sv-grid/mcp-server`, `@svgrid/mcp`, grounding files |
| **Needs a model key** | yes - the one you register | no - your agent brings its own |
| **Deep dive** | [AI assistant](./ai.md) | [MCP server](./mcp-server.md) · [LLM grounding](./llm-grounding.md) |

Most teams use both: the MCP server to write the grid, the in-grid
helpers to power features inside it.

## How it works

The grid never calls a model directly. Every runtime AI call routes
through a single async **provider** you register once at app boot:

```ts
import { setAIProvider, type AIProvider } from '@svgrid/enterprise'

const provider: AIProvider = async ({ prompt, responseFormat, signal, task }) => {
  const r = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, responseFormat, task }),
    signal,
  })
  if (!r.ok) throw new Error(`AI provider returned ${r.status}`)
  return r.text()
}

setAIProvider(provider)
```

Three design choices make this robust:

- **Structured JSON, validated.** Helpers request `responseFormat: 'json'`
  and the grid `JSON.parse`s the reply. It strips a single markdown code
  fence automatically, so a model that wraps output in ` ```json ... ``` `
  still parses. On malformed output you get a typed error, not a silent
  wrong result.
- **The prompt is grounded in your columns.** Before each call the grid
  embeds the live column schema (names, types, sampled values) into the
  prompt, so the model picks real field names instead of inventing them.
- **A hallucination guard on the way back.** If a model still returns a
  column that does not exist, the clause is dropped rather than passed to
  `setFilter` - you lose a clause, never crash the page.

The provider shape is deliberately tiny (one async call, `text` or `json`
response) so the same adapter drives an OpenAI `chat.completions` call, an
Anthropic `messages` call, a self-hosted endpoint, or a server-side proxy.
No model client is ever bundled into your grid.

> **Just evaluating?** The package ships a deterministic `mockAIProvider`
> that returns plausible canned shapes per task. Wire it in with
> `setAIProvider(mockAIProvider)` and every helper works end to end with
> no key. The demo above runs on it.

## In-grid helpers

`installEnterprise(api)` - the same call you use for export and print -
augments your `SvGridApi` with an `ai` namespace. Six helpers, all
model-agnostic:

```ts
api.ai.filter(query, opts?)     // NL sentence  -> filter + sort plan
api.ai.smartFill(opts)          // 1-2 examples -> proposed column values
api.ai.summarize(opts)          // row/selection/group/all -> text + bullets
api.ai.classify(opts)           // free-text cells -> a clean enum label
api.ai.export(query, opts?)     // NL sentence  -> filter + group + format, then export
api.ai.findAnomalies(opts?)     // scan a slice  -> outliers + severity
```

### Natural-language filter

The highest-leverage feature: replace a dozen per-column filter operators
with one search box.

```ts
const plan = await api.ai.filter('accounts losing momentum in EMEA, by NPS')
// {
//   filters: [
//     { field: 'region', operator: 'equals',   value: 'EMEA' },
//     { field: 'nps',    operator: 'lessThan', value: '30' },
//   ],
//   sort: [{ field: 'nps', desc: false }],
//   rationale: 'EMEA region, low NPS, sorted ascending.',
// }
```

By default it **returns the plan without applying it**, so you can show a
"here is what I would do, accept?" preview and surface the `rationale`.
Pass `{ apply: true }` to commit straight to the grid.

### Smart fill

The killer feature for spreadsheet-style entry: type one or two examples
in a column, let the model propose the rest.

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

You choose what to do with the predictions - accept-all, accept-per-cell
with a confidence pill, or write them onto the row for review.

### Summarise, classify, export, anomalies

- **`summarize`** drops a slice (row / selection / group / all) into the
  model and returns a paragraph, bullets, and the fields the story leans
  on. Large slices are sampled uniformly to stay under a token budget.
- **`classify`** buckets free-text cells into a known set of labels, and
  filters out any prediction not in your `classes` list so the output is a
  clean enum.
- **`export`** turns "export EU orders from Q2 as a grouped PDF by
  country" into a `{ format, filters, sort, groupBy }` plan and hands it to
  the exporter - self-contained, so the download is correct regardless of
  the grid's current view.
- **`findAnomalies`** scans a slice for outliers and inconsistent values,
  each tagged `low | medium | high`. Pairs naturally with export: find the
  odd rows, then export just those.

Full API, response shapes, and the license gate are on the
[AI assistant](./ai.md) page.

## Build an agent that drives the grid

The imperative `SvGridApi` is a clean tool surface - each method becomes
one function a model can call. Three patterns, in order of how much agency
you hand over:

1. **Read-only summary agent** - the model describes the current view
   (`api.getDisplayedRows()`), no tool calling.
2. **Stateful UI agent** - the model calls `setFilter` / `setSort` /
   `setGroupBy` in response to natural language, bounded by a max-turns loop.
3. **Autonomous workflow agent** - the grid is one node in a longer chain
   (import -> enrich -> human approval -> export), and the visible table is
   the state a human can audit between steps.

```ts
// Pattern 2, sketched: each SvGridApi method is one tool the model can call.
switch (call.function.name) {
  case 'setFilter':       api.setFilter(args.columnId, args); break
  case 'setSort':         api.setSort(args.columnId, args.direction); break
  case 'setGroupBy':      api.setGroupBy(args.columnIds); break
  case 'clearAllFilters': api.clearAllFilters(); break
}
```

Full worked code, the sandboxing rules (whitelist tools, validate every
argument against the shipped JSON Schemas, bound the loop), and the common
failure modes are on the [Agents](./agents.md) page.

## MCP server: let your coding agent write the grid

The [MCP server](./mcp-server.md) exposes SvGrid to AI clients (Claude
Desktop, Cursor, Zed, Continue, custom agents) over the Model Context
Protocol. It grounds the model in the schemas the library actually ships,
so your assistant retrieves version-pinned facts instead of hallucinating
an API from its training cutoff. No API key, all local.

```json
{
  "mcpServers": {
    "sv-grid": { "command": "npx", "args": ["-y", "@sv-grid/mcp-server"] }
  }
}
```

It registers callable tools - `searchDocs`, `getDocPage`, `scaffoldColumns`
(sample row -> `ColumnDef[]`), `validateColumns`, `previewExport`,
`listDemos` - plus read-only resources (the docs manifest and JSON Schemas)
and pre-built prompts (`/svgrid:scaffold-grid`, `/svgrid:refactor-to-pivot`,
`/svgrid:wire-server-side`).

For **Studio** (turning a database or schema into a CRUD data-app), the
separate [`@svgrid/mcp`](../enterprise/studio/ai-generation.md) server adds
`introspect_source` and `scaffold_entity`. The generated screen is run
through the Svelte compiler before it comes back, and each file carries
`svgrid:managed` markers so a re-generation updates the managed regions and
leaves your hand-written code untouched.

## Ground any model, no MCP required

If you are not on an MCP client, four static artefacts ship with the docs
so any model can ground itself in current facts:

| File | Use for |
| --- | --- |
| [`/llms.txt`](/llms.txt) | First-pass context: the topic map with one-line summaries |
| [`/llms-full.txt`](/llms-full.txt) | Deep grounding: every doc page concatenated |
| [`/docs.json`](/docs.json) | Programmatic crawling: section tree + per-page metadata |
| [`/schemas/index.json`](/schemas/index.json) | Validation: machine-checkable `ColumnDef`, `<SvGrid>` props, export options |

Upload `llms-full.txt` into a custom GPT or Claude project, drop a rules
block into `.cursorrules`, or fetch the topic map into your own agent's
system prompt at boot. All four are regenerated on every commit and served
from the docs origin. Full recipes are on the
[LLM grounding](./llm-grounding.md) page.

## Best practices

**Prompting the in-grid helpers.** These are handled for you - the grid
already embeds the column schema and samples rows before each call - but
if you customise the prompt on your provider side:

- Keep the live column set in front of the model every turn; it is the
  single biggest defence against invented field names.
- Include a few sample rows so the model learns value shapes (region codes,
  date formats, enum spellings).
- State the column ids exactly, including case - ids are case-sensitive
  (`snake_case` vs `PascalCase` matters).

**Previewing before committing.** `filter` and `export` default to
returning a plan without touching the grid. Show the `rationale`, let the
user confirm, then apply. This is the pattern that makes NL features feel
trustworthy rather than magic-that-sometimes-breaks.

**Cost routing.** The `task` tag (`filter | smart-fill | summarize |
classify`) and the `maxOutputTokens` hint let you route a cheap model for
filters and a stronger one for summaries from inside your one adapter.

**Data handling.** The grid makes no network calls of its own - the AI
helpers send exactly the prompt you construct to the adapter you configure.
Route through your own `/api/ai` proxy if you need to redact, log, or keep
data within a boundary before it reaches a provider.

## Examples

- **[Demo 51 - AI assistant](../../examples/src/demos/51-ai-assistant.svelte)** -
  all six helpers wired to the mock provider, per-cell accept with
  confidence pills.
- **[AI Smart Paste](./ai-smart-paste.md)** - parse vCard / Markdown /
  signature blocks / CSV into typed rows, with email-typo correction and
  phone normalisation.

## API reference

| Symbol | Package | What it is |
| --- | --- | --- |
| `setAIProvider(p)` | `@svgrid/enterprise` | Register the model adapter every AI call routes through. `null` clears it. |
| `mockAIProvider` | `@svgrid/enterprise` | Deterministic canned provider for demos and tests. |
| `type AIProvider` | `@svgrid/enterprise` | `(req: AIRequest) => Promise<string>` - the one function you implement. |
| `api.ai.filter` / `smartFill` / `summarize` / `classify` / `export` / `findAnomalies` | `@svgrid/enterprise` | The in-grid helpers, added by `installEnterprise(api)`. |
| `scaffoldColumns`, `validateColumns`, `previewExport`, ... | `@sv-grid/mcp-server` | Build-time MCP tools your coding agent calls. |
| `introspect_source`, `scaffold_entity` | `@svgrid/mcp` | Studio generation tools (schema -> CRUD screen). |

Auto-generated per-symbol reference: [`@svgrid/enterprise` · `ai.ts`](../reference/auto/svgrid-enterprise-ai.md).

## See also

- [AI assistant - Enterprise](./ai.md) - the in-grid helpers in full, with response shapes and the license gate
- [Agents](./agents.md) - build an agent that drives the live grid
- [Agent Skill](./skill.md) - always-on, project-aware context and house style for coding assistants
- [MCP server](./mcp-server.md) - turnkey integration for Claude Desktop / Cursor / Zed
- [LLM grounding](./llm-grounding.md) - the static files any model reads
- [AI generation - Studio](../enterprise/studio/ai-generation.md) - scaffold CRUD data-apps from a schema

## Frequently asked questions

### What AI features does SvGrid have?

Two kinds. At runtime, the `@svgrid/enterprise` AI assistant adds six
model-agnostic helpers to the grid - natural-language filter, smart fill,
summarise, classify, export, and anomaly detection. At build time, an MCP
server plus grounding files let your coding agent write correct SvGrid code
and scaffold CRUD screens.

### Which model does SvGrid use?

None by default - it is bring-your-own. You register one adapter for
OpenAI, Anthropic Claude, a local model, or a server proxy, and the grid
routes every AI call through it. A deterministic mock provider ships so you
can evaluate the whole flow without a key.

### Is my grid data sent to a model provider?

Only if you wire one up and invoke a helper. SvGrid itself makes no network
calls; the AI helpers send exactly the prompt you construct to the adapter
you configure, so you decide what leaves the browser and can proxy it
through your own backend first.

### Do I need the MCP server to use the AI features?

No. The in-grid helpers and the grounding files work without it. The MCP
server is the turnkey path for desktop AI clients; for a custom in-app
agent you call `SvGridApi` directly.
