# Prompt: 45-gantt-chart

Source: `examples/src/demos/45-gantt-chart.svelte`
Live:   https://svgrid.dev/#/demos/45-gantt-chart

## What this demo proves

45. Grid as a Gantt chart
--------------------------
Same grid engine, different cell strategy: every task row gets
one wide "Schedule" cell whose snippet renders an absolutely-
positioned bar laid out by the task's start / end dates. The
left columns are the regular project meta (name, owner, dates,
progress) and the right column is the visual timeline.

Things this demo proves SvGrid can do without a Gantt plug-in:

  1. **Custom cell rendering owns the timeline.** The grid never
     sees calendar columns - just one wide cell per row. Bar
     position is `left:` / `width:` in percentages computed
     from the project window (jan 1 - dec 31, this year).

  2. **Phase coloring + progress fill.** Each bar carries the
     phase color outside, with an interior fill clipped to the
     task's `progress` percentage. Reads like a real Gantt view.

  3. **A "today" line.** A vertical dashed line crosses every
     row at today's date so the user sees what's behind and
     what's still in front. Updates live via a 60-second tick.

  4. **Sort + filter still works.** Tasks can be sorted by start,
     filtered by owner, etc. - the timeline cells reflow because
     they're just regular grid cells.

No external Gantt library - the whole thing is ~600 lines.

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
