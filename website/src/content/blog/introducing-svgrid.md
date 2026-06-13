---
title: Introducing SvGrid - A Native Svelte 5 Data Grid from jQWidgets
description: Why we built a brand-new data grid for Svelte 5 from scratch, what makes it different, and how the headless core plus render component fit together.
date: 2026-06-10
category: Company
tags: announcement, svelte data grid, jqwidgets, sv-grid, launch
author: SvGrid Team
---

Today we are introducing SvGrid, a data grid built from the ground up for Svelte 5. It is not a port, not a wrapper around an older grid, and not a thin adapter over a framework-agnostic engine. It is a native Svelte 5 component, written on runes, by the team at jQWidgets.

## Why a new grid, and why now

We have shipped UI components since 2011 - first jQWidgets, then the Smart UI web components on [htmlelements.com](https://www.htmlelements.com). Over those years our components have gone into products at thousands of companies, including Samsung, Boeing, NVIDIA, Microsoft, Nokia, and Intel.

Svelte 5 changed the calculus. Runes - `$state`, `$derived`, `$effect` - give the framework fine-grained reactivity that a data grid can exploit directly. A grid is, at its core, a reactivity problem: a hundred thousand cells, any of which can change, and you want to repaint only what actually moved. Building on runes natively, rather than wrapping an engine designed for another model, lets the grid be both smaller and faster.

So we did not adapt an existing product. We wrote a new one.

## Headless core plus a render component

SvGrid ships in two layers, and you can use either:

- **`createSvGrid`** is the headless engine: the row-model pipeline for filtering, sorting, grouping, pagination, and expansion, with no markup. You own every DOM node.
- **`<SvGrid>`** is the render component built on that engine: an accessible, virtualized, themeable grid you configure with plain props.

Most teams start with `<SvGrid>` and drop to the core only for a screen that needs a bespoke layout - reusing their column definitions untouched. The headless foundation is the reason you never hit a wall.

```svelte
<script lang="ts">
  import { SvGrid, type ColumnDef } from 'sv-grid-community'

  const columns: ColumnDef<{}, Person>[] = [
    { field: 'firstName', header: 'First name' },
    { field: 'age',       header: 'Age' },
  ]
</script>

<SvGrid data={rows} columns={columns} />
```

## What it does out of the box

- Row and column virtualization - 100,000 rows by 100 columns stay smooth.
- Sorting, Excel-style filtering, grouping with aggregation, tree and master-detail rows.
- Inline editing with typed editors and validation.
- Server-side data, full keyboard navigation, and WAI-ARIA accessibility by default.
- A theming system built entirely on `--sg-*` CSS custom properties.

## Free core, optional Pro

`sv-grid-community` is MIT-licensed and free for commercial use - no license key, no row cap. The optional `sv-grid-pro` pack adds data export (Excel, PDF, CSV, HTML), import, printing, pivot tables, and an AI assistant for teams that need them.

## AI-native from day one

SvGrid ships an MCP (Model Context Protocol) server and an `llms.txt` file, so assistants like Claude and Cursor can ground their answers in the real API instead of guessing. If you build with an AI pair-programmer, the grid was designed to meet you there.

## Where to start

- [Render your first grid in under 5 minutes](render-your-first-svelte-data-grid)
- Browse the [120+ live demos](/demos) or read the [documentation](/docs/getting-started).

We have been building data grids for over a decade. SvGrid is the one we are most excited about - because for the first time, the framework underneath is as fine-grained as the grid wants to be.

## Frequently asked questions

### Who builds SvGrid?

SvGrid is built by jQWidgets, the team behind jqwidgets.com and the Smart UI components on htmlelements.com, shipping UI components since 2011 to thousands of companies.

### Is SvGrid a port of an older grid?

No. SvGrid is a new component written natively for Svelte 5 on runes, with a headless `createSvGrid` core and a `<SvGrid>` render component - not a wrapper around an existing engine.
