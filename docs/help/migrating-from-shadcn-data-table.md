# Migrating from the shadcn-svelte data table

The shadcn-svelte **Data Table** is not the same thing as its `<Table>`
component. `<Table>` is presentation only. The data table is a recipe
built on TanStack Table v9 that you copy into your own repo: it already
does sorting, filtering, pagination, row selection, and column
visibility. If that is what you have, this is your page. If you have the
plain styled `<Table>` and hand-wrote the sorting yourself, read
[Migrating from a UI-kit table](./migrating-from-ui-kit-tables.md)
instead.

> Estimated effort: **20-40 min** per table. Your column definitions and
> your feature registration carry over almost unchanged. Most of the work
> is deleting files.

## Why this port is small

SvGrid speaks the same vocabulary TanStack Table v9 introduced. These are
real exports from `@svgrid/grid`, not lookalikes:

```ts
import {
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowExpandingFeature,
  columnGroupingFeature,
} from '@svgrid/grid'
```

So `data-table-features.ts` moves over as-is, and `columns.ts` keeps its
shape. What does not move is the rendering scaffolding, because SvGrid
ships a renderer and there is nothing to translate it into.

## What happens to each file

The shadcn recipe generates seven files. Five of them stop existing.

| Their file | Becomes |
| --- | --- |
| `data-table-features.ts` | Kept. Same `tableFeatures({...})` call. |
| `columns.ts` | Kept, minus the `header` render helpers. `{ accessorKey: 'email' }` becomes `{ field: 'email' }`. |
| `data-table.svelte` | Deleted. It is `<table>` markup over `getHeaderGroups()` / `getRowModel()`, which `<SvGrid>` does. |
| `data-table-checkbox.svelte` | Deleted. `showRowSelection` renders the column and the select-all header. |
| `data-table-email-button.svelte` | Deleted. `sortable` makes every header a sort toggle. |
| `data-table-actions.svelte` | Kept if you want it, as a cell snippet. |
| `+page.svelte` | Kept. It now renders one component instead of wiring state. |

## Let the codemod do the mechanical part

```bash
npx @svgrid/migrate src/routes/payments        # preview
npx @svgrid/migrate src/routes/payments --write # apply
```

It previews by default and only writes with `--write`. Point it at the whole
route directory rather than a single file: the shadcn layout keeps `features`
in its own module, and the codemod follows that import to work out which
props the component needs.

It renames the column keys, re-points the imports, strips the features SvGrid
does not have, and deletes the markup along with the `$state` / `onXChange`
pairs. Custom `cell` and `header` render functions are kept and reported, never
guessed at. Run your type-checker afterwards - the markup is regenerated rather
than edited.

## Before and after

```diff
- <script lang="ts">
-   import { createSvelteTable, FlexRender } from '$lib/components/ui/data-table'
-   import { columns } from './columns'
-   import { features } from './data-table-features'
-
-   let sorting = $state([])
-   let filters = $state([])
-   let selection = $state({})
-   let pagination = $state({ pageIndex: 0, pageSize: 10 })
-
-   const table = createSvelteTable({
-     get data() { return data },
-     columns, features,
-     state: { get sorting() { return sorting }, /* ...and three more... */ },
-     onSortingChange: (u) => (sorting = typeof u === 'function' ? u(sorting) : u),
-     // ...one of these per piece of state...
-   })
- </script>
-
- <Table.Root>
-   <Table.Header>
-     {#each table.getHeaderGroups() as headerGroup}
-       <!-- ...twenty more lines of markup... -->
-     {/each}
-   </Table.Header>
-   <Table.Body>
-     {#each table.getRowModel().rows as row}
-       <!-- ...and twenty more... -->
-     {/each}
-   </Table.Body>
- </Table.Root>

+ <script lang="ts">
+   import { SvGrid } from '@svgrid/grid'
+   import '@svgrid/grid/themes/shadcn.css'
+   import { columns } from './columns'
+   import { features } from './data-table-features'
+ </script>
+
+ <SvGrid
+   {data} {columns} {features}
+   sortable filterable showGlobalFilter showRowSelection
+   pageable showPagination pageSize={10}
+   fitColumns
+ />
```

The four `$state` declarations and their four `onXChange` updaters go
away with the markup. Sorting, filtering, paging, and selection state
live in the grid.

