---
title: Using SvGrid in Astro with Svelte Islands
description: Drop SvGrid into an Astro site as a Svelte island - hydration directives, passing server data as props, and keeping the rest of the page static.
date: 2026-06-13
category: Integration
tags: astro, islands, svelte, integration, svelte data grid
author: Victor Vidolov
---

Astro's islands architecture lets you ship mostly static HTML with small interactive components hydrated on demand. A data grid is a perfect island: the page stays fast, and only the grid becomes interactive. Here is how to use SvGrid in Astro.

## Set up the Svelte integration

```bash
npx astro add svelte
npm add sv-grid-community
```

This enables `.svelte` components inside Astro pages.

## The island

Put the grid in a Svelte component and render it from an Astro page with a hydration directive:

```astro
---
// src/pages/people.astro
import PeopleGrid from '../components/PeopleGrid.svelte'
const people = await fetch(`${import.meta.env.API}/people`).then(r => r.json())
---
<h1>People</h1>
<PeopleGrid {people} client:load />
```

```svelte
<!-- src/components/PeopleGrid.svelte -->
<script lang="ts">
  import { SvGrid, type ColumnDef } from 'sv-grid-community'
  let { people }: { people: Row[] } = $props()
  const columns: ColumnDef<{}, Row>[] = [/* ... */]
</script>
<div style="height: 600px;"><SvGrid data={people} columns={columns} /></div>
```

## Choosing a hydration directive

- `client:load` - hydrate immediately. Use when the grid is above the fold and central to the page.
- `client:visible` - hydrate when scrolled into view. Great for a grid lower on a long page.
- `client:idle` - hydrate when the browser is idle.

Fetch the data in the Astro frontmatter (server-side) and pass it as props so the first paint is fast and SEO-friendly; the island hydrates into a fully interactive grid.

## Sizing

As always, give the grid a bounded height (here a `600px` wrapper) so virtualization engages. See [render your first grid](render-your-first-svelte-data-grid).

## Frequently asked questions

### How do I add a data grid to an Astro site?

Add the Svelte integration (`npx astro add svelte`), put SvGrid in a `.svelte` component, and render it from an Astro page with a hydration directive like `client:load` or `client:visible`. Fetch data in the page frontmatter and pass it as props.

### Which Astro hydration directive should I use for a grid?

Use `client:load` for a grid that is central and above the fold, or `client:visible` to defer hydration until the grid scrolls into view - ideal for keeping a long, mostly static page fast.
