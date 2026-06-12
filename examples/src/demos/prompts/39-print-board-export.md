# Prompt: 39-print-board-export

Source: `examples/src/demos/39-print-board-export.svelte`
Live:   https://svgrid.dev/#/demos/39-print-board-export

## What this demo proves

39. Print & boardroom export
----------------------------
Quarterly P&L by department - the kind of table a CFO drops into
a board pack. The interesting work is BELOW the grid:

  1. **Sandbox-popup print.** "Print / save PDF" opens a fresh
     window containing only the printable HTML (cover sheet +
     plain table with inlined styles) and calls `print()` on it.
     That keeps the print dialog clean - none of the host
     website's sidebar, header, or other chrome bleeds onto the
     paper, which is the failure mode any "naive `window.print()`"
     implementation hits.

  2. **Boardroom cover page.** The popup leads with a styled
     cover sheet (company name, period, owner, signature line)
     so the printed deck reads as one document, not a screenshot.

  3. **Page-size + orientation switcher.** Letter / A4 / Legal in
     portrait or landscape - written into the popup's `@page`
     rule so the browser's print pipeline picks them up.

  4. **CSV / HTML export.** Both reuse the same `buildPrintableHtml`
     builder as Print, so the saved file matches the printed sheet
     exactly. CSV downloads as `p-and-l.csv`, HTML as
     `p-and-l.html` for archival or re-printing.

No external PDF library - the browser's native print-to-PDF is
how every enterprise reporting tool actually generates the
deliverable.

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
