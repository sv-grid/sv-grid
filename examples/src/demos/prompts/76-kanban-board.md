# Prompt: 76-kanban-board

Source: `examples/src/demos/76-kanban-board.svelte`
Live:   https://svgrid.dev/#/demos/76-kanban-board

## What this demo proves

76. Kanban board - single SvGrid, columns = lanes
-------------------------------------------------
ONE `<SvGrid>` instance renders the whole board. The data is
pivoted: each row is a "slot" (board row), each column is a lane
(Backlog / In progress / Review / Done). Cells render the card
sitting in that slot, or an empty drop zone.

Two affordances move a task between lanes:
  - Drag a card to another column's cell (HTML5 DnD).
  - Use the ◂ ▸ arrow buttons inside each card.

The source of truth is a flat `tasks` array; the pivoted board rows
are derived. Any move rewrites the task's `status` and the derived
rows re-pivot reactively.

## Imports

```ts
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
