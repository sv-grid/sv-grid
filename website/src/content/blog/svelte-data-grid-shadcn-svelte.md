---
title: Using SvGrid with shadcn-svelte
description: Make SvGrid match your shadcn-svelte design by mapping its --sg-* tokens to shadcn's CSS variables, so the grid blends into the rest of your UI.
date: 2026-06-13
category: Integration
tags: shadcn-svelte, theming, design system, integration, svelte data grid
author: Boyko Markov
---

shadcn-svelte styles everything through a tidy set of CSS variables, `--background`, `--foreground`, `--border`, `--primary`. SvGrid is themed through `--sg-*` variables. Wire one set to the other and the grid stops looking like a guest and starts looking like part of your shadcn UI.

## Bridge the tokens

shadcn-svelte defines its palette on `:root` and `.dark`. Map SvGrid's tokens to those same variables:

```css
.app-grid {
  --sg-bg:         hsl(var(--background));
  --sg-fg:         hsl(var(--foreground));
  --sg-border:     hsl(var(--border));
  --sg-header-bg:  hsl(var(--muted));
  --sg-row-alt-bg: hsl(var(--muted) / 0.4);
  --sg-accent:     hsl(var(--primary));
}
```

Because shadcn already defines light and dark values for these variables, the grid gets dark mode for free, flip shadcn's `.dark` class and SvGrid follows.

## Use shadcn components in cells

For custom cells, render shadcn-svelte components inside a snippet so actions match the rest of your app:

```svelte
{#snippet RowActions(p: { row: Row })}
  <Button variant="ghost" size="sm" onclick={() => edit(p.row)}>Edit</Button>
{/snippet}
// column: { id: 'actions', header: '', cell: (c) => renderSnippet(RowActions, { row: c.row.original }) }
```

Keep these accessible, shadcn's `Button` renders a real `<button>`, so keyboard and screen-reader support carry over. See [custom cell renderers](custom-cell-renderers-with-snippets).

## Toolbar consistency

Build the grid's toolbar (search input, filter dropdowns, view toggles) from shadcn components, and let SvGrid own the grid body. The result reads as one cohesive design system.

## Frequently asked questions

### How do I make SvGrid match shadcn-svelte?

Map SvGrid's `--sg-*` variables to shadcn's tokens (for example `--sg-bg: hsl(var(--background))`, `--sg-accent: hsl(var(--primary))`). The grid then inherits shadcn's palette and dark mode automatically.

### Can I use shadcn-svelte components inside grid cells?

Yes. Render them in a Svelte snippet via `renderSnippet`. shadcn components use real interactive elements, so accessibility carries over, and the cells match the rest of your UI.
