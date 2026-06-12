# Prompt: 75-ai-smart-paste

Source: `examples/src/demos/75-ai-smart-paste.svelte`
Live:   https://svgrid.dev/#/demos/75-ai-smart-paste

## What this demo proves

75. AI Smart Paste (Pro)
-----------------------
Drop ANY shape of contact data into the zone - CSV with header,
tab-separated from Excel, JSON array, free-form lines - and the
assistant figures out which column is which by INSPECTING THE CELLS,
not by demanding a fixed format.

What makes this "smart":
  - Auto-detects the separator (tab / comma / semicolon / pipe)
  - Auto-detects whether the first line is a header (by name match
    OR by column-type contrast with line 2)
  - Per-column TYPE detection - email / phone / name / company /
    role - using content regex, then maps each detected type to the
    matching target field
  - Falls back to a free-form parser for prose lines: extracts the
    email first (definitive marker) and infers the rest by position
    relative to it
  - Per-row confidence score so the user can see what's solid

Swap `assistant()` for a real LLM call - the rest of the wiring is
identical (preview panel, commit, etc.).

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  rowSelectionFeature,
})
```

## SvGridApi methods called

- `api.addRows(...)`
- `api.setCellValue(...)`

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
