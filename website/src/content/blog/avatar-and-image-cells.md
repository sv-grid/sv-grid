---
title: Avatar and Image Cells in SvGrid
description: Render avatars, logos, and thumbnails in grid cells - with fallbacks, lazy loading, and accessible alt text - using a custom cell snippet.
date: 2026-07-04
category: Cells
tags: avatar, image, cells, custom cells, recipe
author: Kamelia M
---

People grids want faces; product grids want thumbnails, either way, an image makes a table scannable in a way text never will. SvGrid renders any markup in a cell, so an avatar is a small custom cell; the craft is all in the fallbacks, the performance, and the alt text.

## A basic avatar cell

```svelte
{#snippet Avatar(p: { row: Row })}
  <span class="avatar-cell">
    <img src={p.row.avatarUrl} alt={p.row.name} width="28" height="28" loading="lazy" />
    <span>{p.row.name}</span>
  </span>
{/snippet}

// column: { id: 'person', header: 'Person', accessorFn: (r) => r.name,
//           cell: (c) => renderSnippet(Avatar, { row: c.row.original }) }
```

Give the column an `accessorFn` returning the name so the column still sorts and filters by person, not by image URL.

## Fallback when there is no image

Never show a broken image. Fall back to initials on error or when the URL is missing:

```svelte
{#snippet Avatar(p: { row: Row })}
  {#if p.row.avatarUrl}
    <img src={p.row.avatarUrl} alt={p.row.name} width="28" height="28" loading="lazy"
      onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
  {:else}
    <span class="initials">{p.row.name.split(' ').map(s => s[0]).join('')}</span>
  {/if}
{/snippet}
```

## Performance

- **`loading="lazy"`** so off-screen images do not fetch until needed, and with virtualization, only visible cells render at all.
- **Fixed dimensions** (`width`/`height`) to avoid layout shift as images load.
- **Thumbnails, not full images.** Serve a 56px source, not a 2000px hero, for a 28px cell.

## Accessibility

Always set meaningful `alt` text - the person's or product's name - not "avatar". For purely decorative thumbnails alongside a text label, an empty `alt=""` is correct so screen readers do not announce it twice.
