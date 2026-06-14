---
title: 'Inside SvGrid: The Row Model and Sorting'
description: How SvGrid's row-model pipeline came together, and why sorting was the first real feature we built on top of the headless core.
date: 2026-07-05
category: Engineering
tags: sorting, row model, engineering, story
author: SvGrid Team
---

With the architecture proven at scale by the 100,000-row test, attention turned to features. This post is part of a series on how SvGrid's internals work, and it starts where the grid itself starts: the row model, and the first feature built on it, sorting.

## What a row model actually is

Your `data` is an array. What the grid shows is almost never that array verbatim - it is your data after sorting, filtering, grouping, and pagination have been applied, in a specific order. The row model is the pipeline that performs those transformations and produces the final list of rows to render.

We built it as a chain of pure steps inside the headless core:

```
data -> filter -> sort -> group -> paginate -> rows
```

Each step is a function of its input plus some state. Keeping them pure and ordered meant we could reason about each one in isolation and test it without a DOM.

## Why sorting went first

Sorting is the feature users reach for before any other, and it is a good forcing function for the whole design. To build it well we had to answer questions that every later feature would inherit:

- Where does sort state live, and who owns it?
- How do we sort on the underlying value, not the formatted string?
- How does multi-column sort express priority?

```ts
let sorting = $state<Array<{ id: string; desc: boolean }>>([])
let sorted = $derived(applySort(rows, sorting))
```

On Svelte 5 runes this is almost anticlimactic: `sorting` is plain state, `sorted` is derived, and clicking a header just pushes a new entry. The reactivity we got for free from the start meant the engineering went entirely into correctness, not plumbing.

## The detail that mattered: sort the value, not the view

The bug that bites every grid is sorting a formatted column alphabetically - `"$1,000"` landing next to `"$100"` because they became strings. We made an early rule: formatting is a display concern that lives on the column, and the engine always sorts the raw value underneath.

That decision rippled outward. It is why, today, you set `format` on a column instead of formatting inside an accessor - so the grid shows `$84,000` but sorts numerically. One small rule in the row model, paid back across every numeric and date column anyone ever defines.

## Multi-column sort

Real tables need tie-breakers: sort by region, then by revenue within region. We represented sort as an ordered array rather than a single field, so the array position is the priority. Shift-clicking a second header appends to it. The render component surfaces this; the engine just consumes the ordered list.

The practical side of all this is covered in [Multi-Column Sorting in a Svelte Data Grid](multi-column-sorting). This post is about why it is shaped the way it is.

## What it set up

Getting the row model and sorting right gave the next features a road to drive on. Filtering, grouping, and pagination are all just more steps in the same pipeline, owning their own state and producing the next list. Read next: [how we built Excel-style filters](how-we-built-excel-style-filters), the one users feel most.

## Frequently asked questions

### What is a row model in a data grid?

It is the pipeline that turns your raw `data` into the rows actually shown, by applying filtering, sorting, grouping, and pagination in order. SvGrid's row model lives in the headless core as a chain of pure steps.

### Why does SvGrid sort the raw value instead of the displayed text?

Because sorting formatted strings produces wrong orders - `"$1,000"` sorts next to `"$100"`. SvGrid keeps formatting on the column and always sorts the underlying value, so numbers and dates order correctly.
