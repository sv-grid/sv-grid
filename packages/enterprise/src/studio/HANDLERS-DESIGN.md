# Studio: design-time + your own code ("handlers")

Status: **Contract + tiered code-behind shipped.** The whole screen is scriptable,
not just the grid. Read this before adding code to the generator or the designer.

## What ships today (the tiered `ctx`)

Every block on a code-enabled screen becomes a named, typed member of the page
`ctx`, tiered by how much API it has. `screenHandles()` in `emit-project.ts` is the
single source of truth the page wiring, the `PageContext` type, and the
`handlers.ts` manifest all agree on.

- **Tier 1 - the Grid (`ctx.grid`)**: the real, full `SvGridApi`, typed to the
  entity's row (`SvGridApi<any, Customers>`). exportCsv(), setFilter(), addRow(), ...
- **Tier 2 - data-viz blocks (`ctx.chart1`, `ctx.kpi1`, `ctx.gauge1`, ...)**: a
  reactive `DataHandle`. By default it mirrors the screen dataset; `setData(rows)`
  feeds the block its own rows, `.rows` reads them, `clear()` follows the dataset
  again. Kinds: chart, kpi, gauge, pivot, tree, dashboard (top-level blocks).
- **Tier 3 - UI components (`ctx.button1`, ...)**: a typed `Handle` (e.g.
  `ButtonHandle = Handle & { setVariant('primary' | ...): void; onclick: ... }`),
  now wired on entity screens too (not just freestanding).
- **Batteries**: `ctx.data` (the screen dataset: `setRows` on a freestanding
  data-grid, `reload()` on an entity grid), `ctx.goto(path)`, `ctx.params`.

Lifecycle slots: **`onLoad(ctx)`** on mount and **`onDestroy(ctx)`** on unmount
(both structured, per-slot bodies in the model's `handlerBodies`). The advanced
`handlersSource` escape hatch still overrides the whole file verbatim.

The rest of this doc is the original Phase-0/1 contract, kept for the round-trip
rules (still authoritative) - the generated-shape examples below predate the tiers.

## Goal

Make Studio the #1 way a Svelte dev builds a SvelteKit app with our components -
the Grid especially. You design a screen visually (empty page + the UI toolbox),
then write real code behind it. The output is clean, idiomatic, **ejectable**
SvelteKit that the user owns. Not WinForms/WebForms code-behind: Svelte already
unifies markup + `<script>`, so we don't split a partial class - we give user
logic a safe, un-clobberable home and wire the design to it.

## The round-trip contract (the make-or-break)

Two kinds of file exist in a generated app:

| File | Owner | On re-generate |
| --- | --- | --- |
| `+page.svelte`, `+server.ts`, `src/lib/*` (generated) | **Studio** | Overwritten from the model |
| `src/routes/<route>/handlers.ts` (companion) | **You** | **Never overwritten** - scaffolded once, then yours forever |

**Companion-file-only** is the model (chosen over managed-markers) because it works
identically in the browser "Generate" path and the CLI - the browser can't merge
against files it can't see, so we never put user code in a file the generator
rewrites. The generated page *imports* the companion; it never edits it.

Enforcement: a companion `GeneratedFile` carries `userOwned: true`, and every
in-place writer runs it through the shared `skipUserOwned(file, exists)` predicate
(`scaffold.ts`) and **skips it if it already exists** - wired into both the CLI
regenerate (`cli.ts writeAll`) and the designer's bundle write
(`designer-server.ts writeBundle`). The browser zip includes the stub only as a
starting point; extracting over an existing project is the user's choice.

## Schema (model)

On `Screen`:

```ts
code?: boolean                 // this screen has a handlers.ts companion
events?: EventBinding[]        // wiring from a lifecycle/DOM event to a handler name

type ScreenEvent = 'load'      // Phase 1: screen lifecycle. Per-block DOM events land next.
type EventBinding = { on: ScreenEvent; handler: string }
```

Phase 2+ extends `EventBinding['on']` and moves bindings onto blocks
(`grid.onRowClick`, `form.onSubmit`, component `onclick`), all resolving to a
function name exported from the same screen companion.

## Generated shape (Phase 1)

For a screen with `code: true` and `events: [{ on: 'load', handler: 'load' }]`:

`src/routes/<route>/handlers.ts` (userOwned, create-once):

```ts
// Your code. SvGrid Studio scaffolds this file once and never overwrites it.
import type { RowData } from '@svgrid/grid'

/** Runs when the page mounts. Return the rows to render, fetch data, set state. */
export async function load(): Promise<RowData[]> {
  // TODO: fetch or compute your rows.
  return []
}
```

`src/routes/<route>/+page.svelte` (Studio-owned) imports and wires it:

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import * as handlers from './handlers'
  let rows = $state<unknown[]>([])
  onMount(async () => { rows = await handlers.load() })
</script>
```

The Grid (hero) becomes usable on an empty page by binding its rows to `handlers.load()`
output - no entity/CRUD scaffolding required. That is the flagship of this feature.

## Why this is safe

- User code is only ever in `handlers.ts`, which the generator treats as write-once.
- The generated page depends on the companion by import; a missing/renamed handler
  is a compile error the user sees immediately (no silent breakage).
- Everything compiles to plain SvelteKit; `npm run dev` works with zero Studio runtime.

## Non-goals (Phase 1)

- **No design-time execution** of user code. The designer preview stays declarative
  with seed data; `handlers.ts` runs only in the generated app. (Revisit later via
  the sandboxed playground runner.)
- **No in-browser type-checking / IntelliSense** beyond the editor + generated types.

## Increment plan

1. **Foundation** [done]: schema + companion emission (`userOwned`), page wiring,
   emit tests. Freestanding screens first.
2. **Grid-on-empty-page** [done] + toolbox component handles.
3. **Designer Design | Code toggle** [done]: edit `handlers.ts` in-panel.
4. **Tiered ctx across all screens** [done]: `screenHandles()` unifies grid /
   data-viz (`DataHandle.setData`) / typed component handles on both entity and
   freestanding screens; `ctx.data` / `ctx.goto` / `ctx.params` batteries;
   `onDestroy` lifecycle slot; typed component handle aliases.
5. **Write-once enforced** [done]: `skipUserOwned` in both in-place writers.

### Next
- Designer Code view: surface the `onDestroy` slot tab + refresh the "ctx gives
  you" reference / completions for data handles + batteries.
- Per-block **event slots** beyond lifecycle: component `onclick`, grid
  `onRowClick(ctx, row)`, chart `onSelect/onDrill` resolving to named handlers.
- Data handles for tabs-nested viz blocks (today only top-level blocks get one).
- Surface non-grid kit component controllers via an `onReady` callback (upgrade
  Tier 3 components to Tier 1 rich APIs where a headless core exists).
