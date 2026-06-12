# Prompt: 51-ai-assistant

Source: `examples/src/demos/51-ai-assistant.svelte`
Live:   https://svgrid.dev/#/demos/51-ai-assistant

## What this demo proves

51. AI assistant (Pro)
----------------------
Demonstrates the sv-grid-pro AI feature pack. The grid stays
model-agnostic; the demo wires the bundled `mockAIProvider` so
everything works end-to-end without any keys. In production you
register your own adapter that calls OpenAI / Anthropic / a proxy:

  setAIProvider(async ({ prompt, responseFormat, signal }) => {
    const r = await fetch('/api/ai', { method: 'POST', body: prompt, signal })
    return r.text()
  })

Four panels, four AI features:

  1. **Ask** - natural-language filter / sort plan. Preview the
     filters the model proposes; one click applies them.
  2. **Smart fill** - column-completion from worked examples.
     Type one or two values into "tier", hit "Propose rest".
  3. **Summarize** - one-paragraph summary of the current view,
     a selection, or a single row.
  4. **Classify** - bucket free-text rows into predefined labels
     ("at-risk", "expanding", "steady") with confidence.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
})
```

## SvGridApi methods called

- `api.clearAllFilters(...)`
- `api.clearSort(...)`
- `api.setFilter(...)`
- `api.setSort(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
