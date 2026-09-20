# Prompt: 480-gantt-program
<!-- hand-written: keep -->

Source: `examples/src/demos/480-gantt-program.svelte`
Live:   https://svgrid.com/demos/480-gantt-program/

## What this demo proves

480. A programme of 40 sites, 640 tasks
---------------------------------------
Programme scale: 40 phases of 16 linked tasks, 680 rows and 600
links, opening folded to one bar per site.

  1. **Row windowing.** Past 300 rows only the rows near the
     viewport render; the table and the chart share one scroller.

  2. **The critical path runs over every task, folded or not.**
     Each site is its own chain, so the chain that ends last is
     critical, and its folded summary bar carries the ring.

  3. **Controlled collapse.** `collapsed` + `onCollapseChange`
     open the plan with every site folded.

  4. **Baselines at scale** count the sites running late from two
     fields per task.

## Config shape

```ts
let collapsed = $state<string[]>(siteIds)
const cfg = $derived<GanttProConfig<any, Task>>({
  startField: 'start', endField: 'end', parentField: 'parentId',
  progressField: 'progress', colorField: 'color',
  dependencies, holidays,
  tableColumns: ['name', 'trade', '__duration', '__slack'],
  rowHeight: 30, zoom: 'month', labelPosition: 'none',
  criticalPath: true,
  onCriticalPathChange: (keys) => (criticalSite = siteOf(keys[0])),
  baselineStartField: 'bStart', baselineEndField: 'bEnd',
  collapseWeekends: true, collapsedGapPx: 6,
  collapsed, onCollapseChange: (next) => (collapsed = next),
})
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
