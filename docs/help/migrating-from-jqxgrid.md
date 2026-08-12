# Migrating from jqxGrid (jQWidgets)

jqxGrid and SvGrid come from the **same team**. jqxGrid is the mature,
multi-framework grid (jQuery core with Angular, React, and Vue
integrations); SvGrid is the Svelte-5-native member of the family. If
your team is consolidating on Svelte 5, this guide maps a jqxGrid setup
onto SvGrid - and the concepts will feel familiar because the
engineering lineage is shared.

> Estimated effort: **2-4 hours** per grid. Most of the work is moving
> from the imperative jQuery source / API to reactive `$state`.

## Vocabulary cheat sheet

| jqxGrid                                  | sv-grid                                   |
| ---------------------------------------- | ----------------------------------------- |
| `$('#grid').jqxGrid({ ... })`            | `<SvGrid ... />`                           |
| `source` / `jqxDataAdapter`              | `data` array (or `externalSort/Filter`)    |
| `{ text: 'Name', datafield: 'name' }`    | `{ header: 'Name', field: 'name' }`        |
| `cellsrenderer`                          | `cell: (c) => renderSnippet(...)`          |
| `columntype` / cell editor              | `editorType`                               |
| `cellsformat: 'c2'`                      | `format: { type: 'currency', currency: 'USD' }` |
| `sortable` / `filterable`                | `rowSortingFeature` / `columnFilteringFeature` |
| `groupable` + `groups`                   | `columnGroupingFeature` + `api.setGroupBy()` |
| `pageable`                               | `showPagination`                           |
| `jqxGrid('updatebounddata')`             | reassign the `$state` data array           |
| `editable` + `cellendedit` event         | `enableInlineEditing` + `onCellValueChange` |

## Before / after

```diff
- const source = { localdata: rows, datatype: 'array' }
- const adapter = new $.jqx.dataAdapter(source)
- $('#grid').jqxGrid({
-   source: adapter, sortable: true, filterable: true, pageable: true, editable: true,
-   columns: [
-     { text: 'Name',   datafield: 'name' },
-     { text: 'Amount', datafield: 'amount', cellsformat: 'c2' },
-   ],
- })

+ <script lang="ts">
+   import {
+     SvGrid, tableFeatures, rowSortingFeature, columnFilteringFeature,
+     type ColumnDef,
+   } from '@svgrid/grid'
+   const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
+   const columns: ColumnDef<typeof features, Row>[] = [
+     { field: 'name',   header: 'Name' },
+     { field: 'amount', header: 'Amount', format: { type: 'currency', currency: 'USD' } },
+   ]
+ </script>
+
+ <SvGrid data={rows} columns={columns} features={features} showPagination enableInlineEditing />
```

## What changes

- **jQuery source / dataAdapter → reactive `$state`.** No
  `updatebounddata()`; reassign the array.
- **`cellsrenderer` → snippet cells** via `renderSnippet`.
- **jQWidgets theme → `--sg-*` tokens** (or your Tailwind theme).

## A note on family

Moving to SvGrid keeps you with the same team's Svelte-5 grid rather
than switching vendors. The Enterprise tier and support come from the same people behind jqxGrid.
If your app is still on jQuery / Angular / React / Vue, jqxGrid remains
the right tool; reach for SvGrid when the codebase is Svelte 5.

## See also

- [SvGrid vs jqxGrid](https://svgrid.com/compare/jqxgrid) - the side-by-side comparison
- [About SvGrid](https://svgrid.com/about) - built by jQWidgets
- [Getting started](../getting-started.md) - a working grid in ~15 lines

## Frequently asked questions

### Is SvGrid made by the same team as jqxGrid?

Yes. SvGrid is built by jQWidgets - the same team behind jqxGrid - specifically
for Svelte 5, rebuilt around runes and snippets with an MIT community core.

### How do jqxGrid columns map to SvGrid?

`text` becomes `header`, `datafield` becomes `field`, `cellsrenderer` becomes a
`renderSnippet` cell, and `cellsformat` maps onto the `format` config. Sorting /
filtering / grouping move to registered features.

### Should I migrate my jQuery jqxGrid app to SvGrid?

Only if you are moving that app to Svelte 5. If it stays on jQuery / Angular /
React / Vue, jqxGrid is the better fit. SvGrid is the native choice once the
stack is Svelte.
