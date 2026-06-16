---
title: Migrating from Handsontable to SvGrid
description: Move a Handsontable spreadsheet to SvGrid in Svelte 5 - mapping data, columns, editors, and afterChange, and what differs about licensing.
date: 2026-08-13
category: Comparisons
tags: migration, handsontable, comparison, svelte data grid
author: Boyko Markov
---

Handsontable is a capable spreadsheet component. Teams move to SvGrid for a native Svelte 5 integration, an MIT-licensed core, and a grid that scales to large datasets with built-in virtualization. Here is how to migrate the common pieces.

## Concept mapping

| Handsontable | SvGrid |
| --- | --- |
| `data` (array of arrays / objects) | `data` (array of objects) |
| `colHeaders` | column `header` |
| `columns: [{ data, type }]` | `columns: [{ field, editorType }]` |
| `type: 'numeric' / 'date' / 'checkbox'` | `editorType: 'number' / 'date' / 'checkbox'` |
| `renderer` | `cell` via `renderSnippet` |
| `afterChange` | `onCellValueChange` |
| `columnSorting` | `rowSortingFeature` |
| `filters` + dropdown menu | `columnFilteringFeature` (`filterMode="menu"`) |
| Cell range selection | `enableCellSelection` |
| Non-commercial / commercial license | MIT core; Enterprise for export/import/pivot |

## Data shape

Prefer arrays of objects in SvGrid (each column reads a `field`). If your Handsontable data is arrays-of-arrays, map it to objects first:

```ts
const rows = matrix.map(([name, salary, active]) => ({ name, salary, active }))
```

## Editors and changes

```ts
// Handsontable
{ data: 'salary', type: 'numeric' }
afterChange(changes) { /* [row, prop, oldVal, newVal] */ }

// SvGrid
{ field: 'salary', header: 'Salary', editorType: 'number' }
function onCellValueChange(e) { rows[e.rowIndex] = { ...e.row, [e.columnId]: e.newValue } }
```

Handsontable mutates its data source; SvGrid emits an event and leaves the write to you, which fits Svelte's `$state` model.

## Spreadsheet feel

If you relied on range selection and copy/paste, enable cell selection (`selectionMode="cell"` / `enableCellSelection`); copying a range yields tab-separated values that paste into Excel. See [cell range selection](cell-range-selection). Excel/CSV export and import live in [@svgrid/enterprise](/pricing).

## Licensing note

Handsontable is free for non-commercial use and requires a license for commercial use. SvGrid's core is MIT-licensed for commercial use with no key; only the optional Enterprise pack is paid. Factor that into the migration's business case.

## Frequently asked questions

### Can SvGrid replace Handsontable's spreadsheet features?

For most use cases, yes - inline editing with typed editors, cell range selection, copy/paste as TSV, sorting, filtering, and (via Enterprise) Excel/CSV import and export. Very spreadsheet-specific features like formula engines differ, so check your exact needs.

### How does licensing compare?

Handsontable requires a commercial license for commercial use; SvGrid's core is MIT-licensed and free for commercial use, with a separate optional paid Enterprise pack for export, import, pivot, and AI.
