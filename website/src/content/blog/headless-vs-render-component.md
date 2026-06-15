---
title: Headless Core or Render Component? Choosing the Right SvGrid API
description: SvGrid ships both a headless engine and a drop-in render component. Learn when to use createSvGrid versus <SvGrid> and how to mix them.
date: 2026-06-02
category: Architecture
tags: headless table, svelte data grid, architecture, createSvGrid
author: Boyko Markov
---

One of the first decisions you make with SvGrid is which layer to build on. SvGrid is headless-first: a pure data engine (`createSvGrid`) sits underneath a full render component (`<SvGrid>`). You can use either, and you can drop from one to the other without rewriting your data logic.

![The SvGrid render component](/blog-media/quick-start.png)
*The <SvGrid> render component - the batteries-included layer over the headless core.*

## The render component: `<SvGrid>`

Most apps should start here. `<SvGrid>` is an opinionated, accessible grid that already paints rows, headers, the filter menu, virtualization, selection, and editing. You configure it with plain props.

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  showPagination={true}
  pageSize={25}
/>
```

Reach for the render component when you want a working grid fast and the default look and behavior fit your product.

## The headless core: `createSvGrid`

The headless engine gives you the row-model pipeline - filtering, sorting, grouping, pagination, expansion - with zero markup. You own every DOM node.

```ts
import { createSvGrid, rowSortingFeature, tableFeatures } from 'sv-grid-community'

const grid = createSvGrid({
  data: rows,
  columns,
  features: tableFeatures({ rowSortingFeature }),
})

// grid exposes reactive row models you render however you like
```

Choose the core when you need a bespoke layout - a card grid, a Kanban board, a virtualized list with custom rows - but still want a battle-tested sort/filter/group pipeline.

## How to decide

| You want                                   | Use                |
| ------------------------------------------ | ------------------ |
| A standard data table, fast                | `<SvGrid>`         |
| Custom markup with the same data pipeline  | `createSvGrid`     |
| Standard grid now, custom cells later      | `<SvGrid>` + snippets |

## You are not locked in

Because both layers share the same column definitions and feature factories, you can prototype with `<SvGrid>` and later drop to `createSvGrid` for one screen that needs a custom layout, reusing your `columns` array untouched. That migration path is the reason SvGrid is headless underneath - you never hit a wall where the component cannot do what you need.

## Frequently asked questions

### What is a headless data grid?

A headless grid provides the data logic - sorting, filtering, grouping, pagination - without rendering any DOM. You supply the markup. SvGrid's `createSvGrid` is its headless core.

### Can I mix the headless core and the render component?

Yes. They share column definitions and feature factories, so you can start with `<SvGrid>` and move individual screens to `createSvGrid` without rewriting your column or data code.
