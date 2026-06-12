# Prompt: 38-rtl-i18n

Source: `examples/src/demos/38-rtl-i18n.svelte`
Live:   https://svgrid.dev/#/demos/38-rtl-i18n

## What this demo proves

38. RTL + i18n stress
---------------------
Same dataset, six locales. Switching the locale chip flips:

  - Header labels, action buttons, status pills (translated)
  - Document direction (`dir="rtl"` for Arabic / Hebrew)
  - Number formatting per Intl.NumberFormat - Arabic-Indic digits
    where appropriate, narrow non-breaking spaces in fr-CA, etc.
  - Currency symbol AND placement per the locale's CLDR data
  - Date format per Intl.DateTimeFormat - month-first in en-US,
    day-first in de-DE, era in ja-JP, full Arabic month name in
    ar-SA, RTL ordering in he-IL.

The existing `15-localization` demo only flipped currency. This
one stresses procurement's "does your grid actually work in RTL"
checklist:

  1. Headers right-align in RTL (sort indicator on the LEFT of the
     label, not the right)
  2. Sticky pinned columns pin to the correct edge in RTL
  3. Filter menus open from the correct anchor
  4. Numeric columns stay tabular (no mid-word digit re-ordering)
  5. Mixed-direction text (English brand inside Arabic sentence)
     renders cleanly using `<bdi>`-style isolation

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
