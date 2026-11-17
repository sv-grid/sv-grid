---
"@svgrid/enterprise": minor
"@svgrid/grid": patch
---

Base: a `'timeline'` view type, records as bars in lanes by `laneField` (a single select, person or link field), zoomed from a day to a year; a bar dropped in another lane changes the field in the same undo step. The Gantt view is called Gantt again ("Customize Gantt"), and an Airtable Timeline view converts to a timeline. The scheduler takes `resourceOf`, `resourceTitle` and `resourceLegend: false`. Grid: in a tree, Left and Right fold and unfold only in the cell with the expander; elsewhere they move between cells.
