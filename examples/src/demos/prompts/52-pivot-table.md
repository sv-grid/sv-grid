# Prompt: 52-pivot-table

Source: `examples/src/demos/52-pivot-table.svelte`
Live:   https://svgrid.com/demos/52-pivot-table/

## What this demo proves

52. Pivot table - built on <SvPivotDesigner>
---------------------------------------------
A self-contained sales pivot built on the shipped `<SvPivotDesigner>`
(which the previous 1,232-line version of this demo hand-rolled).
The component handles the field rail, the four wells, drag-and-drop,
chip menus, presets, totals toggles, and the inline pivot grid.

This demo adds two thin layers around it:

 - A grand-total KPI strip ABOVE the pivot, recomputed from the
   designer's `onPivot` callback whenever the layout changes.
 - Currency / number formatting on value cells via `decorateColumns`
   so revenue + cost render as money and units as plain numbers.

The pivot data is ~2,400 synthetic sales facts: 4 regions × 13
countries × 4 channels × 6 categories × 3 years × 4 quarters.

## Imports

```ts
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
