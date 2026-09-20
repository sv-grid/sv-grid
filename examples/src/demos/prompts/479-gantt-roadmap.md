# Prompt: 479-gantt-roadmap
<!-- hand-written: keep -->

Source: `examples/src/demos/479-gantt-roadmap.svelte`
Live:   https://svgrid.com/demos/479-gantt-roadmap/

## What this demo proves

479. Product roadmap - a year in quarters
-----------------------------------------
The Gantt as a roadmap: teams as phases, initiatives as bars
across four quarters, releases as milestones.

  1. **`task` snippet.** Replaces the bar body with an avatar,
     the name and a status chip. Summary bars keep their plain
     label; milestones have no body.

  2. **Colour by status**, not team: `colorField` reads a colour
     derived from the status, the team lives in the table.

  3. **`zoomLevels`** limits the ladder to month / quarter /
     year, and `zoom: 'quarter'` opens on the whole year.

  4. **A status filter is the grid's job.** The chips hand the
     grid a filtered array; the Gantt draws what it is handed.

  5. **`tooltip` snippet** for the effort and a one-line summary
     the bar has no room for.

## Config shape

```ts
const cfg: GanttConfig<any, Item> = {
  startField: 'start', endField: 'end', parentField: 'parentId',
  milestoneField: 'milestone', progressField: 'progress', colorField: 'color',
  dependencies,
  tableColumns: ['name', 'owner', 'status', '__progress'],
  rowHeight: 38,
  zoom: 'quarter', zoomLevels: ['month', 'quarter', 'year'],
  task: bar,       // {#snippet bar(row)} ... {/snippet}
  tooltip: tip,    // {#snippet tip(row)} ... {/snippet}
}
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
