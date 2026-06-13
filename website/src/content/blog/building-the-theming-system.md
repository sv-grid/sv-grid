---
title: 'Inside SvGrid: A Theming System on CSS Variables'
description: Why SvGrid is themed entirely with --sg-* CSS custom properties, how dark mode falls out for free, and the choice to avoid a JavaScript theme config.
date: 2026-06-13
category: Engineering
tags: theming, dark mode, css, engineering, story
author: SvGrid Team
---

Moving from behavior to appearance. A data grid that only looks right in its own demo is useless, so SvGrid had to fit into other people's products without a fight. The question was how to make it themeable without inventing a configuration language nobody wants to learn.

## The decision: no theme object

Plenty of components ship a JavaScript theme config - a big object of tokens you import, override, and pass in. We deliberately did not. Every visual surface in SvGrid reads from a CSS custom property prefixed `--sg-*`, so you restyle it with plain CSS:

```css
.my-grid {
  --sg-bg: #ffffff;
  --sg-fg: #1f2933;
  --sg-border: #e4e7eb;
  --sg-header-bg: #f5f7fa;
  --sg-row-alt-bg: #fafbfc;
}
```

The reasoning was simple: developers already know CSS. A cascading variable is something you can scope, override per-grid, and point at your existing design tokens without importing anything or rebuilding. No theme builder, no JS object, no rebuild step.

## Dark mode for free

Once every color is a token, dark mode stops being a feature and becomes a consequence. Define two sets of tokens keyed off an attribute and flip the attribute:

```css
:root[data-theme='light'] { --sg-bg: #fff;    --sg-fg: #111; }
:root[data-theme='dark']  { --sg-bg: #181d27; --sg-fg: #e2e8f0; }
```

The grid follows instantly, with no re-render and no flash, because it never hard-codes a color. We got light/dark essentially for free out of a decision we made for a different reason - the best kind of architecture payoff.

## Inheriting a design system

The real test was whether SvGrid could disappear into an existing product. Because the tokens are just CSS variables, you can point them at your design system:

```css
.my-grid {
  --sg-accent: var(--brand-500);
  --sg-border: var(--gray-200);
}
```

Now the grid inherits your brand color and spacing scale, and a future rebrand updates it for free. That is the difference between a grid that looks like our product and one that looks like yours.

## What we deliberately left out

We resisted adding a runtime theming API. The platform already has one - it is called CSS - and competing with it would have meant a worse, smaller version of the cascade. The practical guide is [Theming a Svelte Data Grid with CSS Variables and Dark Mode](theming-and-dark-mode); the philosophy is just "use the platform."

## What it set up

With theming on plain CSS variables, SvGrid could slot into real products and match real brands. That left one big area: data that does not fit in the browser. Read next: [server-side data and the headless core](server-side-data-and-the-headless-core).

## Frequently asked questions

### How do you theme SvGrid?

Override the `--sg-*` CSS custom properties on the grid or at the root. Every surface reads from these tokens, so you restyle the grid with plain CSS - no JavaScript theme object or rebuild required.

### How does dark mode work in SvGrid?

Define light and dark token sets keyed off a `data-theme` attribute and toggle that attribute. Because every color is a CSS variable, the grid updates instantly with no re-render or flash.
