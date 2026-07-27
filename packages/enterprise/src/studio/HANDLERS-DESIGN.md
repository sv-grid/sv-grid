# Studio: design-time + your own code ("handlers")

Status: **Phase 0 contract + Phase 1 foundation landing.** This doc is the agreed
boundary for the "empty page + toolbox + handlers" builder. Read it before adding
code to the generator or the designer.

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

Enforcement: a companion `GeneratedFile` carries `userOwned: true`. Any in-place
writer (CLI regenerate) **skips it if it already exists**. The browser zip includes
the stub only as a starting point; extracting over an existing project is the
user's choice (documented).

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

1. **Foundation (this increment):** schema (`code`/`events` + builders), companion
   emission (`userOwned`), page wiring for screen `load`, emit tests. Freestanding
   (empty) screens first.
2. Grid-on-empty-page fed by `handlers.load()` rows; toolbox components gain event
   props that bind to companion handlers.
3. Designer **Design | Code** toggle: edit `handlers.ts` in-panel (reuse the
   playground editor), pick events per block, generated `Row` types as reference.
4. Broaden events (row click, form submit lifecycle) across entity screens too.
5. CLI writer: skip-if-exists for `userOwned` files; docs + a sample app.
