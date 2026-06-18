---
title: Using SvGrid with SvelteKit and Server-Side Rendering
description: Load data in a SvelteKit load function, render the grid on the server, and hydrate cleanly - SvGrid works under SSR out of the box.
date: 2025-12-16
category: Integration
tags: sveltekit, ssr, hydration, svelte data grid
author: Boyko Markov
---

Plenty of grids fall apart under SSR because they assume the browser is already there. SvGrid renders meaningful HTML before hydration, so it just works under SvelteKit's server-side rendering and static builds, no `onMount` guards, no `browser` checks. You get a faster first paint and a grid crawlers can actually read.

## Load data in `+page.ts`

Fetch on the server (or at build time) in a load function and pass the rows to your page:

```ts
// +page.ts
export async function load({ fetch }) {
  const res = await fetch('/api/people')
  return { people: await res.json() }
}
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'
  let { data } = $props()
</script>

<SvGrid data={data.people} columns={columns} />
```

The grid renders on the server with the loaded rows, so the user sees a populated table on first paint instead of a spinner.

## Hydration just works

Because the server output matches what the client would render, hydration is seamless, no mismatch warnings, no flash of empty grid. Interactivity (sorting, editing, selection) lights up as soon as the client takes over.

## Static site generation

For data known at build time, prerender the route. SvGrid emits real table HTML, so a statically generated page ships a complete, crawlable grid even before any JavaScript runs, good for SEO and for users on slow connections.

## Large datasets under SSR

Do not server-render a million rows into the HTML. For big datasets, load the first page on the server for a fast paint, then switch to server-side paging on the client. The user gets an instant first screen and the network stays light.

## Web Components anywhere

Not on SvelteKit? SvGrid can also run as a framework-agnostic custom element, so you can drop a `<sv-grid>` into a React, Vue, Angular, or plain-HTML page and feed it data the same way. The Svelte-native path is the smoothest, but the grid is not locked to it.
