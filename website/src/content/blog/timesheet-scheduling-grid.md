---
title: Building a Timesheet / Scheduling Grid in Svelte
description: A blueprint for a timesheet grid - editable hour cells, per-row and per-column totals, validation, and a weekly layout with SvGrid.
date: 2026-09-16
category: Use cases
tags: timesheet, scheduling, use case, svelte data grid
author: Boyko Markov
---

A timesheet is a grid in its purest form: rows of tasks or people, columns of days, editable hours in the cells, and totals everywhere. It needs fast cell editing, live totals, and validation. Here is a blueprint with SvGrid.

![A scheduling grid in SvGrid](/blog-media/scheduler.png)
*A scheduling grid built with SvGrid.*

## The weekly layout

The classic shape: a label column plus one column per day, grouped under the week with [multi-level headers](multi-level-column-headers).

```ts
const columns = [
  { field: 'task', header: 'Task' },
  { header: 'This week', columns: [
    { field: 'mon', header: 'Mon', editorType: 'number' },
    { field: 'tue', header: 'Tue', editorType: 'number' },
    // ...through Sun
  ] },
  { id: 'total', header: 'Total', accessorFn: (r) => weekTotal(r) },
]
```

## Editable hours, fast

Hour entry is keyboard-heavy, so number editors with Enter-to-commit-and-move and Tab-to-next make filling a week quick - see [inline editing](inline-editing-with-validation). [Paste from a spreadsheet](paste-from-excel) lets people bulk-fill. Commit [optimistically](optimistic-updates) and offer [undo/redo](undo-redo-grid-edits).

## Totals in two directions

Timesheets total both ways: per row (hours per task across the week) and per column (hours per day across tasks), plus a grand total. Per-row totals are an `accessorFn`; per-column totals go in a [summary footer](sticky-summary-footer-row). Compute over the current rows so filtered views total correctly.

## Validation

Hours have rules: non-negative, a daily cap (no 30-hour day), maybe required fields before submit. Validate in `onCellValueChange`, flag offending cells, and block submission until the timesheet is valid - reusing the [validation patterns](inline-editing-with-validation).

## Scheduling variant

The same grid powers shift scheduling: people as rows, days as columns, an [editable dropdown](editable-select-dropdown-cell) (shift type) per cell instead of hours, with [conditional styling](conditional-row-styling) for understaffed days.

## Frequently asked questions

### How do I build a timesheet grid in Svelte?

Use SvGrid with a day-per-column layout under grouped headers, number editors for hour cells with keyboard commit-and-move, per-row totals via an accessor and per-column totals in a summary footer, and validation in the change handler.

### How do I show both row and column totals?

Put per-row totals in a computed column (`accessorFn`) and per-column totals in the summary footer, computed over the current rows so they reflect any filtering - giving you task totals, daily totals, and a grand total.
