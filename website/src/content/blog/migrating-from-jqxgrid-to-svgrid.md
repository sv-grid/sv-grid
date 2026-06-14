---
title: Migrating from jqxGrid to SvGrid
description: Moving from the jQuery-era jqxGrid to SvGrid, the native Svelte 5 grid from the same team - mapping source, columns, and editing.
date: 2026-07-25
category: Comparisons
tags: migration, jqxgrid, jquery, comparison, svelte data grid
author: SvGrid Team
---

jqxGrid is the jQuery-era data grid from jQWidgets - the same team that builds SvGrid. If your Svelte app still wraps jqxGrid, moving to SvGrid drops jQuery and gives you a native, reactive grid. As the makers of both, here is the honest migration path.

## Why move

jqxGrid is excellent on jQuery, but in a Svelte app it sits behind a jQuery bridge: imperative `$('#grid').jqxGrid({...})` calls, manual refreshes, and a data adapter. SvGrid replaces all of that with declarative Svelte state.

## Concept mapping

| jqxGrid | SvGrid |
| --- | --- |
| `source` + `jqx.dataAdapter` | `data` (plain array) |
| `columns: [{ datafield, text }]` | `columns: [{ field, header }]` |
| `cellsformat` / `cellsrenderer` | `format` / `cell` via `renderSnippet` |
| `columntype` (textbox, numberinput, ...) | `editorType` |
| `editable: true` + `cellendedit` | `enableInlineEditing` + `onCellValueChange` |
| `sortable` / `filterable` | `rowSortingFeature` / `columnFilteringFeature` |
| `pageable` / `pagesize` | `rowPaginationFeature` / `pageSize` |
| `groupable` | `columnGroupingFeature` |
| server `source` (ajax) | external mode |

## Source to data

```js
// jqxGrid
const source = { datafields: [...], url: '/api/people' }
$('#grid').jqxGrid({ source: new $.jqx.dataAdapter(source), columns: [...] })
```

```svelte
<!-- SvGrid -->
<script lang="ts">
  let rows = $state<Row[]>(await fetch('/api/people').then(r => r.json()))
</script>
<SvGrid data={rows} columns={columns} features={features} />
```

No data adapter, no manual `refreshdata()` - update `rows` and the grid re-renders.

## Editing

`cellendedit` callbacks become a single `onCellValueChange`, and SvGrid does not mutate your data, so you stay in control of persistence.

## Same heritage, new model

You keep the engineering values you trusted in jqxGrid - performance, accessibility, breadth - in a grid built for Svelte 5 from scratch. See the story in [Why the World Needed Another Grid](why-the-world-needed-another-grid).

## Frequently asked questions

### Is SvGrid the successor to jqxGrid for Svelte?

SvGrid is the same team's native Svelte 5 data grid. jqxGrid remains the jQuery-era product; for Svelte apps, SvGrid replaces the jQuery bridge with a declarative, runes-based component.

### How do I migrate jqxGrid columns to SvGrid?

Map `datafield` to `field`, `text` to `header`, `cellsformat` to the `format` option, `cellsrenderer` to a `renderSnippet` cell, and `columntype` to `editorType`. Replace the data adapter with a plain reactive `data` array.
