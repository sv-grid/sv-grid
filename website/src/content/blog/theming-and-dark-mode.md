---
title: Theming a Svelte Data Grid with CSS Variables and Dark Mode
description: Customize SvGrid colors, borders, and density with --sg-* CSS custom properties, and wire up dark mode in one line.
date: 2026-03-10
category: Theming
tags: theming, dark mode, css variables, svelte data grid
author: Kamelia M
---

A data grid should disappear into your product, not announce that it came from a library. SvGrid is themed entirely with `--sg-*` CSS custom properties, which means you restyle it with plain CSS you already know - no theme builder, no JavaScript config object to learn.

![Custom cells and theming in SvGrid](/blog-media/custom-cells-themes.png)
*Custom cell renderers and theming in SvGrid.*

## The token system

Every visual surface reads from a token: background, foreground, borders, header, zebra rows, hover, and selection. Override them on a wrapper or at the root:

```css
.my-grid {
  --sg-bg: #ffffff;
  --sg-fg: #1f2933;
  --sg-border: #e4e7eb;
  --sg-header-bg: #f5f7fa;
  --sg-row-alt-bg: #fafbfc;
}
```

Because these are cascading CSS variables, you can theme the whole app once or scope a different palette to a single grid.

## Dark mode in one line

The cleanest pattern is a `data-theme` attribute on `<html>` and two blocks of tokens:

```css
:root[data-theme='light'] { --sg-bg: #fff;     --sg-fg: #111; }
:root[data-theme='dark']  { --sg-bg: #0f1525;  --sg-fg: #e8ecf6; }
```

```ts
document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
```

The grid follows automatically because every color is a token. No re-render, no flash.

## Density and row height

Compact tables fit more data; comfortable tables are easier to scan. Control row height with the matching prop and padding tokens so you can offer a density switch in your UI without touching the grid internals.

## Match your design system

Already on Tailwind or a design-token pipeline? Point the `--sg-*` variables at your existing tokens:

```css
.my-grid {
  --sg-accent: var(--brand-500);
  --sg-border: var(--gray-200);
}
```

Now the grid inherits your brand color and spacing scale, and a future rebrand updates the grid for free.

## Frequently asked questions

### How do I change the colors of a Svelte data grid?

Override the `--sg-*` CSS custom properties on the grid wrapper or at the root. Every surface - background, header, borders, zebra rows - reads from these tokens.

### How do I add dark mode to SvGrid?

Define light and dark token sets keyed off a `data-theme` attribute and toggle that attribute on `<html>`. The grid updates instantly because all colors are CSS variables.
