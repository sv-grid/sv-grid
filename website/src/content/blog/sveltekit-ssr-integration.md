---
title: Using SvGrid with SvelteKit and Server-Side Rendering
description: Load data in a SvelteKit load function, render the grid on the server, and hydrate cleanly - SvGrid works under SSR out of the box.
date: 2025-12-16
category: Integration
tags: sveltekit, ssr, hydration, svelte data grid
author: Boyko Markov
---

SvGrid renders meaningful HTML before hydration, so it works under SvelteKit's server-side rendering and static builds without special handling. That means faster first paint and a grid that search engines and crawlers can read.

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
  import { SvGrid } from 'sv-grid-core'
  let { data } = $props()
</script>

<SvGrid data={data.people} columns={columns} />
```

The grid renders on the server with the loaded rows, so the user sees a populated table on first paint instead of a spinner.

## Hydration just works

Because the server output matches what the client would render, hydration is seamless - no mismatch warnings, no flash of empty grid. Interactivity (sorting, editing, selection) lights up as soon as the client takes over.

## Static site generation

For data known at build time, prerender the route. SvGrid emits real table HTML, so a statically generated page ships a complete, crawlable grid even before any JavaScript runs - good for SEO and for users on slow connections.

## Large datasets under SSR

Do not server-render a million rows into the HTML. For big datasets, load the first page on the server for a fast paint, then switch to server-side paging on the client. The user gets an instant first screen and the network stays light.

## Web Components anywhere

Not on SvelteKit? SvGrid can also run as a framework-agnostic custom element, so you can drop a `<sv-grid>` into a React, Vue, Angular, or plain-HTML page and feed it data the same way. The Svelte-native path is the smoothest, but the grid is not locked to it.

## Frequently asked questions

### Does SvGrid work with SvelteKit and SSR?

Yes. It renders real table HTML on the server, so it works under SvelteKit SSR and static builds and hydrates without mismatches.

### Should I server-render a huge dataset into the page?

No. Server-render the first page for a fast paint, then move to server-side pagination on the client so the HTML payload and network stay small.
