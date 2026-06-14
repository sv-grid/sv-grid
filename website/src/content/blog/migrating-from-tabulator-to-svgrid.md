---
title: Migrating from Tabulator to SvGrid
description: Move a Tabulator table to SvGrid in Svelte 5 - mapping column definitions, formatters, editors, and ajax to a native runes-based grid.
date: 2026-07-28
category: Comparisons
tags: migration, tabulator, comparison, svelte data grid
author: SvGrid Team
---

Tabulator is a feature-rich, framework-agnostic table. In a Svelte app you instantiate it imperatively; SvGrid gives you a declarative, runes-native component instead. The migration is mostly a translation of column options.

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

- Declarative, reactive integration - no imperative table instance to manage.
- Svelte 5 runes throughout, plus a headless core if you want custom markup.
- Built-in virtualization and accessibility defaults.

## Frequently asked questions

### How different is SvGrid from Tabulator?

The feature sets overlap heavily (formatters, editors, header filters, grouping, pagination, virtualization). The main difference is the model: Tabulator is an imperative, framework-agnostic instance; SvGrid is a declarative Svelte 5 component with a headless core.

### Does SvGrid support remote pagination like Tabulator's ajax mode?

Yes. SvGrid's external mode reports sort, filter, and page state via callbacks; you fetch the page and return it with a total row count - the equivalent of Tabulator's remote pagination.
