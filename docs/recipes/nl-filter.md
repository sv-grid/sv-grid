# NL filter wired to your LLM

> Live in [demo 51-ai-assistant](https://svgrid.com/#/demos/51-ai-assistant).

## When

"show last quarter > $10k sorted by date" - one natural-language input drives setFilter + setSort.

## How

Key API surface:

- `api.ai.filter(query)`
- `setAIProvider(adapter)`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 51-ai-assistant source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/51-ai-assistant.svelte)
- [Demo 51-ai-assistant prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/51-ai-assistant.md) - drop into an LLM context window
- [Recipes index](./index.md)
