---
title: 15 Years of UI Components - The Story Behind jQWidgets and Smart UI
description: How a team spent 15 years shipping data grids - from jQuery widgets in 2011 to web components to a Svelte 5 native grid - and what actually changed each time.
date: 2026-06-05
updated: 2026-07-02
category: Company
tags: company, jqwidgets, smart ui, htmlelements, history
author: Boyko Markov
---

The first customer email we ever got about jQWidgets was a complaint. The grid was locking the browser tab at 10,000 rows and the developer on the other end was not happy. That email is still in the inbox somewhere, and I think about it every time we make a performance decision.

jQWidgets launched in 2011 on top of jQuery. The idea was straightforward: wrap the things developers actually needed - data grids, trees, charts, form controls - in a consistent API and style system, so teams building enterprise apps in jQuery did not have to stitch together five different libraries with five different event models. The pitch worked. Within a couple of years we had customers at Boeing, Samsung, NVIDIA, and Intel using the grid as the backbone of internal dashboards and data tools. None of them were hobby projects. They were inventory systems, trading interfaces, telemetry dashboards - real workloads where a layout bug at the wrong column width would get escalated to a VP.

## What jQuery forced us to learn

Building a grid on jQuery is genuinely hard. jQuery gives you DOM manipulation utilities, not a component model. Every feature - sorting, filtering, column resizing, virtualization - has to be coordinated by hand. You end up with an object that is half imperative API and half event bus, with state scattered across DOM attributes, instance variables, and closure captures. It works, and the jQWidgets grid proved it could work at scale, but the surface area for bugs is enormous.

The virtualization problem the first customer wrote about came from a simple mistake: we were rendering all rows to the DOM and hiding the out-of-viewport ones with `display: none`. That is not virtualization, it is just hiding. Real virtualization requires a fixed-height scroll container, a measurement pass to know each row's height, a viewport tracking loop, and a recycling pool that reuses DOM nodes as rows scroll in and out. We built all of that, over several releases, on top of jQuery's `$()` selectors and `.on()` event binding. It was not elegant but it shipped.

The jQWidgets column definition from that era looked like this:

```js
// jQWidgets grid column definition, circa 2013
$('#grid').jqxGrid({
  source: dataAdapter,
  columns: [
    { text: 'Symbol', datafield: 'symbol', width: 90 },
    { text: 'Last Price', datafield: 'last', width: 100, cellsformat: 'f2' },
    {
      text: '% Change',
      datafield: 'pctChange',
      width: 100,
      cellsrenderer: function(row, columnfield, value) {
        var color = value >= 0 ? '#065f46' : '#991b1b'
        var bg = value >= 0 ? '#d1fae5' : '#fee2e2'
        var sign = value >= 0 ? '+' : ''
        return '<span style="background:' + bg + ';color:' + color + ';padding:2px 8px;border-radius:9999px">'
          + sign + parseFloat(value).toFixed(2) + '%</span>'
      }
    },
    { text: 'Volume', datafield: 'volume', width: 110, cellsformat: 'n0' },
  ]
})
```

The `cellsrenderer` approach worked, but it had a structural problem: you were generating raw HTML strings that got injected via `innerHTML`. XSS if you were not careful with user-sourced values. No access to the component tree for tooltips or popovers. No lifecycle hooks. You could make it look right, but wiring in real interactivity meant reaching back into the DOM with more jQuery after the renderer ran.

## The web component rewrite

By 2018, the frontend landscape had shifted enough that jQuery felt like a liability for new customers. React had won the SPA wars. Angular was on a stable footing. Web components were standardized. We made the call to rebuild from scratch as native HTML custom elements under the Smart UI / htmlelements.com brand.

The web component model solved the innerHTML problem cleanly. A custom element owns its shadow DOM, so cell content is actual DOM nodes with real event listeners, not injected strings. The grid element (`<smart-grid>`) could drop into any framework or plain HTML without adapter code. We picked up customers in Angular shops that had been blocked on the jQuery dependency.

But web components introduced a different kind of friction. The framework integration story was never great. React's synthetic event system does not play well with custom events dispatched from shadow DOM. Angular's change detection does not know about shadow DOM mutations by default. You end up shipping wrapper packages that re-expose the imperative API in framework idioms, and those wrappers lag behind the core by a release cycle. Multi-framework support sounds like a selling point until you are maintaining four wrappers.

## Starting over for Svelte 5

