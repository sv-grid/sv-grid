# Migrating from a UI-kit table (Flowbite / Skeleton / shadcn-svelte)

Flowbite-Svelte, Skeleton, and shadcn-svelte all ship a styled `<Table>`
component. They are presentation components: they render the rows you
pass and match your design tokens, but sorting, filtering,
virtualization, and editing are yours to write by hand. Moving to SvGrid
replaces that hand-rolled logic with built-in features - while still
letting you match the design system.

> **Not the shadcn-svelte data table.** That one is a separate recipe
> built on TanStack Table v9, and it already does sorting, filtering,
> pagination, and row selection. If that is what you have, read
> [Migrating from the shadcn-svelte data table](./migrating-from-shadcn-data-table.md)
> instead - the port is different, and smaller.

> Estimated effort: **30 min - 1 hour** per table. You are mostly
> deleting `{#each}` markup and the sort / filter state you wrote
> yourself.

## When this guide applies

You have a table that started simple and has grown:

- You added a click-to-sort handler and a sort-state variable.
- You added a search box and an array `.filter(...)`.
- The list got long and now you want virtualization or pagination.
- You started editing cells inline and it got messy.

That is the moment a styled `<Table>` stops paying for itself.

## Before / after

```diff
- <script>
-   import { Table, TableHead, TableHeadCell, TableBody, TableBodyRow, TableBodyCell } from 'flowbite-svelte'
-   let sortKey = 'name', asc = true
-   $: sorted = [...rows].sort((a, b) => (a[sortKey] > b[sortKey] ? 1 : -1) * (asc ? 1 : -1))
- </script>
-
- <Table>
-   <TableHead>
-     <TableHeadCell on:click={() => (sortKey = 'name')}>Name</TableHeadCell>
-     <TableHeadCell on:click={() => (sortKey = 'amount')}>Amount</TableHeadCell>
-   </TableHead>
-   <TableBody>
-     {#each sorted as row}
-       <TableBodyRow>
-         <TableBodyCell>{row.name}</TableBodyCell>
-         <TableBodyCell>{row.amount}</TableBodyCell>
-       </TableBodyRow>
-     {/each}
-   </TableBody>
- </Table>

+ <script lang="ts">
+   import {
+     SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature,
+     type ColumnDef,
+   } from '@svgrid/grid'
+
+   const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
+   const columns: ColumnDef<typeof features, Row>[] = [
+     { field: 'name',   header: 'Name' },
+     { field: 'amount', header: 'Amount', format: { type: 'currency', currency: 'USD' } },
+   ]
+ </script>
+
+ <SvGrid data={rows} columns={columns} features={features} showPagination />
```

The sort handler, the `sorted` derivation, and the `{#each}` all go
away. Sorting is a click on the header; filtering is the column menu.

## Keep your design system

SvGrid is unstyled-by-token, so it can match Flowbite / Skeleton /
shadcn:

- Re-theme through the `--sg-*` CSS custom properties (borders, header
  background, zebra rows, hover, selection, density).
- Or drive those tokens from your Tailwind theme - see the
  [Tailwind integration](./tailwind.md) guide.

## What you get for free

- **Sorting, filtering, and pagination** without writing handlers.
- **Row + column virtualization** so thousands of rows stay smooth.
- **Inline editing**, **cell-range selection + copy**, grouping, tree,
  and master/detail when you need them.
- **Accessibility** - WAI-ARIA grid roles and keyboard navigation built
  in, instead of a plain `<table>`.

## What you give up

- The **tiny footprint** of a styled `<table>` for a truly static list.
- A **pixel-perfect**, zero-config match with the rest of the kit - you
  re-create the look with tokens instead (a one-time setup).

## See also

- [SvGrid vs UI-kit tables](https://svgrid.com/compare/svelte-ui-kit-tables/) - the side-by-side comparison
- [Tailwind integration](./tailwind.md) - match your design system
- [Getting started](../getting-started.md) - a working grid in ~15 lines

## Frequently asked questions

### When should I replace a Flowbite / Skeleton / shadcn table with a data grid?

When the table needs sorting, filtering, virtualization, inline editing, or
large datasets. These styled `<Table>` components are presentation only;
once you are hand-writing table behaviour, a data grid like SvGrid removes
that code. (shadcn-svelte also ships a separate TanStack-based data table -
see [that migration guide](./migrating-from-shadcn-data-table.md).)

### Can SvGrid match my existing UI-kit styling?

Yes. SvGrid themes through `--sg-*` CSS variables, which you can wire to your
Tailwind / design-system tokens so it matches Flowbite, Skeleton, or
shadcn-svelte.

### Is it overkill for a small static table?

For a small, static table that never sorts or filters, a styled `<table>` is
lighter and fine. Switch when the behaviour - not just the styling - becomes the
work.