Column visibility moves too: mark a column `visible: false` to start it
hidden, and users toggle it from the header column menu. You no longer
maintain a dropdown for it.

## One command

Use the CLI you already have:

```sh
npx shadcn-svelte@latest add https://svgrid.com/r/data-table.json
```

That writes a ready-to-edit `data-table.svelte` into
`$lib/components/ui/data-table/`, beside your other components, and
installs `@svgrid/grid`. It is a normal registry item, so `components.json`
aliases and your existing setup are respected.

If you are not in a shadcn project, the same component ships through
SvGrid's own scaffolder:

```sh
npx @svgrid/ui add data-table
```

Both routes write the identical file. It is yours to edit, exactly like a
shadcn recipe. The difference is where the engine lives.

## The upgrade path is the real difference

Both approaches put a file you own in your repo. Only one puts the
*engine* in a package.

When TanStack Table went from v8 to v9, `useReactTable` became `useTable`,
the `get*RowModel()` options became a features object, and `flexRender`
became a component. Every copied data-table had to be hand-fixed, because
there is no `npm update` for code you pasted. With SvGrid the file you own
stays a thin call site, and the behaviour behind it updates with a version
bump.

The cost scales with how much you pasted. A seven-file starter is an
afternoon. The richer community grids paste a whole subsystem - row
rendering, virtualization, context menus, paste dialogs, hooks, config -
and every one of those files is now yours to carry through the next
upstream change.

## Keep your design system

You do not have to leave shadcn's look, and you do not have to leave its
markup either.

- **Tokens.** `import '@svgrid/grid/themes/shadcn.css'` is a one-line
  match for the default palette in light and dark. To follow a customized
  theme, map your `--background` / `--border` / `--primary` onto the
  `--sg-*` properties - see the [shadcn integration
  guide](./shadcn.md).
- **Your own markup.** If you want to keep shadcn's `Table.Root` /
  `Table.Row` elements exactly as they are, use the headless core from
  `@svgrid/grid/core` and swap only the engine. See
  [Why headless?](../why-headless.md).

## What you gain

The official recipe stops where its docs stop: sorting, filtering,
pagination, row selection, column visibility. Community registry items go
further, at the cost of pasting a whole multi-file subsystem into your
repo. In SvGrid each of these is a prop:

- **Virtualization** (`virtualization`) - the official recipe has none, so
  a large table is a rewrite rather than a prop.
- **Inline editing** (`editable`) and cell-range selection
  (`enableCellSelection`).
- **Grouping with aggregation** (`groupable`) and tree data (`treeData`).
- **Export** to CSV, and to Excel / PDF on the paid tier.
- **WAI-ARIA grid semantics and keyboard navigation**, instead of a plain
  `<table>` you keep accessible yourself.

## What you give up

- **A file you can read top to bottom.** The recipe's behaviour is
  visible in your repo; SvGrid's is behind a prop. That is the trade the
  whole page is about.
- **Pixel-level control of the markup**, unless you go headless.
- **Weight.** For a short static list that never sorts, the copied
  recipe is smaller.

## See also

- [shadcn-svelte integration](./shadcn.md) - matching the theme
- [Migrating from TanStack Table](./migrating-from-tanstack-table.md) - the
  underlying API map
- [Migrating from a UI-kit table](./migrating-from-ui-kit-tables.md) - for
  the plain styled `<Table>`
- [Why headless?](../why-headless.md) - keeping your own markup

## Frequently asked questions

### Does SvGrid replace shadcn-svelte?

No. It replaces one recipe in it. Your buttons, dialogs, and inputs stay
exactly as they are, and the grid reads the same theme variables they do.

### Can I keep my existing columns.ts?

Mostly. Rename `accessorKey` to `field`, drop the `header` render
helpers that only existed to draw a sort button, and the rest carries
over. Custom cells become snippets via `renderSnippet`.

### Do I have to give up owning the code?

You still own the call site - `npx @svgrid/ui add data-table` writes a
file into your project that you edit freely. What you stop owning is the
row-model plumbing, which is the part that broke on the v8 to v9 upgrade.

### Is this worth it for a 50-row table?

Probably not, unless you want editing, grouping, or export later. The
case gets strong when the table grows past what fits on a page, or when
the next feature request is one you would otherwise hand-build.
