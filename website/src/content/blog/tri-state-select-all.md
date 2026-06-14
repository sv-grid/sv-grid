---
title: A Tri-State Select-All Checkbox in SvGrid
description: The header checkbox that selects all rows, clears them, and shows an indeterminate state when only some are selected - and the all-pages nuance.
date: 2026-08-09
category: Selection
tags: selection, select all, checkbox, recipe, svelte data grid
author: SvGrid Team
---

The header checkbox in a grid has three states, not two: all selected, none selected, and indeterminate (some selected). SvGrid's row selection includes this tri-state header checkbox out of the box. Here is how it works and the one nuance to get right with paged or server data.

## Turn on row selection

Enable selection and you get the checkbox column plus the tri-state header checkbox automatically:

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  selectionMode="row"
  showRowSelection={true}
  onRowSelectionChange={(state, selectedRows) => (selected = selectedRows)}
/>
```

- Click the header when nothing is selected → selects all.
- Click it again → clears all.
- When only some rows are selected, it shows the **indeterminate** state (a dash), the cue users know from email and file apps.

## The all-pages nuance

"Select all" is ambiguous the moment you paginate. There are two meanings:

- **Select all on this page** - the default, and what the header checkbox does.
- **Select all matching rows** (across every page, including ones not loaded).

For the second, offer an explicit affordance after a page select: a small banner like "All 50 on this page selected - select all 1,284 matching?" This pattern (familiar from Gmail) avoids the trap of a user thinking they selected everything when they only selected the visible page.

## Server-side selection

With server-side data you cannot hold every row in memory, so "select all matching" must be a flag, not a list of ids. Track a `selectAllMatching` boolean plus an exclusion set, and translate that into your bulk action's query (for example "delete where filter X except these 3 ids"). See [bulk operations](bulk-operations-on-selected-rows).

## Accessibility

The header checkbox is a real, labeled control and exposes its checked/indeterminate state to assistive tech, so screen-reader users hear "partially checked". Keep any custom select-all banner keyboard-reachable.

## Frequently asked questions

### How does the select-all checkbox show a partial state?

SvGrid's row selection renders a tri-state header checkbox: checked when all rows are selected, unchecked when none are, and indeterminate (a dash) when only some are - the standard pattern users recognize.

### How do I handle "select all" across pages?

The header checkbox selects the current page. For all matching rows across pages, show an explicit "select all N" affordance and, for server data, represent it as a flag plus an exclusion set that your bulk action translates into a query.
