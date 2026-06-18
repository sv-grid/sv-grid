---
title: The Headless UI Pattern - Separating Logic from Presentation
description: What "headless" means in modern component libraries, the trade-offs versus all-in-one components, and how SvGrid offers both layers.
date: 2026-05-22
category: Architecture
tags: headless ui, architecture, design patterns, component design
author: Boyko Markov
---

"Headless" is one of those words that is everywhere and explained almost nowhere. In UI libraries it actually has a precise meaning, and once it clicks you make better calls about which tool - and which layer of a tool - to reach for. Let me walk through it the practical way, with a data grid as the running example.

## What headless actually means

A headless component provides behavior and state without rendering any markup. It manages the hard logic - in a grid's case, filtering, sorting, grouping, pagination, selection - and hands you the results to render however you like. You bring the DOM; it brings the brains.

Contrast that with an all-in-one component, which bundles behavior *and* a full opinionated UI. You drop it in and it looks and works a certain way out of the box.

Neither is better in the abstract. They are different points on a curve that trades convenience against control.

## The trade-off

| | All-in-one component | Headless logic |
| --- | --- | --- |
| Time to first render | Minutes | Longer - you build the UI |
| Visual control | Themeable, within limits | Total |
| Behavior you get free | Everything | Everything except markup |
| Risk of hitting a wall | Higher | Very low |

The all-in-one path is faster until the day your design requires something the component does not expose. The headless path is slower up front but rarely dead-ends, because you own the rendering.

## Why "logic without markup" is powerful

Separating the data pipeline from presentation gives you three things:

1. **Reuse.** The same engine drives a table, a card grid, a Kanban board, or a virtualized list.
2. **Testability.** You can test the sort/filter/group logic without a DOM.
3. **Longevity.** Design systems change more often than data logic. Headless logic survives a re-skin.

## The catch: you build the boring parts

Headless freedom comes with a bill. Accessibility, keyboard navigation, virtualization, focus management - all the unglamorous, easy-to-get-wrong work - is now yours. For a grid, that is a lot of work, and it is precisely where naive in-house tables fall down.

## Having it both ways

The pragmatic answer is a library that ships both layers on a shared foundation. SvGrid does exactly this:

- **`createSvGrid`** is the headless engine, the row-model pipeline, no markup.
- **`<SvGrid>`** is a render component built on that engine, with accessibility, virtualization, and theming already solved.

```svelte
<!-- The render component: convenience -->
<SvGrid data={rows} columns={columns} features={features} />
```

```ts
// The headless core: control, same column definitions
const grid = createSvGrid({ data: rows, columns, features })
```

You start with the component and its solved accessibility and performance. The day one screen needs a custom layout, you drop to the core and reuse your column definitions. No wall, no rewrite.

## How to choose for your project

- Need a standard data table fast? Use the render component.
- Need a bespoke layout but not the burden of re-implementing sort and filter? Use the headless core.
- Not sure? Start with the component. The escape hatch is there when you need it.

## Frequently asked questions

### What is a headless UI component?

One that provides behavior and state - like a grid's sorting, filtering, and pagination - without rendering any markup. You supply the DOM, which gives you total visual control.

### Should I use a headless library or an all-in-one component?

Use an all-in-one component for speed and a standard look; use headless logic when you need full control over the markup. Libraries like SvGrid offer both layers on one foundation, so you can switch without rewriting your data code.
