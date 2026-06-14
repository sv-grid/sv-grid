---
title: Using SvGrid with Flowbite Svelte
description: Combine SvGrid with Flowbite Svelte - match the grid to Flowbite's Tailwind theme and build toolbars and cell controls from Flowbite components.
date: 2026-06-13
category: Integration
tags: flowbite, theming, design system, integration, svelte data grid
author: SvGrid Team
---

Flowbite Svelte is a Tailwind-based component library with a polished default look. SvGrid pairs well with it: use Flowbite for the chrome (buttons, dropdowns, inputs) and SvGrid for the data grid itself, themed to match via `--sg-*` variables.

## Match the palette

Flowbite builds on Tailwind, so theme the grid against the same Tailwind tokens Flowbite uses (often a `primary` color scale):

```css
.app-grid {
  --sg-accent:     var(--color-primary-600);
  --sg-border:     var(--color-gray-200);
  --sg-header-bg:  var(--color-gray-50);
  --sg-row-alt-bg: var(--color-gray-50);
}
.dark .app-grid {
  --sg-bg: #1f2937; --sg-fg: #f3f4f6; --sg-border: #374151;
}
```

Flowbite toggles dark mode with the `dark` class, and SvGrid follows because its colors are variables. See [theming with Tailwind](theming-svgrid-with-tailwind).

## Toolbar from Flowbite

Build the grid's controls from Flowbite components so they match the rest of your UI:

```svelte
<Toolbar>
  <Input bind:value={query} placeholder="Search..." />
  <Dropdown>...</Dropdown>
  <Button onclick={exportRows}>Export</Button>
</Toolbar>
<div class="app-grid min-h-0 flex-1"><SvGrid data={rows} columns={columns} features={features} /></div>
```

## Action cells

Render Flowbite buttons inside cells with `renderSnippet` for consistent, accessible row actions:

```svelte
{#snippet Actions(p: { row: Row })}<Button size="xs" onclick={() => edit(p.row)}>Edit</Button>{/snippet}
```

## Frequently asked questions

### How do I make SvGrid match Flowbite Svelte?

Theme SvGrid's `--sg-*` variables against the same Tailwind color tokens Flowbite uses (such as the primary scale), and define dark values under Flowbite's `dark` class. The grid then matches Flowbite's look and dark mode.

### Should I use Flowbite components inside the grid?

Use them for the toolbar and for action cells (via `renderSnippet`) so controls match your UI, and let SvGrid render the grid body. Flowbite's buttons and inputs are accessible, so that carries into the cells.
