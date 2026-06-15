---
title: 'Inside SvGrid: Grouping, Trees, and Master-Detail'
description: How SvGrid grew from flat tables to hierarchy: grouping with aggregation, tree data, and expandable master-detail rows, all on one expansion model.
date: 2026-07-07
category: Engineering
tags: grouping, tree, master detail, engineering, story
author: Boyko Markov
---

With viewing and editing solid, the next challenge was a harder shape of data: hierarchy. Real datasets are not always flat. Orders have line items, regions contain customers, folders hold files. This is how SvGrid learned to express all of that.

![An org-chart tree in SvGrid](/blog-media/org-chart.png)
*Grouping, trees, and master-detail on one expansion model.*

## One model for three features

It would have been easy to build grouping, tree data, and master-detail as three separate systems. Instead we found the thing they share: expansion. Every one of them is a row that can expand to reveal more rows or content beneath it.

So we built a single expansion model in the core and expressed all three on top of it:

- **Grouping** - rows collapsed under generated group headers.
- **Tree data** - parent rows expanding to indented children.
- **Master-detail** - a row expanding to a rich detail panel.

One model, three faces. That kept the engine small and the behavior consistent: expand and collapse work the same way, with the same keyboard support, whichever feature you are using.

## Grouping needed aggregation to be useful

A grouped grid that just hides rows is not worth much. The value is in the summary: revenue summed per region, scores averaged per team. So grouping came with aggregation built into the column:

```ts
const columns = [
  { field: 'region',  header: 'Region' },
  { field: 'revenue', header: 'Revenue', aggregate: 'sum', format: { type: 'currency', currency: 'USD' } },
]
```

Each group footer rolls up its rows, and because the formatter runs on the aggregated value, group totals get the same currency or number formatting as the cells. The earlier rule about formatting living on the column paid off again here.

## Trees and the question of children

Tree data raised a design question: where do children come from? A nested `children` array is the simplest model to start with, and aggregation up the tree makes parents genuinely useful - a folder showing the total size of everything inside it. For very large trees, the expansion model lets you lazy-load a subtree the first time it opens, so you never pay for branches no one looks at.

## Master-detail: just render Svelte

Master-detail is where being native to Svelte 5 really showed. A detail panel is not a special grid construct - it is whatever Svelte markup you want: a nested `<SvGrid>` of line items, a chart, a form. The expansion model provides the open/close machinery; you provide the content. Lazy-loading detail data when a row opens keeps a thousand-row grid light.

The practical guides came later: [Grouping and Aggregation](grouping-and-aggregation), [Tree Data and Hierarchies](tree-data-hierarchies), and [Master-Detail Rows](master-detail-rows). This post is about the decision to unify them.

## What it proved

Collapsing grouping, trees, and master-detail onto one expansion model was the clearest example yet of the architecture earning its keep: three marquee features, one small mechanism, consistent behavior. Read next: [accessibility from the ground up](accessibility-from-the-ground-up) - something we insisted on from the start and had to prove at depth.

## Frequently asked questions

### Do grouping, tree data, and master-detail share code in SvGrid?

Yes. All three are built on a single expansion model in the headless core - a row that reveals more beneath it - so they share consistent expand/collapse behavior and keyboard support.

### Can parent rows summarize their children in a tree?

Yes. Add an `aggregate` such as `sum` to a column and each parent rolls up the values of its subtree, with the column's formatter applied to the total - the same aggregation that powers grouping.
