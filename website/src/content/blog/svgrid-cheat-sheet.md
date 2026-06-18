---
title: SvGrid Cheat Sheet - The One-Page Quick Reference
description: A dense, copy-paste quick reference for SvGrid - install, columns, features, formatting, editing, selection, and server-side data in one page.
date: 2026-06-22
category: Reference
tags: reference, cheat sheet, quick start, svelte data grid
author: Victor Vidolov
---

Everything you reach for most, in one place. Bookmark this; it is also a good page to hand an AI assistant.

## Install

```bash
npm add @svgrid/grid
```

## Minimal grid

```svelte
<script lang="ts">
  import { SvGrid, type ColumnDef } from '@svgrid/grid'
  const columns: ColumnDef<{}, Row>[] = [
    { field: 'name', header: 'Name' },
    { field: 'age', header: 'Age' },
  ]
</script>
<SvGrid data={rows} columns={columns} />
```

## Columns

```ts
{ field: 'name', header: 'Name' }                                  // accessor by key
{ id: 'full', header: 'Name', accessorFn: (r) => `${r.a} ${r.b}` } // computed (needs id)
{ field: 'pay', header: 'Pay', format: { type: 'currency', currency: 'USD' } }
{ field: 'at',  header: 'When', format: { type: 'date', pattern: 'y-m-d' } }
{ field: 'pay', header: 'Pay', align: 'right', width: 140 }
{ field: 'ok',  header: 'Active', editorType: 'checkbox' }
{ field: 'region', header: 'Region', pinned: 'left' }
{ field: 'sales', header: 'Sales', aggregate: 'sum' }
```

Format types: `number`, `currency`, `percent`, `date`, `datetime`. Editor types: `text`, `number`, `checkbox`, `date`, `datetime`.

## Features (register only what you use)

```ts
import {
  tableFeatures, rowSortingFeature, columnFilteringFeature,
  rowPaginationFeature, rowSelectionFeature, columnGroupingFeature, rowExpandingFeature,
} from '@svgrid/grid'

const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
```

## Common props

```svelte
<SvGrid
  data={rows} columns={columns} features={features}
  filterMode="menu"            
  showPagination={true} pageSize={25}
  selectionMode="row" showRowSelection={true}
  enableInlineEditing={true} enableCellSelection={true}
  onSortingChange={(s) => {}}
  onFiltersChange={(f) => {}}        
  onPaginationChange={(p) => {}}     
  onRowSelectionChange={(state, rows) => {}}
  onCellValueChange={(e) => {}}      
/>
```

## Editing (never mutates your data)

```ts
function onCellValueChange(e) {
  // e: { rowIndex, columnId, oldValue, newValue, row }
  rows[e.rowIndex] = { ...e.row, [e.columnId]: e.newValue }
}
```

## Custom cell

```svelte
{#snippet Badge(p: { value: string })}<span class="badge">{p.value}</span>{/snippet}
// column: { field: 'status', header: 'Status', cell: (c) => renderSnippet(Badge, { value: c.getValue() }) }
```

## Server-side data

```svelte
<SvGrid data={pageRows} columns={columns} features={features}
  showPagination rowCount={total}
  onSortingChange={(s) => load({ sort: s })}
  onFiltersChange={(f) => load({ filters: f.columns })}
  onPaginationChange={(p) => load({ page: p.pageIndex })} />
```

## Sizing (so virtualization works)

```svelte
<div style="flex:1; min-height:0;"><SvGrid ... /></div>
```

## Theming

```css
.grid { --sg-bg:#fff; --sg-fg:#111; --sg-border:#e4e7eb; --sg-header-bg:#f5f7fa; }
```

## Keyboard

Arrows move; Home/End and Ctrl+Home/End jump; F2/Enter edit; Esc cancels; Tab commits and moves right.

## Frequently asked questions

### What is the fastest way to add a data grid to Svelte?

Install `@svgrid/grid`, import `SvGrid`, and pass `data` and `columns`, a working, accessible grid is about fifteen lines. Add features (sorting, filtering, pagination) by registering them with `tableFeatures`.

### Does SvGrid mutate my data on edit?

No. It emits `onCellValueChange` with the old and new values; you choose how to persist the change, which keeps edits explicit and predictable in a Svelte `$state` app.
