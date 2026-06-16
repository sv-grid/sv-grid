# Why headless?

SvGrid is **headless at the core**, with a fully-styled Svelte component
shipped on top. That two-layer split is deliberate, and worth
understanding before you reach for either.

## What "headless" actually means here

The core - `createSvGrid` from `sv-grid-core/core` - knows about
rows, columns, sorting, filtering, grouping, pagination, expansion, and
selection. It does **not** know about pixels, DOM, ARIA, or CSS. It is
a state machine over your data that you query and mutate from Svelte.

The component - `<SvGrid>` - is one (opinionated) way to render that
state machine into a `<table>`. It is itself written against the
headless core, so the same hooks are available to you if you want to
write your own renderer.

```text
┌──────────────────────────────────────────────────────┐
│  Your app                                            │
└───────────────┬──────────────────────────────────────┘
                │
                ▼
       ┌─────────────────────┐
       │   <SvGrid> (Svelte) │   ← default renderer, ARIA,
       │   FlexRender        │     keyboard, drag handles,
       │   formatters, menus │     theme tokens
       └─────────┬───────────┘
                 │
                 ▼
       ┌─────────────────────┐
       │  createSvGrid()     │   ← rows × cols × state
       │  row models         │     sort / filter / page /
       │  features           │     group / expand
       └─────────────────────┘
```

## What you get from headless

**1. The renderer is replaceable.** Want a virtualised React grid? A
canvas-based renderer for 1 M rows? A read-only `<table>` for a printed
report? `createSvGrid` returns the same state machine for all of them.
You write the markup, you keep the headless brain.

```ts
import { createSvGrid, createCoreRowModel, createSortedRowModel,
         tableFeatures, rowSortingFeature, sortFns } from 'sv-grid-core'

const grid = createSvGrid({
  _features: tableFeatures({ rowSortingFeature }),
  _rowModels: {
    coreRowModel: createCoreRowModel(),
    sortedRowModel: createSortedRowModel(sortFns),
  },
  columns,
  data,
})

// Your own render loop:
for (const row of grid.getRowModel().rows) {
  for (const cell of row.getAllCells()) drawCell(cell)
}
```

**2. Features are opt-in modules.** Monolithic grid libraries ship everything
in one bundle. With SvGrid you only register what you use:

```ts
import { tableFeatures, rowSortingFeature } from 'sv-grid-core'

// no filtering, no grouping, no pagination - none of that code is
// reachable from this grid instance
const features = tableFeatures({ rowSortingFeature })
```

The features object is the contract the headless core checks for
optional capabilities. Each feature ships a small chunk of state +
helpers; if it's not in `tableFeatures()`, the core never asks for it
and Vite tree-shakes away the rest.

**3. Tests are fast and DOM-free.** `createSvGrid` runs without a
browser:

```ts
import { createSvGrid, ... } from 'sv-grid-core'

test('sorts by salary descending', () => {
  const grid = createSvGrid({ ..., state: { sorting: [{ id: 'salary', desc: true }] } })
  const rows = grid.getRowModel().rows
  expect(rows[0]!.getValue('salary')).toBeGreaterThan(rows[1]!.getValue('salary'))
})
```

No JSDOM, no Playwright, no test renderer. The headless contract is the
unit of test.

**4. Server-side rendering is a non-feature.** Because the core has no
DOM, you can call `grid.getRowModel().rows` inside a SvelteKit
`+page.server.ts` and pre-bake the table HTML before it ever reaches
the browser. Demo [`19-ssr`](../examples/src/demos/19-ssr.svelte)
walks through that.

**5. State is yours to own.** Sort clauses, filter predicates, expansion
state, selection state - all of it lives in a `store` you can serialise
to a URL, sync to a query string, or restore from `localStorage`. The
default `<SvGrid>` wires this up for you, but the wires are visible:

```ts
// Persist
localStorage.setItem('grid', JSON.stringify(grid.getState()))

// Restore
const saved = JSON.parse(localStorage.getItem('grid')!)
grid.store.setState((prev) => ({ ...prev, ...saved }))
```

## When the wrapper is the right tool anyway

You won't usually write a custom renderer. `<SvGrid>` is the default
because the 80% case is "I want a table, with sort and filter, that
looks correct". The wrapper:

- handles WAI-ARIA grid semantics, keyboard navigation, focus
  management, copy/paste, range selection;
- wires virtualisation, column resize, fit-to-width, pinning, the
  filter menu, the column menu, the row-number column;
- exposes a `SvGridApi` for data + columns + sort + filter +
  visibility mutations;
- emits callbacks (`onSortingChange`, `onFiltersChange`,
  `onRowSelectionChange`, `onCellValueChange`) for parents that want to
  observe.

Reach for the headless core when:

- you need a renderer the default cannot produce (canvas, mobile-only,
  Excel-export-only),
- you're embedding the grid in an environment without a real DOM (SSR,
  static-site generators, PDF pipelines),
- you want to drive multiple coordinated grids from one state store,
- you're building a higher-level abstraction on top of SvGrid and want
  the headless API as your foundation.

## The trade-off, named

Headless costs you a default theme. You can't `npm install` a
"complete-looking grid" and have it match your app out of the box;
every grid library that promises that has to ship CSS and DOM
assumptions you'll eventually fight.

SvGrid splits the difference: the headless core is its own thing, and
`<SvGrid>` is a *reference renderer* you can copy and modify. The
shipped CSS uses `--sg-*` custom properties so you can re-theme it
without forking. See [Tailwind integration](./help/tailwind.md) for a
worked example.

## See also

- [Getting started](./getting-started.md) - the wrapper-first walkthrough
- [Column definitions](./help/columns/column-definitions.md) - the contract the headless core enforces
- [Filter API](./help/filtering/filter-api.md) - example of headless state surfaced through the wrapper
- [`createSvGrid` source](../packages/sv-grid-community/src/createGrid.svelte.ts)
- Demo [`19-ssr`](../examples/src/demos/19-ssr.svelte) - SSR with the headless core
