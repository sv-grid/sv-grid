---
title: Displaying Tree Data and Hierarchies in SvGrid
description: Render parent-child hierarchies - org charts, file trees, category trees - in a Svelte data grid with expandable tree rows.
date: 2026-04-07
category: Rows
tags: tree data, hierarchy, expandable rows, svelte data grid
author: Boyko Markov
---

Plenty of data is a tree wearing a list's disguise: file systems, org charts, category trees. SvGrid renders that hierarchy with the same `rowExpandingFeature` that powers master-detail, so a parent row expands to show its children indented underneath.

![Tree rows and master-detail in SvGrid](/blog-media/tree-master-detail.png)
*Tree rows and master-detail expansion in SvGrid.*

## The shape of tree data

Give each row a way to find its children - either a nested `children` array or a parent reference you resolve. A nested shape is the simplest to start with:

```ts
type Node = {
  id: string
  name: string
  size: number
  children?: Node[]
}
```

## Enable tree rows

```svelte
<script lang="ts">
  import { SvGrid, tableFeatures, rowExpandingFeature } from 'sv-grid-community'
  const features = tableFeatures({ rowExpandingFeature })
</script>

<SvGrid data={tree} columns={columns} features={features} />
```

Parent rows render an expand toggle and indent their descendants, so the hierarchy reads at a glance.

## Aggregate up the tree

A tree becomes far more useful when parents summarize their children - a folder shows the total size of everything inside it, a manager shows headcount below them. Combine tree rows with aggregation so each parent rolls up its subtree:

```ts
const columns = [
  { field: 'name', header: 'Name' },
  { field: 'size', header: 'Size', aggregate: 'sum', format: { type: 'number' } },
]
```

## Expand and collapse all

For deep trees, give users a way to expand or collapse everything at once from your toolbar, and default the initial expansion depth so the first paint is not overwhelming. Start collapsed for big trees and let users drill in.

## Lazy-load big subtrees

If a node has thousands of descendants, do not load them up front. Fetch children when a node is first expanded and splice them into your `$state` tree. The grid re-renders the new branch automatically.

## Frequently asked questions

### How do I show hierarchical tree data in a Svelte grid?

Model rows with a `children` array and register `rowExpandingFeature`. SvGrid indents descendants under expandable parent rows.

### Can parent rows summarize their children?

Yes. Add an `aggregate` such as `sum` to a column and each parent rolls up the values of its subtree.
