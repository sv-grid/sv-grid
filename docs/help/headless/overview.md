# Headless overview

`<SvGrid>` is the **renderer**. `createSvGrid` is the **engine** that powers it.
They're independent: you can use the engine on its own to build a custom UI,
render a plain `<table>` for print or email, run the row pipeline in a Web
Worker or on a server, or unit-test sort / filter / aggregation logic with no
DOM at all.

![The createSvGrid engine holds state and prop-getters, while the <SvGrid> renderer is one opinionated table built on that same engine.](/docs-media/grid-headless.svg)

```
your data ─▶ createSvGrid (engine) ─▶ row model ─▶ your markup
                     ▲                                  │
                controlled state  ◀──── change events ──┘
```

## What the engine gives you

`createSvGrid(options)` returns a table object with:

- `getRowModel(): { rows: Row<TData>[] }` - the final, post-pipeline rows
  (filtered → sorted → grouped → expanded → paginated),
- `getHeaderGroups(): HeaderGroup<TData>[]` - the multi-level column-header tree,
- `getAllColumns(): Column<TData>[]` - every column with its metadata (id,
  visible, pinned, width),
- imperative setters (`setColumnFilters`, `setPagination`, `setGrouping`,
  `setExpanded`, `setRowSelection`, `setActiveCell`) that push into the engine's
  store. Sorting has no setter - drive it from the `sorting` state you pass in,
  or from a header's `getToggleSortingHandler()`.

No DOM, no CSS, no virtualization - those live in the renderer. Here's the
engine rendering a plain, hand-styled `<table>` (sort + filter are the engine's;
the markup is the demo's):

<div data-docs-demo="186-headless-table" data-height="500"></div>

## When to reach for headless

| You want to… | Use |
| --- | --- |
| A rich grid in a Svelte app | `<SvGrid>` (start here) |
| Render as a plain `<table>` (print / email / RSC) | Headless |
| Drive a server-side row model from Node | Headless, via `createSvGridCore` |
| Unit-test sort / filter / aggregator logic | Headless |
| Build a custom virtualized renderer | Headless + the [virtualizer](./virtualization.md) exports |
| Share one state object across two grids | Headless + [`createGridState`](./controlled-state.md) |

For the common case, use [`<SvGrid>`](../../getting-started/2-first-grid.md) - it wires all
of this for you. Reach for the engine when you need a different renderer or to
run the pipeline where there is no DOM.

## The three ideas

1. **Row models are a pipeline.** You opt into the steps you need
   (`coreRowModel`, `filteredRowModel`, `sortedRowModel`, …); unused steps are
   tree-shaken. See [Row models](./row-models.md).
2. **State is controlled.** You pass `state` in and get `onXxxChange` events
   out - the engine never mutates your state. This is what makes it click with
   Svelte 5 `$state`. See [Controlled state](./controlled-state.md).
3. **Rendering is yours.** The engine hands you rows + header groups; you emit
   the markup. See [Build a table from scratch](./build-a-table.md).

## `createSvGrid` vs `createSvGridCore`

Both build the same engine and expose the same `getRowModel()` /
`getHeaderGroups()` surface. The difference is reactivity:

| | `createSvGrid` | `createSvGridCore` |
| --- | --- | --- |
| State | Svelte 5 runes | plain objects |
| Needs the Svelte compiler | Yes | No |
| Runs under | Vite, SvelteKit, vitest | anywhere Node runs |

Inside a component, use `createSvGrid` - runes are what make `$derived` re-run
the pipeline when your state changes. Outside one - a Node service, a worker, a
CLI, a plain unit test with no Svelte in the pipeline - use `createSvGridCore`
and rebuild it yourself when the state changes:

```js
// plain node script.mjs - no bundler, no compiler
import {
  createSvGridCore,
  createCoreRowModel,
  createSortedRowModel,
  tableFeatures,
  rowSortingFeature,
} from '@svgrid/grid/core'

const features = tableFeatures({ rowSortingFeature })
const table = createSvGridCore({
  _features: features,
  _rowModels: {
    coreRowModel: createCoreRowModel(),
    sortedRowModel: createSortedRowModel(),
  },
  data,
  columns,
  state: { sorting: [{ id: 'salary', desc: true }] },
  onSortingChange: () => {},
})

const rows = table.getRowModel().rows   // sorted, no DOM involved
```

`createSvGrid` imported into a bare Node process throws
`ReferenceError: $state is not defined` - that is the compiler missing, not a
bug. Reach for the core function there.

## See also

- [Build a `<table>` from scratch](./build-a-table.md) - a complete 30-line renderer
- [Styling a headless table](./styling.md) - three looks from one engine
- [Row models](./row-models.md) - the pipeline, step by step
- [Server-side data](./server-side.md) - paging, sorting, filtering, load on demand
- [Controlled state](./controlled-state.md) - `createGridState` / `subscribeGrid`
- [Headless virtualization](./virtualization.md) - render 100k rows yourself
- [Why headless?](../../why-headless.md) - the design rationale
- [Architecture](../architecture.md) - the three-layer model
