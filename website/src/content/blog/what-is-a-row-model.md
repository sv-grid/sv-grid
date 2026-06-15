---
title: What Is a Row Model in a Data Grid?
description: The row model is the pipeline that turns your raw data into the rows a grid displays. Here is what it does and why understanding it helps.
date: 2026-09-22
category: Concepts
tags: row model, concepts, data grid, architecture
author: Kamelia M
---

When you read a data grid's docs you will hit the term "row model" quickly. It is the core idea that makes a grid more than a styled table. Here is a clear explanation.

## The definition

A row model is the pipeline that transforms your raw `data` into the rows the grid actually shows. Your data is an array; what appears on screen is that array after filtering, sorting, grouping, and pagination have been applied, in order:

```
data -> filter -> sort -> group -> paginate -> displayed rows
```

Each stage takes rows in and produces rows out. The row model is the sum of those stages.

## Why it is a model, not just "the rows"

Calling it a model emphasizes that the displayed rows are *derived*, not stored. You never mutate "the visible rows" directly; you change inputs (the data, the sort, the filter) and the model recomputes what to show. This is why a well-built grid stays predictable: there is one source of truth (your data plus the UI state) and one function from it to the screen.

## Client-side vs server-side row models

- **Client-side** - the whole dataset is in the browser and the row model runs locally. Sorting and filtering are instant.
- **Server-side** - the row model effectively lives on your backend: the grid records the sort/filter/page state, your server returns the matching rows, and the grid displays them. The grid's local model just passes them through.

Choosing between these is the most important data-architecture decision for a grid - see [client-side vs server-side data](client-side-vs-server-side-data).

## Why it matters to you

Understanding the row model explains a lot of grid behavior: why you set `format` on a column (so the model sorts the raw value, not the string), why editing emits an event instead of mutating (so your data stays the single source of truth), and why features compose cleanly (each is another stage in the pipeline). In SvGrid the row model lives in the headless `createSvGrid` core; the `<SvGrid>` component renders its output.

## Frequently asked questions

### What does "row model" mean in a data grid?

It is the pipeline that turns your raw data into the rows displayed, applying filtering, sorting, grouping, and pagination in order. The visible rows are derived from your data plus the UI state, not stored separately.

### What is the difference between a client-side and server-side row model?

A client-side row model runs in the browser over the full dataset, so operations are instant. A server-side row model offloads filtering, sorting, and paging to your backend, which returns just the matching page - necessary for very large or sensitive datasets.
