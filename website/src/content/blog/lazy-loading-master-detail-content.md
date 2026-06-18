---
title: Lazy-Loading Master-Detail Content in SvGrid
description: Keep a grid light by fetching detail-panel content only when a row is expanded - and caching it so re-opening is instant.
date: 2026-08-07
category: Performance
tags: performance, master detail, lazy loading, recipe, svelte data grid
author: Kamelia M
---

Master-detail rows are great, but loading every row's detail up front is paying for a thousand panels to show the three someone opens. Lazy-loading flips that: the grid loads fast, and a detail panel only fetches when its row is actually expanded. Here is how to do it cleanly, caching included.

![Lazy-loaded tree branches in SvGrid](/blog-media/lazy-tree.png)
*Lazy-loaded branches: detail data fetched only on expand.*

## Fetch on expand

Load the detail data inside the detail snippet, triggered by expansion, with an `{#await}` block:

```svelte
{#snippet Detail(p: { row: Order })}
  {#await loadLineItems(p.row.id)}
    <div class="detail-loading">Loading line items…</div>
  {:then items}
    <SvGrid data={items} columns={lineItemColumns} />
  {:catch err}
    <div class="detail-error">Could not load. <button onclick={() => retry(p.row.id)}>Retry</button></div>
  {/await}
{/snippet}
```

A thousand-row order grid now loads instantly; line items fetch only for the orders someone opens.

## Cache so re-opening is instant

Collapsing and re-expanding should not refetch. Cache by row id:

```ts
const cache = new Map<string, Promise<LineItem[]>>()
function loadLineItems(id: string) {
  if (!cache.has(id)) cache.set(id, api.lineItems(id))
  return cache.get(id)!
}
```

Caching the promise (not just the result) also dedupes concurrent opens.

## Cancel and clean up

If a user expands then quickly collapses, cancel the in-flight request (AbortController) so you do not waste bandwidth on a panel no one is looking at. Tear down any subscriptions the detail panel created when it collapses.

## Combine with virtualization

Detail panels and row virtualization work together: only visible rows render, and only expanded visible rows load detail. A deep-scrolled grid with one open detail does the work of one fetch, not thousands.

## Frequently asked questions

### How do I lazy-load master-detail content in SvGrid?

Fetch the detail data inside the detail snippet when the row expands - for example with an `{#await}` block - so only opened rows trigger a request. Cache results by row id so re-opening is instant.
