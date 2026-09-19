# Prompt: 481-gantt-portfolio-console
<!-- hand-written: keep -->

Source: `examples/src/demos/481-gantt-portfolio-console.svelte`
Live:   https://svgrid.com/demos/481-gantt-portfolio-console/

## What this demo proves

481. Portfolio office - a project console
-----------------------------------------
A PMO console with the Gantt as the hero: a rail of projects, live
KPIs, and a dockable workspace (`SvDockManager`) with the plan over
a risk register grid and a remaining-work chart.

  1. **The planning pass is a pure function.** `criticalPath` and
     `slackDays` from `@svgrid/enterprise` feed the register and
     the KPIs without rendering a chart.

  2. **Per-project state.** Each project's rows are their own
     `$state`, so an edit survives switching away and back.

  3. **Dockable panes.** `dockGroup` / `dockTabs` / `dockPane`
     describe the layout; it persists to localStorage.

  4. **Everything recomputes from the rows**: drag a task in the
     Gantt and the register, the chart and the finish date follow.

## Config shape

```ts
const ganttCfg = $derived<GanttProConfig<any, Task>>({
  startField: 'start', endField: 'end', parentField: 'parentId',
  milestoneField: 'milestone', progressField: 'progress', colorField: 'color',
  dependencies: project.dependencies,
  tableColumns: ['name', 'owner', '__duration', '__slack'],
  zoom: 'month', editable: true, history: true,
  criticalPath: true, baselineStartField: 'bStart', baselineEndField: 'bEnd',
  onTaskMove, onTaskResize, onProgressChange, onDependenciesChange,
})

const cpm = $derived(criticalPath(times, project.dependencies))
const register = $derived(tasks.filter((t) => t.progress < 100 && slackDays(cpm, t.id) < 3))
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
