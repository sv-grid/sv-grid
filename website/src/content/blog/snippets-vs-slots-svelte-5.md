---
title: Snippets vs Slots in Svelte 5
description: Svelte 5 replaces slots with snippets - a first-class value you can pass as a prop, store in a variable, or select at runtime. Here is what changed, why it matters for grid cell rendering, and where the edge cases bite.
date: 2026-09-06
updated: "2026-07-02"
category: Engineering
tags: svelte 5, snippets, slots, components, engineering
author: Boyko Markov
---

Svelte 5 slots are gone. Not deprecated-but-still-working gone - gone gone. If you open a Svelte 4 component that used `<slot />` or `let:item` inside `<DataList>`, the compiler will tell you to update. The replacement is snippets, and once you understand one key thing about them the rest follows naturally: a snippet is a value, not a hole.

## What a slot was and what it could not do

In Svelte 4, slots were a projection mechanism. You wrote `<slot />` inside a component and the parent's markup flowed in. Named slots let you project into specific holes. Slot props tunneled data from child to parent via `let:`:

```svelte
<!-- Svelte 4 -->
<CellRenderer let:value let:row>
  <svelte:fragment slot="cell">
    <span class="badge" class:active={value === 'active'}>{value}</span>
  </svelte:fragment>
</CellRenderer>
```

This worked but had real limits. You could not store a slot in a variable. You could not choose between two slots based on a condition computed in the parent script. You could not pass a slot as a prop to a grandchild component. A slot existed only at the point it was declared, between the opening and closing tags of the component that defined the hole. It had no identity outside that context.

That limitation matters a lot in a data grid. Column definitions need to carry cell renderer specifications as data - things you build in `<script>`, store in an array, and hand off to a rendering engine. Svelte 4 slots could not participate in that at all.

## Snippets as values

A Svelte 5 snippet is declared with `{#snippet name(param)}` and rendered with `{@render name(param)}`. The important thing is that `name` is a variable. It holds a reference to the snippet, the same way a variable holds a reference to a function. You can pass it to another component as a prop, pick between two of them with `{#if}`, or return one from a regular JavaScript expression.

The minimal translation of the Svelte 4 example above:

```svelte
<!-- Svelte 5 -->
{#snippet statusCell(value: string, row: Deal)}
  <span class="badge" class:active={value === 'active'}>{value}</span>
{/snippet}

<!-- pass it as a prop - the child calls {@render cell(value, row)} -->
<CellRenderer cell={statusCell} />
```

No `let:` directive. No `<svelte:fragment slot="...">`. The parent defines the snippet and owns it; the child receives it and calls it. Data flow is explicit in both directions.

## How SvGrid uses this for column cell renderers

SvGrid's column definitions are plain TypeScript objects. The `cell` field accepts a renderer - either a function that returns a `FlexRender`-compatible descriptor or a snippet wrapped with `renderSnippet`. That wrapper exists because TanStack Table (which SvGrid builds on) drives rendering through its own cell context object, and `renderSnippet` bridges the two worlds.

Here is a realistic pipeline board with three custom cell types - stage badge, probability bar, and ARR figure - all using snippets:

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Stage = 'qualify' | 'discover' | 'propose' | 'negotiate' | 'won' | 'lost'

  type Deal = {
    id: string
    company: string
    owner: string
    arr: number
    probability: number
    stage: Stage
  }

  const STAGE_COLOR: Record<Stage, string> = {
    qualify:   '#94a3b8',
    discover:  '#0ea5e9',
    propose:   '#6366f1',
    negotiate: '#a855f7',
    won:       '#16a34a',
    lost:      '#dc2626',
  }

  const rows: Deal[] = [
    { id: 'd1', company: 'Helios Holdings',    owner: 'S. Park',  arr: 84000,  probability: 60,  stage: 'propose'   },
    { id: 'd2', company: 'Vertex Trust',       owner: 'J. Chen',  arr: 210000, probability: 80,  stage: 'negotiate' },
    { id: 'd3', company: 'Pacific Industries', owner: 'R. Diaz',  arr: 36000,  probability: 10,  stage: 'qualify'   },
    { id: 'd4', company: 'Atlas Group',        owner: 'C. Singh', arr: 120000, probability: 100, stage: 'won'       },
    { id: 'd5', company: 'Stellar Networks',   owner: 'D. Olsen', arr: 55000,  probability: 0,   stage: 'lost'      },
    { id: 'd6', company: 'Quantum Bio',        owner: 'M. Tran',  arr: 95000,  probability: 30,  stage: 'discover'  },
  ]

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi | undefined>(undefined)

  const columns: ColumnDef<typeof features, Deal>[] = [
    { id: 'company',     field: 'company',     header: 'Company', width: 200 },
    { id: 'owner',       field: 'owner',       header: 'Owner',   width: 120 },
    {
      id: 'arr',
      field: 'arr',
      header: 'ARR',
      width: 110,
      cell: (ctx) => renderSnippet(arrCell, { value: ctx.getValue<number>() }),
    },
    {
      id: 'stage',
      field: 'stage',
      header: 'Stage',
      width: 130,
      cell: (ctx) => renderSnippet(stageCell, { stage: ctx.getValue<Stage>() }),
    },
    {
      id: 'probability',
      field: 'probability',
      header: 'Prob %',
      width: 140,
      cell: (ctx) => renderSnippet(probCell, { pct: ctx.getValue<number>() }),
    },
  ]
