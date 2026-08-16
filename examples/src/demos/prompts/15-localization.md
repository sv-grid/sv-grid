# Prompt: 15-localization

Source: `examples/src/demos/15-localization.svelte`
Live:   https://svgrid.com/demos/15-localization/

## What this demo proves

15. Localization
----------------
The same data, re-rendered as you flip locale + currency. Demonstrates
how the grid's `format` config and a tiny `messages` map cover the
90% case: header text, dates, numbers, and currencies all switch
together. RTL flips the column order via `dir="rtl"` on the wrapper.

Showcases:
  - `format: { type: 'date'|'number'|'currency' }` driven by the live
    locale prop on each column
  - Header text from a small i18n dictionary
  - RTL handling for Arabic
  - Locale-aware sort via `Intl.Collator` in a custom sort function
    would go here too - the grid's default sort already uses
    `String.prototype.localeCompare`, so we get that for free.

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
