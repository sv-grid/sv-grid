# Prompt: 84-editor-types

Source: `examples/src/demos/84-editor-types.svelte`
Live:   https://svgrid.com/demos/84-editor-types/

## What this demo proves

84. Built-in editor types - select / rich-select / textarea + cellEditor slot
----------------------------------------------------------------------------
The grid ships seven built-in editor types out of the box; this
demo shows the three new ones (select, rich-select, textarea)
alongside a custom slot for cases none of the built-ins fit.

  - `editorType: 'select'`       native <select> dropdown
  - `editorType: 'rich-select'`  combobox with typeahead search
  - `editorType: 'textarea'`     multi-line editor (Enter for newline)
  - `cellEditor: snippet`        BYO editor that gets value + commit + cancel

Double-click any cell to enter edit mode. Tab / Esc / blur all
commit. The "Body" column uses a textarea so a long description
gets its own multi-line editor instead of cramping into one line.
The "Severity" column uses a custom slider as a `cellEditor`
snippet - shows how to wire a fully custom in-cell control.

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

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
