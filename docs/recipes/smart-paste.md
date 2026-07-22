# Smart paste: CSV / TSV / free-form → typed rows

> Live in [demo 75-ai-smart-paste](https://svgrid.com/#/demos/75-ai-smart-paste).

<div data-docs-demo="75-ai-smart-paste" data-height="480"></div>


## When

Paste anything; the assistant infers columns and previews typed rows for accept/update/skip.

## How

Key API surface:

- `setAIProvider(...) once at boot`
- `your own parse + map flow`

See the demo source for the full implementation; this recipe pins the
pattern + the surface so you can copy-paste it confidently. The doc
page that explains the underlying feature in depth is linked from the
[recipes index](./index.md).

## See also

- [Demo 75-ai-smart-paste source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/75-ai-smart-paste.svelte)
- [Demo 75-ai-smart-paste prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/75-ai-smart-paste.md) - drop into an LLM context window
- [Recipes index](./index.md)
