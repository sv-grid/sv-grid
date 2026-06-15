---
title: Runes vs Stores in Svelte 5 - When to Use Which
description: Svelte 5 runes do not kill stores. Here is when to reach for $state and when a store is still the better tool, with shared-state examples.
date: 2026-09-02
category: Engineering
tags: svelte 5, runes, stores, state management, engineering
author: Kamelia M
---

Svelte 5 introduced runes, and a common question is whether stores are now obsolete. They are not. Runes and stores overlap but each has its place. Here is how to choose.

## What changed

Before runes, stores (`writable`, `readable`, `derived`) were the main way to hold reactive state, especially outside components. Runes (`$state`, `$derived`) now cover most component state more ergonomically - no `$` prefix gymnastics, no `.subscribe`, deep reactivity by default.

## Reach for runes when...

- **Component state** - local UI state, form values, a grid's sort/filter selection.
- **Shared reactive state in modules** - `$state` works in `.svelte.ts` files, so you can export reactive objects:

```ts
// grid-state.svelte.ts
export const gridState = $state({ sorting: [], filters: [] })
```

Any component importing `gridState` reacts to its changes. This replaces many former store use cases.

## Stores are still useful when...

- **Interop** - libraries and APIs that expose stores (or expect the store contract), including parts of SvelteKit (`page`, `navigating`).
- **Plain `.ts` files without the rune compiler** - runes need `.svelte.ts`/`.svelte.js`; a plain `.ts` module cannot use `$state`. A store works anywhere.
- **Stream-like patterns** - custom stores wrapping events, RxJS, or websockets where the subscribe/unsubscribe contract fits naturally.

The two interoperate: you can read a store's value in a rune context with the `$store` syntax, and wrap a store in derived state.

## A practical default

For new SvGrid-backed apps: use `$state`/`$derived` for component and shared grid state (in `.svelte.ts` modules), and use stores when integrating with store-based libraries or when you need state in a plain `.ts` file. Do not rewrite working stores just to "use runes"; do prefer runes for new state.

## Frequently asked questions

### Are Svelte stores obsolete in Svelte 5?

No. Runes (`$state`, `$derived`) cover most component and shared state more ergonomically, but stores remain useful for interop with store-based libraries (including parts of SvelteKit), for state in plain `.ts` files, and for stream-like subscribe/unsubscribe patterns.

### How do I share reactive state across components in Svelte 5?

Put `$state` in a `.svelte.ts` module and export it; importing components react to its changes. This replaces many cases where you previously reached for a writable store.
