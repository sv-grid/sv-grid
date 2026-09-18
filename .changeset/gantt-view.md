---
"@svgrid/grid": minor
"@svgrid/enterprise": minor
---

Add the Gantt view: `<SvGrid gantt={{ startField: 'start', endField: 'end' }} />`.

The grid renders its rows as a task table beside a time chart - one bar per
row placed by start and end, nested into a work-breakdown tree by
`parentField`, with dependency arrows between linked tasks. Like the Kanban
board and the scheduler it is a view of the grid: it draws the rows the grid
has already filtered and sorted, so the search box and column filters flow
through, and it writes back only through callbacks.

Parents draw a rolled-up summary bar spanning their children, with progress
weighted by duration rather than by task count, so a two-day task at 100%
beside a six-day task at 0% reads as 25% done. Collapsing a phase keeps that
rollup intact and re-points any arrow into it at the summary bar. Zero-length
tasks render as milestones. Five axis presets (day to year) with a zoom
stepper; non-working days are shaded and duration arithmetic skips them.

The `gantt` prop and its config types are part of the free grid; the
renderer, the layout model and the planning helpers ship in
`@svgrid/enterprise`. Register it with `enableGanttView()`, or
`installEnterprise(api)`, which now does it for you. Without the renderer a
grid with a `gantt` prop shows the same upgrade note the other Pro views do.

Dates are local calendar days and `end` is exclusive, except that a date-only
string is inclusive of its day: `{ start: '2026-09-14', end: '2026-09-16' }`
is the three-day task a person typing those dates means.

With `editable`, drag a bar to move it, drag an edge to resize, drag the
diamond on the fill to set percent, and drag a bar's end handle onto another
bar to draw a dependency (the edges pick FS / SS / FF / SF). Dragging a phase
moves its whole subtree and reports the batch in one `onTaskMove`. Moving a
predecessor slides its successors forward far enough to keep every link legal,
skipping non-working days; a link that would close a cycle is refused rather
than added. `history` adds undo and redo, which re-fire the callbacks with the
reversed values so your data follows. Nothing here mutates a row: the view
moves its own overlay and reports what it wants.
