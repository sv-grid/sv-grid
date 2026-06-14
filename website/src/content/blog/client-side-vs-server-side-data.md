---
title: Client-Side vs Server-Side Data for Tables
description: When to load all your rows into the browser and when to page, sort, and filter on the server - the trade-offs, and how to wire each in a Svelte data grid.
date: 2026-06-19
category: Concepts
tags: server-side, data, concepts, performance
author: SvGrid Team
---

One architectural choice shapes everything about a data table: does the browser hold all the rows, or does the server send one page at a time? Get this right and the rest is easy. Here is how to choose.

## Client-side: all rows in the browser

You fetch the whole dataset once and let the grid sort, filter, and paginate in memory.

**Good when:**

- The dataset is small to medium - up to a few tens of thousands of rows.
- The data is not sensitive (everything ships to the client).
- You want instant, zero-latency interaction.

**The win:** sorting and filtering are immediate, with no network round trip. Combined with virtualization, even tens of thousands of rows stay smooth.

## Server-side: one page at a time

The grid records what the user did - sort, filter, page - and your backend returns just the matching rows.

**Good when:**

- The dataset is large (hundreds of thousands to millions of rows).
- The data is sensitive and must not all leave the server.
- The data changes constantly and a full client copy would be stale.

**The cost:** every interaction is a request, so you need debouncing, request cancellation, loading states, and a returned total count for the pager.

## A simple decision rule

- A few thousand rows, not sensitive? **Client-side.** Simpler, faster to use.
- Too big to transfer, sensitive, or fast-changing? **Server-side.**

When unsure, start client-side; it is less code. Move to server-side when the dataset or sensitivity demands it.

## Wiring each in SvGrid

Client-side is the default - pass `data` and register the features:

```svelte
<SvGrid data={rows} columns={columns} features={features} showPagination={true} />
```

Server-side uses external mode: read the state from callbacks, fetch the page, pass it back with a total `rowCount`:

```svelte
<SvGrid
  data={pageRows}
  columns={columns}
  features={features}
  rowCount={total}
  onSortingChange={(s) => load({ sorting: s })}
  onFiltersChange={(f) => load({ filters: f.columns })}
  onPaginationChange={(p) => load({ page: p.pageIndex })}
/>
```

The UI is identical either way; only where the work happens changes. See [Server-Side Data](server-side-data) for the full pattern.

## You can combine them

Virtualization (client rendering) and server paging are complementary: page from the server to bound what you transfer, and let virtualization bound the DOM for whatever page is loaded. Together they keep both the network and the browser light.

## Frequently asked questions

### Should I use client-side or server-side data for my table?

Use client-side for small-to-medium, non-sensitive datasets - it is simpler and feels instant. Use server-side when the data is too large to transfer, sensitive, or rapidly changing, accepting the extra work of requests, debouncing, and loading states.

### Does server-side data change the grid's UI?

No. In SvGrid the headers, filter menus, and pager are identical; only the source of the rows changes. You read sort/filter/page state from callbacks and return the matching page with a total row count.
