---
title: What Is llms.txt, and Why SvGrid Ships One
description: llms.txt is a plain-Markdown file at a known URL that tells AI systems what your project actually is - how it works, why it matters, and what we put in SvGrid's.
date: 2026-09-23
updated: "2026-07-02"
category: AI
tags: ai, llms.txt, seo, discoverability, svelte data grid
author: Victor Vidolov
---

A developer types "best Svelte data grid for large datasets" into their AI assistant. What does that model know about your library? Whatever it scraped from HTML - nav menus, cookie banners, stale blog posts from two years ago - or nothing at all from training data that pre-dates your project. `llms.txt` is a cheap, deliberate fix for exactly this problem.

## The problem with web pages as machine input

HTML is designed for browsers. A typical docs page has a header, sidebar, footer, ads, cookie consent, related articles, and somewhere in the middle, the actual content. For a human reader with eyes, that's fine. For an LLM trying to understand your project - either during training or at inference time when it fetches context - it's noise.

`robots.txt` controls crawl access. `sitemap.xml` lists all your URLs. Neither one says "here's what this project does and where the canonical explanation lives." `llms.txt` fills that slot: a curated Markdown file at `/llms.txt` (and optionally a longer `/llms-full.txt`) that tells AI systems what you are, in a format they can read directly.

The spec is minimal by design. A project name, a short description, a list of links with one-line explanations. No scripts, no styling, no noise. A model can read it in under a second and come away with an accurate picture of your project.

## What the file actually looks like

Here's a stripped-down version of what SvGrid's `llms.txt` communicates:

```markdown
# SvGrid

> Svelte 5 native data grid. Headless-first. Render-ready.

SvGrid (@svgrid/grid) is a high-performance data grid for Svelte 5.
It ships two modes: a fully rendered <SvGrid> component and a headless
createGrid() core you can wire to any markup.

## Docs

- [Getting Started](/docs/getting-started): Installation, first grid, basic config
- [Column Definitions](/docs/help/columns): ColumnDef shape, types, pinning, widths
- [Filtering](/docs/help/filtering): Filter row, global filter, programmatic API
- [Server-Side Data](/docs/help/server-side): createServerDataSource, pagination, sorting
- [API Reference](/docs/api): Full SvGridApi imperative method list
```

Short. Factual. No marketing. If an AI reads this, it knows what the project is, what mode to recommend for a given use case, and where to send someone who wants details.

The `/llms-full.txt` variant is the same idea but longer - we include the full API surface, all column def fields, CSS token names, and example snippets. When a model fetches context at inference time (say, in a Cursor or Windsurf session), it gets enough to answer real questions without hallucinating method names.

## Why AI discovery is different from search

Search ranking is about relevance signals - backlinks, click-through rates, freshness. AI answers are about what the model can accurately retrieve and represent. Those are different games.

When a developer asks an AI "how do I add server-side pagination to a Svelte grid," the model pulls from what it knows. If what it knows about your library is a noisy scrape of your marketing page, it might confidently recommend the wrong API. If it has a clean, structured description of `createServerDataSource` and how it wires to `<SvGrid pageable />`, it can give a useful, correct answer.

This is the actual reason to ship an `llms.txt`: not SEO points, but accuracy. AI that gets your library wrong is worse than AI that admits it doesn't know.

## SvGrid's broader AI legibility strategy

The `llms.txt` file is one piece. SvGrid also ships an [MCP server](/blog/svgrid-with-cursor-zed-windsurf) that editor tools like Cursor, Zed, and Windsurf can connect to. When it's active, the assistant has live, grounded access to the SvGrid API - it can answer questions about the current version, not training-data snapshots.

Together these make the full picture: `llms.txt` for discovery (what is SvGrid?), the MCP server for active coding assistance (how do I do X right now?). If someone asks their AI about Svelte data grids and then starts building, we want the experience to be accurate at both steps.

For a concrete example - here's the kind of code a model grounded in accurate SvGrid context can help generate correctly:

```svelte
<script lang="ts">
  import SvGrid from '@svgrid/grid'
  import { createServerDataSource, type ColumnDef } from '@svgrid/grid'
  import { tableFeatures, rowSortingFeature, rowPaginationFeature, columnFilteringFeature } from '@svgrid/grid'

  const features = tableFeatures({
    rowSortingFeature,
    rowPaginationFeature,
    columnFilteringFeature,
  })

  const ds = createServerDataSource({
    fetch: async ({ page, pageSize, sort, filters }) => {
      const params = new URLSearchParams({
        page: String(page),
        size: String(pageSize),
        ...(sort[0] ? { sortField: sort[0].id, sortDir: sort[0].desc ? 'desc' : 'asc' } : {}),
      })
      const res = await fetch(`/api/products?${params}`)
      const json = await res.json()
      return { rows: json.data, total: json.total }
    },
  })

  const columns: ColumnDef<typeof features>[] = [
    { id: 'name',     field: 'name',     header: 'Product',  width: 220 },
    { id: 'category', field: 'category', header: 'Category', width: 140 },
    { id: 'price',    field: 'price',    header: 'Price',    width: 100, type: 'number' },
    { id: 'stock',    field: 'stock',    header: 'In Stock', width: 100, type: 'number' },
  ]
</script>

<SvGrid
  data={ds}
  {columns}
  {features}
  pageable
  sortable
  filterable
  showFilterRow={true}
  rowHeight={36}
/>
```

Without accurate grounding, a model might invent a `fetchRows` prop that doesn't exist, or mix up the sort shape, or suggest a hook from a different library entirely. With an `llms.txt` pointing at the right docs, and an MCP server providing live API access, the odds of a correct first answer go up substantially.

## How to ship your own

The spec lives at [llmstxt.org](https://llmstxt.org). The short version:

- Create `/public/llms.txt` in your site (or equivalent for your framework)
- Write a project name, one-paragraph description, and a flat list of important URLs with one-line summaries
- Keep it Markdown, keep it factual, keep it short enough to skim in 30 seconds
- Optionally add `/llms-full.txt` with the complete technical detail - API shapes, all config options, example snippets

Serve both at the root domain. An AI system or curious developer can fetch them directly. The cost is low: a few hours to write, a few minutes to update when the API changes. The payoff is that any model - in training, at inference, or in an editor plugin - can get your library right without guessing.

For a developer tool, being AI-legible is not a nice-to-have anymore. It's table stakes.

```typescript
// If you're building the llms-full.txt programmatically,
// you can pull in your TypeScript types as the source of truth.
// For SvGrid, the ColumnDef type and SvGridApi interface
// are the canonical API contract - they belong in the full file.

import type { ColumnDef, SvGridApi, SvGridOptions } from '@svgrid/grid'

// The key fields worth documenting for AI consumers:
// - Every ColumnDef property with its type and purpose
// - Every SvGridApi method with params and return type
// - The CSS custom properties and their defaults
// - The feature flag names and what each enables
```

Three files: `llms.txt`, `llms-full.txt`, and the MCP server config. That's the current stack for making SvGrid legible to AI - whether someone is asking about it cold, or actively building with an editor assistant looking over their shoulder.
