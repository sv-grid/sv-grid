---
title: How We Started Building SvGrid
description: The architectural calls that everything else rests on - a runes-native engine, a headless core, and a render component - and the first grid that actually rendered.
date: 2026-06-13
category: Company
tags: company, story, engineering, development
author: SvGrid Team
---

The idea was settled: a data grid built natively for Svelte 5. This post is about the part where talk becomes code - the early decisions that are expensive to change later, and the small thrill of the first grid that actually rendered.

## The first commit was an architecture, not a feature

It is tempting to start a grid by rendering a table. We started somewhere less visible: the boundary between the engine and the view. Get that line wrong and every feature afterward pays for it.

We split the project in two from the first commit:

- **`createSvGrid`** - the headless engine. It owns the row model: the pipeline that takes your data and applies sorting, filtering, grouping, pagination, and expansion, producing the rows to display. It renders nothing.
- **`<SvGrid>`** - the render component. It consumes the engine and paints an accessible, virtualized, themeable grid.

The rule we set: anything that is pure logic lives in the core; anything that touches the DOM lives in the component. That single boundary is why, a year later, you can drop from the component to the core for a custom layout and reuse your column definitions untouched.

## Reactivity was the easy part, on purpose

Because we built on runes, the engine's state is just state:

```ts
let sorting = $state([])
let rows = $derived(applySort(applyFilter(data, filters), sorting))
```

No store wrappers, no subscription bookkeeping, no diffing the world on every change. When a filter changes, the derived rows recompute; when an unrelated cell changes, they do not. The reactivity we would have spent weeks engineering on an older model came almost for free - which let us spend that time on the parts that are genuinely hard.

## The column model

The other early decision was the column definition - the contract between your data and the grid. We wanted it typed over your row shape, so a wrong field name is a compile error, not a blank column:

```ts
const columns: ColumnDef<{}, Person>[] = [
  { field: 'firstName', header: 'First name' },
  { id: 'fullName', header: 'Full name', accessorFn: (r) => `${r.firstName} ${r.lastName}` },
]
```

This shape had to serve both layers - the headless core and the render component - because sharing it is what makes the escape hatch real. It is the most-touched type in the whole codebase, so we spent real time getting it right before there were features depending on it.

## The first grid

Then came the moment every project needs: data in, a real `<table>` out, with WAI-ARIA roles and keyboard focus from the very first render. Three rows, three columns, an arrow key moving the active cell. It does not look like much in a screenshot. But it proved the boundary held - the engine produced rows, the component painted them, and neither knew too much about the other.

The first sort followed a day later. Click a header, the derived rows reorder, the DOM updates only where it must. Watching that work on runes, with no re-render ceremony, was the moment we knew the bet was right.

## Principles we fixed early

Some things are cheaper to decide once than to argue about forever:

- **Accessibility is the default, not a setting.** ARIA roles and keyboard navigation shipped in the first render and never became optional.
- **Performance is designed in.** Virtualization was assumed from the start, not bolted on after the grid got slow.
- **Honesty over marketing.** The docs would say when another tool is the better choice. We believe developers reward candor.

## What comes next

A three-row grid is not a hard test. Read next: [pointing SvGrid at 100,000 rows](first-light-100000-rows), the test that decided whether the architecture - and the runes bet - actually held up under load.

## Frequently asked questions

### What was the first architectural decision in SvGrid?

The split between a headless engine (`createSvGrid`) that owns all logic and a render component (`<SvGrid>`) that owns the DOM. That boundary, set in the first commit, is what lets you drop from the component to the core later without rewriting your column code.

### Why was reactivity easy to build in SvGrid?

Because it is native to Svelte 5 runes. Engine state is plain `$state` and derived rows are plain `$derived`, so updates are fine-grained by default - no store wrappers or manual subscription bookkeeping.
