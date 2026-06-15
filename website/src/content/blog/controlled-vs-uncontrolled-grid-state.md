---
title: Controlled vs Uncontrolled Grid State
description: Should the grid own its sort/filter/page state, or should you? The difference between uncontrolled, observable, and external modes - and when to use each.
date: 2026-07-15
category: Concepts
tags: concepts, state management, controlled, data grid
author: Victor Vidolov
---

One decision shapes how you integrate a data grid: who owns the state? The grid can manage its own sorting, filtering, and pagination, or you can. Getting this right keeps your integration simple. Here is the spectrum.

## Three modes

SvGrid (like most good grids) supports three levels of control per dimension (sort, filter, page):

1. **Uncontrolled** - the grid owns the state. You pass initial config and forget it. Simplest.
2. **Observable** - the grid owns the state but tells you when it changes via callbacks. Use when something outside the grid needs to react (a URL, a "3 filters active" pill, an analytics event).
3. **External (controlled)** - you own the state. The grid records the user's intent but does not transform the rows; you do. Required for server-side data.

## Uncontrolled: let the grid handle it

```svelte
<SvGrid data={rows} columns={columns} features={features} showPagination pageSize={25} />
```

The grid sorts, filters, and pages internally. Perfect for in-memory data and a self-contained grid.

## Observable: react to changes

```svelte
<SvGrid data={rows} columns={columns} features={features}
  onSortingChange={(s) => syncUrl(s)}
  onFiltersChange={(f) => (filters = f.columns)} />
```

The grid still owns the state; you just observe it. Great for [URL sync](sync-grid-state-to-url) or selection-count UI.

## External: you own it

```svelte
<SvGrid data={pageRows} columns={columns} features={features} rowCount={total}
  onSortingChange={(s) => fetchPage({ sorting: s })} />
```

The grid records what the user clicked but does not reorder rows - you fetch and supply them. This is how [server-side data](server-side-data) works.

## How to choose

- In-memory data, self-contained grid? **Uncontrolled.**
- Need outside UI to react to grid state? **Observable.**
- Server-side data, or you must own the ordering? **External.**

You can mix per dimension - uncontrolled sorting with external pagination, for instance. Start uncontrolled and graduate a dimension to external only when you need to.

## Frequently asked questions

### What is the difference between controlled and uncontrolled grid state?

Uncontrolled means the grid owns and manages its sort/filter/page state. Controlled (external) means you own that state - the grid records the user's intent but you transform and supply the rows, which is required for server-side data. An in-between "observable" mode lets the grid own state while notifying you of changes.

### Which mode should I use for server-side data?

External (controlled) mode. The grid reports the sort, filter, and page state through callbacks, and you fetch and return the matching rows plus a total count, since the full dataset is not in the browser.