</script>

{#snippet arrCell(p: { value: number })}
  <span style="font-variant-numeric: tabular-nums">
    ${p.value.toLocaleString('en-US')}
  </span>
{/snippet}

{#snippet stageCell(p: { stage: Stage })}
  <span style="
    background: {STAGE_COLOR[p.stage]};
    color: #fff;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 0.75rem;
    text-transform: capitalize;
  ">
    {p.stage}
  </span>
{/snippet}

{#snippet probCell(p: { pct: number })}
  <div style="display: flex; align-items: center; gap: 6px;">
    <div style="
      width: {p.pct}%;
      max-width: 80px;
      height: 6px;
      background: #6366f1;
      border-radius: 3px;
    "></div>
    <span style="font-size: 0.8rem">{p.pct}%</span>
  </div>
{/snippet}

<SvGrid
  {features}
  data={rows}
  {columns}
  rowHeight={36}
  onApiReady={(a) => (api = a)}
/>
```

The snippets live in the component template, below the `<script>` block. The column definitions are built inside `<script>`. This feels like a contradiction - how can `cell` reference `stageCell` before `stageCell` is declared?

The answer is that `cell` is a callback. It does not run during column array construction; it runs at render time, after the template has been evaluated and the snippet references are live. Svelte resolves this the same way JavaScript closures capture variables: the closure captures the name, and by the time the name is read, the value is there.

## The performance reason snippets beat micro-components for cells

You could also write cell renderers as full Svelte components and use `renderComponent(StageBadge, { stage })`. That works, but each cell instantiates a component - with its own internal state, lifecycle, and effect tracking. In a grid rendering 60 visible rows across 8 columns, that is 480 component instances per repaint.

Snippets have no instance. They are called as functions. `{@render stageCell({ stage })}` is roughly equivalent to calling a function that returns DOM operations - no `onMount`, no `onDestroy`, no `$effect` tracking unless you explicitly add runes inside the snippet body. For purely presentational cells, this is the right default. Reserve `renderComponent` for cells that genuinely need lifecycle: a chart cell that initializes a canvas on mount, or a cell with a subscription to a real-time feed.

## Edge cases that trip people up

**Snippets cannot live in `.ts` files.** They are a template construct. If you pull your column definitions out into a shared `columns.ts` file (common for large grids), you cannot define snippets there. The pattern that works: define the snippets in the `.svelte` page component, then pass them into the column factory as arguments.

```ts
// columns.ts
import { renderSnippet, type ColumnDef } from '@svgrid/grid'
import type { Snippet } from 'svelte'
import type { Deal, Stage } from './types'

export function buildDealColumns(
  stageCell: Snippet<[{ stage: Stage }]>,
  probCell: Snippet<[{ pct: number }]>,
): ColumnDef<Deal>[] {
  return [
    { id: 'company', field: 'company', header: 'Company', width: 200 },
    {
      id: 'stage',
      field: 'stage',
      header: 'Stage',
      width: 130,
      cell: (ctx) => renderSnippet(stageCell, { stage: ctx.getValue<Stage>() }),
    },
    {
      id: 'probability',
      field: 'probability',
      header: 'Prob %',
      width: 140,
      cell: (ctx) => renderSnippet(probCell, { pct: ctx.getValue<number>() }),
    },
  ]
}
```

Then in the `.svelte` file, define the snippets normally and call `buildDealColumns(stageCell, probCell)`. The `Snippet<[ParamType]>` type from Svelte gives you full type checking on what the snippet expects.

**Always annotate snippet parameter types.** Without the explicit type on the parameter, Svelte infers `any`, and you lose the type safety that makes snippets actually useful. The diff is one annotation:

```svelte
<!-- catches field renames at compile time -->
{#snippet stageCell(p: { stage: Stage })}
  {p.stage}
{/snippet}

<!-- silent any, renames silently break at runtime -->
{#snippet stageCell(p)}
  {p.stage}
{/snippet}
```

**The default slot becomes the `children` prop.** When converting a Svelte 4 component that used `<slot />`, the Svelte 5 equivalent is declaring `children` as a `Snippet` prop and calling `{@render children()}`. Named slots become named `Snippet` props, each declared explicitly and rendered with `{@render}`. There is no automatic migration path - each one requires the explicit prop declaration.

## Snippets in headers, not just cells

The `header` field in a `ColumnDef` accepts the same renderer shape as `cell`. That means you can use `renderSnippet` for column headers too - useful when you want a sort indicator, a filter icon, or a tooltip built with your own markup rather than whatever the grid provides by default. The snippet receives whatever props you pass through `renderSnippet`, and the grid calls it the same way it calls cell renderers.

For most columns, the string header is fine. But for a grid that exposes a feature-rich header row - say, a drag handle for reordering plus an inline filter chip - custom header snippets are the cleanest way to own that markup without fighting the grid's internal rendering.
