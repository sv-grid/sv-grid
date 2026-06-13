---
title: Pinned (Frozen) Columns for Wide Svelte Data Grids
description: Keep key columns visible while scrolling horizontally by pinning them left or right in SvGrid.
date: 2026-03-03
category: Columns
tags: pinned columns, frozen columns, wide tables, svelte data grid
author: SvGrid Team
---

When a grid is wider than the screen, users lose context the moment they scroll right - which row is this again? Pinned columns fix that by freezing an identifier column on the left and actions on the right, so the important columns stay put while the rest scroll.

## Pin a column

Mark the columns you want frozen and the grid keeps them stationary during horizontal scroll:

```ts
const columns: ColumnDef<{}, Row>[] = [
  { field: 'name', header: 'Name', pinned: 'left' },
  { field: 'q1', header: 'Q1' },
  { field: 'q2', header: 'Q2' },
  { field: 'q3', header: 'Q3' },
  { field: 'q4', header: 'Q4' },
  { id: 'actions', header: '', pinned: 'right' },
]
```

The name column stays anchored on the left edge and the actions column on the right, framing the scrollable middle.

## When to pin

- **Left:** the row's identity - a name, an order number, an avatar - so users never lose their place.
- **Right:** actions and totals - edit/delete buttons, a running total - so they are always one click away.

Pin sparingly. Two or three pinned columns help; pinning half the grid just shrinks the scroll area.

## Pinned columns and virtualization

Pinning works alongside column virtualization. The pinned columns are always rendered because they are always visible; the unpinned middle still virtualizes, so a 100-column grid stays fast with a frozen identifier on the left.

## Combine with selection

A pinned-left checkbox column is a common, friendly pattern: the selection checkbox and the row name stay visible while a user scans wide financial data and ticks rows to act on. Enable row selection and pin the name column, and the two compose naturally.

## Frequently asked questions

### How do I freeze a column in a Svelte data grid?

Set `pinned: 'left'` or `pinned: 'right'` on the column. SvGrid keeps it stationary while the rest of the grid scrolls horizontally.

### Do pinned columns slow down a wide grid?

No. Pinned columns render normally, and the unpinned columns still virtualize, so a wide grid stays fast with a frozen identifier and actions column.
