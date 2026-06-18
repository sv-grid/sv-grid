---
title: Migrating from Tabulator to SvGrid
description: Move a Tabulator table to SvGrid in Svelte 5 - mapping column definitions, formatters, editors, and ajax to a native runes-based grid.
date: 2026-08-17
category: Comparisons
tags: migration, tabulator, comparison, svelte data grid
author: Kamelia M
---

Tabulator packs a lot into a framework-agnostic table, and it shows. The catch in a Svelte app is that you drive it imperatively - `new Tabulator(...)`, then method calls - where SvGrid lets you stay declarative and runes-native. Most of the migration is just translating column options from one shape to the other.

![A showcase of SvGrid cell types.](/blog-media/cell-types.png)
*A showcase of SvGrid cell types.*

## Concept mapping

| Tabulator | SvGrid |
| --- | --- |
| `new Tabulator(el, {...})` | `<SvGrid ... />` |
| `data` / `ajaxURL` | `data` (in-memory or fetched) |
| `columns: [{ field, title }]` | `columns: [{ field, header }]` |
| `formatter` | `format` / `formatter` / `cell` |
| `editor` (`input`, `number`, ...) | `editorType` |
| `headerFilter` | `columnFilteringFeature` |
| `pagination: 'local' / 'remote'` | `rowPaginationFeature` / external mode |
| `groupBy` | `columnGroupingFeature` |
| `selectable` | `rowSelectionFeature` |
| `virtualDom` | virtualization (automatic) |

## Columns

```js
// Tabulator
columns: [
  { title: 'Name', field: 'name' },
  { title: 'Salary', field: 'salary', formatter: 'money', editor: 'number' },
]
```

```ts
// SvGrid
const columns: ColumnDef<{}, Row>[] = [
  { field: 'name', header: 'Name' },
  { field: 'salary', header: 'Salary', format: { type: 'currency', currency: 'USD' }, editorType: 'number' },
]
```

## Imperative to declarative

Tabulator builds and mutates a table instance via method calls (`table.setData`, `table.setFilter`). In SvGrid you change reactive state and the grid follows:

```svelte
<script lang="ts">
  let rows = $state<Row[]>([])
  // push/replace rows; the grid updates automatically
</script>
<SvGrid data={rows} columns={columns} features={features} />
```

## Remote data

Tabulator's `ajaxURL` with remote pagination maps to SvGrid's external mode: fetch the page in the grid's callbacks and pass it back with a total `rowCount`. See [Server-Side Data](server-side-data).

## What you gain

- Declarative, reactive integration, no imperative table instance to manage.
- Svelte 5 runes throughout, plus a headless core if you want custom markup.
- Built-in virtualization and accessibility defaults.

## Frequently asked questions

### How different is SvGrid from Tabulator?

The feature sets overlap heavily (formatters, editors, header filters, grouping, pagination, virtualization). The main difference is the model: Tabulator is an imperative, framework-agnostic instance; SvGrid is a declarative Svelte 5 component with a headless core.
