---
title: Sync Grid State to the URL in Svelte
description: Make a data grid's sort, filter, and page state shareable and bookmarkable by syncing it to the URL query string in SvelteKit.
date: 2026-06-13
category: Data
tags: url state, shareable, sveltekit, recipe, svelte data grid
author: Victor Vidolov
---

Put the grid's state in the URL and a filtered, sorted view suddenly becomes a thing you can bookmark, paste into Slack, or reload straight back into, and the back button starts behaving the way people expect.

![Barcode and rich cells in a SvGrid catalog.](/blog-media/barcode.png)
*Barcode and rich cells in a SvGrid catalog.*

## Read state from the URL

On load, initialize the grid from the query string so a shared link reproduces the view:

```svelte
<script lang="ts">
  import { page } from '$app/stores'
  const params = $derived($page.url.searchParams)
  let sort = $state(params.get('sort') ?? 'name')
  let desc = $state(params.get('desc') === 'true')
  let q = $state(params.get('q') ?? '')
  let pageIndex = $state(Number(params.get('page') ?? 0))
</script>
```

## Write state back on change

When the user sorts, filters, or pages, update the URL. Use `replaceState`-style navigation so you do not flood history with every keystroke:

```ts
import { goto } from '$app/navigation'

function syncUrl() {
  const p = new URLSearchParams({ sort, desc: String(desc), q, page: String(pageIndex) })
  goto(`?${p}`, { replaceState: true, keepFocus: true, noScroll: true })
}
```

Call `syncUrl()` from the grid's `onSortingChange`, `onFiltersChange`, and `onPaginationChange`. `keepFocus` and `noScroll` keep the interaction seamless.

## Debounce the noisy parts

Filter text changes rapidly; debounce the URL write (and any fetch) so typing does not create a navigation per character. Sorting and paging are discrete, so sync those immediately.

## Why it is worth it

- **Shareable views**: send a teammate a link to exactly what you see.
- **Bookmarkable**: save a frequent filter.
- **Reload-safe**: refresh keeps the view.
- **Server-friendly**: if you do server-side data, the same params drive the query, so SSR can render the right page on first load.

## Frequently asked questions

### How do I make a Svelte data grid's view shareable?

Sync the grid's sort, filter, and page state to the URL query string: initialize the grid from `searchParams` on load, and update the URL in the grid's callbacks using `goto(..., { replaceState: true })`. The link then reproduces the exact view.

### How do I avoid spamming browser history when filtering?

Debounce the URL update for filter text and use `replaceState: true` so rapid changes replace the current entry instead of pushing many. Sync discrete actions like sorting and paging immediately.
