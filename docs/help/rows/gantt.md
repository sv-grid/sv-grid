---
seoDescription: The Gantt view of the Svelte data grid is in progress and due on 1 November 2026. What it will do, and what to use for a project timeline until then.
---

# Gantt chart mode

The Gantt view of the grid is in progress and due on **1 November 2026**. It
is on the [roadmap](#/roadmap) as an in-progress item, and this page becomes
its guide on that date.

What it is: one `gantt` prop on the `<SvGrid>` you already have, and the rows
render as a task table beside a time chart. A parent field nests the rows
into phases that draw a rolled-up bar, a dependency list draws the arrows
between tasks, and dragging a bar reports the new dates through a callback
and slides its successors forward over weekends. The planning layer sits on
top: the critical path in working days with a slack column, baselines drawn
as ghost bars, date constraints, and a resource load strip. The renderer
ships in `@svgrid/enterprise`, like the [Kanban board](/help/rows/kanban-board)
and the [scheduler](/help/rows/scheduler); the prop and its types are in the
free grid.

Until then, two things draw a timeline today:

- **A Gantt-shaped recipe in the free grid.** One wide custom cell per row
  positions a bar by its start and end as a percentage of the project span,
  with phase colouring, a progress fill and a today line. It is a normal grid,
  so it sorts, filters and virtualizes. See the
  [recipe](/help/recipes#gantt-chart-in-a-grid) and the
  [demo](#/demos/45-gantt-chart).
- **The scheduler's timeline views** in `@svgrid/enterprise`, for bookings
  across resources: bars on a time axis with drag to re-time and resize, one
  lane per person or asset. See the [scheduler](/help/rows/scheduler).
