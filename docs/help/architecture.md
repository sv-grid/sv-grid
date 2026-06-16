# Architecture overview

A one-page mental model that should let you reason about every other
topic in the docs. SvGrid is a strict three-layer system - if you know
which layer a piece of code lives in, you know what it can and cannot
do.

## The three layers

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3  │  <SvGrid> render component (Svelte 5)           │
│           │  - DOM, scroll, virtualization, editor popovers │
│           │  - keyboard handlers, pointer events            │
│           │  - sticks the headless engine to a viewport     │
├───────────┼─────────────────────────────────────────────────┤
│  Layer 2  │  Headless engine (createSvGrid)                 │
│           │  - column model + row model pipeline            │
│           │  - sort, filter, group, paginate, expand        │
│           │  - aggregators, accessors, comparators          │
│           │  - 100% pure functions, no DOM                  │
├───────────┼─────────────────────────────────────────────────┤
│  Layer 1  │  Your data + your column definitions            │
│           │  - the only thing YOU author                    │
│           │  - plain TypeScript: arrays, objects, types     │
└───────────┴─────────────────────────────────────────────────┘
```

Layer 1 is yours. Layer 2 is `sv-grid-core` minus the renderer.
Layer 3 is the `<SvGrid>` component everyone uses by default.

**You can use Layer 2 without Layer 3.** That's the headless promise:
if you want to render the grid yourself - in Tailwind cards, a print
PDF template, a custom virtualization layer - import `createSvGrid`
and read the state directly.

## Data flow on every render

```
raw data ──► engine pipeline ──► visible rows ──► renderer
   (you)        (Layer 2)         (Layer 2 out)    (Layer 3)
                    │
                    ▼
            ┌────────────────────────────┐
            │ 1. coreRowModel            │  shape data into Row objects
            │ 2. filteredRowModel        │  apply column + global filters
            │ 3. sortedRowModel          │  apply sort spec
            │ 4. groupedRowModel         │  apply groupBy + aggregators
            │ 5. expandedRowModel        │  flatten expanded groups
            │ 6. paginatedRowModel       │  slice the visible page
            └────────────────────────────┘
```

Every "feature" you register in `tableFeatures({ ... })` plugs one or
more row models into this pipeline. Disable a feature and that stage
no-ops. The pipeline runs once per state change, **not per scroll
frame** - virtualization is purely a presentational concern.

## The two APIs you'll use

### Declarative (the `<SvGrid>` props)

99% of consumers stop here. You author `data`, `columns`, and `features`,
then handle events from props:

```svelte
<SvGrid
  data={rows}
  columns={columns}
  features={features}
  onCellValueChange={handleChange}
  onActiveCellChange={handleFocus}
/>
```

### Imperative (`SvGridApi`)

For toolbars, ribbons, keyboard shortcuts that need to drive the grid,
ask for the API via `onApiReady`:

```svelte
<SvGrid
  ...
  onApiReady={(api) => {
    api.setSort('name', 'asc')
    api.setFilter('region', { operator: 'equals', value: 'EMEA' })
  }}
/>
```

See the [API reference](./api-reference.md) for the full surface.

## State ownership

Two questions decide where each piece of state lives:

| Question                                   | Lives in                  |
| ------------------------------------------ | ------------------------- |
| Does it change row content or cell values? | **Your component** (`$state`) - hand the new array down to `data`. |
| Is it a column/grid setting (sort, filter, group, page)? | **The engine** owns it. Use `api.setSort(...)` etc., or pass an initial state. |
| Is it a visual concern (column widths, hover)? | **The renderer** owns it. The grid manages this internally. |

This split is deliberate: the engine is dataless, so it can't "lose"
your rows. Your component is rendererless, so it can't accidentally
mutate DOM nodes during a sort.

## Where each topic page sits

| Topic                                | Layer  | Why                                                                       |
| ------------------------------------ | ------ | ------------------------------------------------------------------------- |
| [Column definitions](./columns/column-definitions.md) | 1      | Pure types you author.                                       |
| [Row data](./rows/row-data.md)       | 1      | Your input.                                                               |
| [Row sorting](./rows/row-sorting.md) | 2      | Engine row-model.                                                         |
| [Filtering overview](./filtering/overview.md) | 2 + 3 | Engine for the pipeline; renderer for the popovers + filter row.       |
| [Row pagination](./rows/row-pagination.md) | 2     | Engine slice.                                                            |
| [Editing](./editing/overview.md)     | 3      | DOM editors live in the renderer.                                         |
| [Tree rows](./rows/tree-rows.md)     | 1 + 3 | You derive `visibleRows`; the renderer indents + draws chevrons.          |
| [Pivot tables](./pivot.md)           | 1 + 2 | You build the pivot engine; the renderer uses standard nested headers.    |
| [AI assistant](./ai.md)              | 2     | Pure helpers; the renderer never sees them.                              |
| [Export / import](./export.md), [import](./import.md) | 2 + 3 | Helpers + browser-side file IO.                              |

## Why this matters for shipping

- **You can test Layer 2 without a DOM.** Every engine helper is a
  pure function. Vitest in node, no jsdom required. See
  [Testing your grid](./testing.md).
- **You can swap Layer 3.** If your design system has its own table
  primitive, drop `<SvGrid>` and read from `createSvGrid()` directly.
- **Layer 2 is the public API surface.** Imports, exports, and types
  are versioned per the [API stability](./api-stability.md) policy.
  The renderer's CSS classes are NOT - override them at your peril.

## Where the layers physically live

| Layer | Source path                                       | Build output                         |
| ----- | ------------------------------------------------- | ------------------------------------ |
| 1     | Your app                                          | n/a                                  |
| 2     | `packages/sv-grid-core/src/core.ts` + row-models | `dist/index.js` (~13 kB gzip)    |
| 3     | `packages/sv-grid-core/src/SvGrid.svelte`    | bundled with the engine (~49 kB gzip total) |
|       | `packages/sv-grid-pro/src/{export,print,import,ai}.ts` | `sv-grid-pro/dist/*` (lazy-loaded peers) |

## See also

- [Why headless?](../why-headless.md) - the design rationale for the
  Layer 2 / Layer 3 split.
- [API reference](./api-reference.md) - every export with its layer
  noted.
- [Performance benchmarks](./benchmarks.md) - numbers from each layer
  in isolation.

## Frequently asked questions

### How is SvGrid architected?

As three strict layers: a headless core engine (state + row-model pipeline), a
Svelte render component (`<SvGrid>`) that draws the DOM, and your application
code. Knowing which layer a piece of code lives in tells you what it can and
cannot do.

### What does "headless" mean for SvGrid?

The core engine computes sorting, filtering, grouping, and selection state
without rendering anything. You can drive your own markup with it, or drop in the
batteries-included `<SvGrid>` component that renders on top of the same engine.

### Can I use the engine without the SvGrid component?

Yes. Use `createSvGrid` and the row-model factories directly to build a custom
rendering layer. The render component is optional sugar over the same public
engine API.
