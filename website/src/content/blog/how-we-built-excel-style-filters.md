---
title: How We Built Excel-Style Filters
description: Designing SvGrid's filtering: type-aware operators, the menu vs row UI, and keeping in-memory filtering fast enough to feel instant.
date: 2026-08-01
category: Engineering
tags: filtering, excel filters, engineering, story
author: Boyko Markov
---

With the row model and sorting in place, the next step in the pipeline was the feature users live in: filtering. We wanted the Excel-style experience people already know - per-column menus, type-aware operators, a global search - without the weight that usually comes with it.

![SvGrid's Excel-style column filter menu.](/blog-media/excel-filters.png)
*SvGrid's Excel-style column filter menu.*

## Filtering is a row-model step

Because we had built the row model as an ordered pipeline, filtering slotted in as the step before sorting:

```
data -> filter -> sort -> group -> paginate -> rows
```

The engine holds a filter model - a list of per-column conditions - and produces the surviving rows. Everything downstream just sees fewer rows. That composition is the payoff of the earlier architecture work: a major feature became one well-defined step rather than a special case threaded through everything.

## Type-aware operators

A filter is only intuitive if its operators match the data. Text wants "contains" and "starts with"; numbers want "greater than" and "between"; dates want ranges. Rather than make you configure this per column, the engine infers sensible operators from the column's value type.

The hard part was not the operators themselves but keeping them honest with formatting. Same rule as sorting: filter the underlying value, not the displayed string, so "greater than 1000" compares numbers, not text.

## Menu or row: two UIs, one model

We went back and forth on the UI and landed on supporting both, because they suit different workflows:

- `filterMode="menu"`, an Excel-style dropdown per header. Clean when filtering is occasional.
- `filterMode="row"`, an always-visible input row. Better for analysts who filter constantly.

Crucially, both drive the same filter model in the core. The UI is a view over the state; switching modes changes nothing about how filtering actually works.

```svelte
<SvGrid data={rows} columns={columns} features={features} filterMode="menu" />
```

## Making it feel instant

In-memory filtering on tens of thousands of rows has to feel immediate or the whole thing falls apart. Two things kept it fast:

- **Filter once per change, reuse the result.** The derived filtered list recomputes only when the filter model or data changes, not on every render.
- **Let virtualization do the rest.** However many rows survive the filter, only the visible window is ever in the DOM.

For larger-than-memory datasets, the same model drives a server query instead, the UI does not change, only where the filtering happens. We later wrote that up in [Excel-Style Filtering for Your Svelte Data Grid](excel-style-filtering).

## What it taught us

Filtering confirmed that the pipeline design was paying off: a complex, high-value feature dropped in as a single composable step, shared one model across two UIs, and stayed fast by leaning on work we had already done. Read next: [building the inline editing engine](building-the-editing-engine), the feature that changes a grid from a viewer into a tool.
