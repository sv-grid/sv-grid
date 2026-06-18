---
title: Empty, Loading, and Error States for a Svelte Data Grid
description: The three states every data grid needs but teams forget - a helpful empty state, a non-jarring loading state, and a recoverable error state.
date: 2026-07-27
category: Data
tags: empty state, loading, error handling, ux, recipe
author: Kamelia M
---

In a demo a grid is always full of data. In production it spends real time empty, loading, or broken, and those three states are exactly where "finished" lives. Almost everyone builds the happy path and forgets them, which is precisely why handling them well makes your grid feel a cut above. Here is how.

![Named, saved views in SvGrid.](/blog-media/named-views.png)
*Named, saved views in SvGrid.*

## Empty state: distinguish "no data" from "no matches"

There are two empties, and they need different messages:

- **No data at all**: "No customers yet. Add your first one." with a primary action.
- **No matches for the current filters**: "No rows match these filters." with a "Clear filters" button.

```svelte
{#if rows.length === 0}
  {#if hasActiveFilters}
    <div class="state">No rows match these filters. <button onclick={clearFilters}>Clear filters</button></div>
  {:else}
    <div class="state">No data yet. <button onclick={create}>Add the first record</button></div>
  {/if}
{:else}
  <SvGrid data={rows} columns={columns} features={features} />
{/if}
```

Showing "no data" when the user just over-filtered is a classic, confusing bug, always tell them which empty it is.

## Loading state: do not flash or jump

For the first load, a skeleton (a few shimmer rows) reads better than a spinner because it previews the layout. For subsequent loads (paging, refetch), keep the current rows visible with a subtle overlay rather than blanking the grid, blanking on every page change feels broken.

```svelte
{#if loading && rows.length === 0}
  <Skeleton rows={8} />
{:else}
  <div class="grid-wrap" class:is-fetching={loading}>
    <SvGrid data={rows} columns={columns} features={features} />
  </div>
{/if}
```

## Error state: make it recoverable

An error is not a dead end. Show what happened and a way out:

```svelte
{#if error}
  <div class="state error">
    Could not load data. <button onclick={retry}>Retry</button>
  </div>
{/if}
```

Keep the previous rows visible if you have them, so a failed refresh does not wipe the screen. Log the detail; show the user a calm message.

## Why this matters

These states are what separate a demo from a product. They are also cheap - a few conditionals around the grid - and they are the kind of thing reviewers and users notice immediately. Build them into your grid component once and reuse everywhere; they pair naturally with [server-side data](server-side-data) and [Storybook stories](svgrid-in-storybook) for each state.

## Frequently asked questions

### What states should a data grid handle besides showing data?

At least three: an empty state (distinguishing "no data yet" from "no rows match your filters"), a loading state (skeleton on first load, subtle overlay on refetch), and a recoverable error state with a retry that keeps any existing rows visible.