The decision to build SvGrid specifically for Svelte 5 came from watching what Svelte's rune system actually enables. Svelte 5's `$state` and `$derived` are not just syntactic sugar over a store - they are a fine-grained reactivity graph that the compiler turns into surgical DOM updates. A grid built natively against that system can track which cells need repaint at the rune level, rather than diffing the full row array on every tick.

The feature composition model that came out of this is probably the biggest architectural change from every previous generation:

```ts
import {
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  rowSelectionFeature,
  rowPaginationFeature,
  type ColumnDef,
  type SvGridApi,
} from '@svgrid/grid'

// You declare which features the grid uses at the call site.
// The returned token carries TypeScript overloads for every
// feature you included, so api.setSort() is only available
// if rowSortingFeature is in the list.
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  rowSelectionFeature,
  rowPaginationFeature,
})

type Row = { id: string; symbol: string; last: number; pctChange: number }

const columns: ColumnDef<typeof features, Row>[] = [
  { id: 'symbol', field: 'symbol', header: 'Symbol', width: 90 },
  { id: 'last',   field: 'last',   header: 'Last',   width: 100, type: 'number' },
  { id: 'pct',    field: 'pctChange', header: '% Change', width: 100 },
]
```

Nothing in jQWidgets or Smart UI worked this way. Both earlier grids exposed everything through a single monolithic instance: you called `setOption('sortable', true)` and the sort module activated. That is fine for simplicity, but the bundle always included every feature whether you used it or not, and TypeScript inference across a dynamic options object is a nightmare to maintain. The `tableFeatures` composition approach means unused features are tree-shaken at build time, and the API surface narrows to exactly what you declared.

## What the cell renderer story looks like now

The `cellsrenderer` function from the jQuery era returned an HTML string. Smart UI improved on this with a slot-based approach, but slots have limits in highly dynamic grids - you cannot conditionally swap a slot renderer based on row data without fairly ugly workarounds.

SvGrid cell rendering uses Svelte snippets directly:

```svelte
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature, renderSnippet, type ColumnDef } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature })

  type Row = { id: string; symbol: string; pctChange: number }

  const rows: Row[] = $state([
    { id: '1', symbol: 'AAPL', pctChange: 1.24 },
    { id: '2', symbol: 'MSFT', pctChange: -0.88 },
    { id: '3', symbol: 'NVDA', pctChange: 3.17 },
  ])

  const columns: ColumnDef<typeof features, Row>[] = [
    { id: 'symbol', field: 'symbol', header: 'Symbol', width: 90 },
    {
      id: 'pct',
      field: 'pctChange',
      header: '% Change',
      width: 120,
      cell: renderSnippet(pctCell, (ctx) => ctx.row.original),
    },
  ]
</script>

{#snippet pctCell(row: Row)}
  {@const up = row.pctChange >= 0}
  <span
    style:background={up ? '#d1fae5' : '#fee2e2'}
    style:color={up ? '#065f46' : '#991b1b'}
    style:padding="2px 8px"
    style:border-radius="9999px"
    style:font-weight="600"
  >
    {up ? '+' : ''}{row.pctChange.toFixed(2)}%
  </span>
{/snippet}

<SvGrid {features} {rows} {columns} rowId="id" height={300} />
```

The snippet is actual compiled Svelte. It participates in the reactive graph, has access to Svelte stores, can use `{#if}` and `{#each}` blocks, and is typed end to end. The `renderSnippet` projector - the second argument - is a pure function that extracts what the snippet needs from `CellContext`. Keep it cheap: it runs on every paint cycle, and for large grids scrolling at 60 Hz that is a lot of calls.

## The things that did not change

Fifteen years of shipping a data grid teaches you that most of the hard problems are the same across frameworks. Row virtualization is still about maintaining a measurement cache and a DOM recycling pool. Column pinning still requires two synchronized scroll containers that share one horizontal scroll position. Filter state is still a map of column IDs to filter descriptors. The imperative API is still the escape hatch for programmatic control that declarative binding cannot cover cleanly.

What changed is how much of that complexity we can hide, and how much we can push into framework primitives rather than reinventing them. Svelte 5's rune system lets SvGrid keep sort state, filter state, and selection state as runes inside the features layer. They integrate with the reactivity graph without requiring the host application to wire up any store subscriptions. That is the return on the architectural decision to go Svelte-native rather than building another multi-framework adapter layer.

The complaint from 2011 was about performance. The answer in 2026 is that the virtualization internals are not that different in concept - fixed-height container, viewport tracking, DOM recycling - but the integration with the framework's own scheduler means the grid is not fighting the framework for control of the render loop. That is the practical payoff of fifteen years of iteration.
