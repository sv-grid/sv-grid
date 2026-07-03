---
title: An Actions Column (Edit, Delete) in SvGrid
description: Build a per-row actions column with edit, delete, and duplicate buttons in SvGrid - handling data mutations, accessibility, and confirmation flows correctly.
date: 2026-06-30
updated: "2026-07-02"
category: Cells
tags: actions, buttons, cells, custom cells, recipe
author: Boyko Markov
---

Every admin interface ends up with the same column on the far right: a row of small buttons that let the user edit, delete, or do something quick with that record. It looks trivial to add, and the basic case is. What trips people up is everything around it - confirmation dialogs, optimistic updates, keyboard accessibility, and the fact that a destructive button in every row is genuinely dangerous if the UX is careless.

Here is how to do it properly in SvGrid.

## The column has no field

An actions column is pure UI - no underlying data field, no sorting, no filtering. In SvGrid, that means defining a column with only an `id` and a `cell` renderer, and skipping `field` entirely.

The `cell` property accepts a Svelte 5 snippet. Snippets have access to the cell context, which includes the original row object. That is all you need.

```svelte
<script lang="ts">
  import SvGrid, { renderSnippet, type ColumnDef } from '@svgrid/grid'

  type Employee = { id: number; name: string; role: string; salary: number }

  let data = $state<Employee[]>([
    { id: 1, name: 'Ana Folau', role: 'Engineer', salary: 95000 },
    { id: 2, name: 'Chris Ndegwa', role: 'Designer', salary: 88000 },
    { id: 3, name: 'Sara Petrov', role: 'PM', salary: 102000 },
  ])

  function editRow(row: Employee) {
    // open your modal, panel, or inline form
    console.log('editing', row)
  }

  function deleteRow(row: Employee) {
    data = data.filter((r) => r.id !== row.id)
  }

  function duplicateRow(row: Employee) {
    const copy = { ...row, id: Date.now() }
    data = [...data, copy]
  }
</script>

{#snippet actionsCell({ row }: { row: { original: Employee } })}
  <span class="row-actions">
    <button type="button" aria-label={`Edit ${row.original.name}`} onclick={() => editRow(row.original)}>
      Edit
    </button>
    <button type="button" aria-label={`Duplicate ${row.original.name}`} onclick={() => duplicateRow(row.original)}>
      Copy
    </button>
    <button type="button" class="danger" aria-label={`Delete ${row.original.name}`} onclick={() => deleteRow(row.original)}>
      Delete
    </button>
  </span>
{/snippet}

<script lang="ts">
  const columns: ColumnDef<any, Employee>[] = [
    { id: 'name',    field: 'name',   header: 'Name',   width: 200 },
    { id: 'role',    field: 'role',   header: 'Role',   width: 140 },
    { id: 'salary',  field: 'salary', header: 'Salary', width: 120, type: 'number' },
    {
      id: 'actions',
      header: '',
      width: 160,
      pinned: 'right',
      cell: (c) => renderSnippet(actionsCell, { row: c.row }),
    },
  ]
</script>

<SvGrid {data} {columns} />
```

Two things to note: `field` is absent from the actions column, and `pinned: 'right'` keeps it visible when the user scrolls horizontally on a wide grid.

## Wiring mutations through the imperative API

If you are managing data locally with `$state`, direct array mutation is fine. But many apps talk to a backend, and you want the grid to stay in sync even when a request fails. The `onApiReady` callback gives you an API object with `addRow`, `removeRow`, and `applyTransaction`.

```svelte
<script lang="ts">
  import SvGrid, { renderSnippet, type SvGridApi, type ColumnDef } from '@svgrid/grid'

  type Product = { id: string; name: string; price: number; stock: number }

  let api = $state<SvGridApi | null>(null)
  let data = $state<Product[]>([])

  async function handleDelete(row: Product) {
    if (!confirm(`Remove "${row.name}" from the catalog?`)) return

    // Optimistic: remove from grid immediately
    api?.applyTransaction({ remove: [row] })

    try {
      await fetch(`/api/products/${row.id}`, { method: 'DELETE' })
    } catch (err) {
      // Rollback: put it back if the server call fails
      api?.applyTransaction({ add: [row] })
      console.error('Delete failed, rolled back', err)
    }
  }

  async function handleEdit(row: Product) {
    // After your modal resolves with updated data:
    const updated = await openEditModal(row)
    if (!updated) return

    await fetch(`/api/products/${row.id}`, {
      method: 'PUT',
      body: JSON.stringify(updated),
    })

    api?.applyTransaction({ update: [updated] })
  }
</script>

{#snippet actionCell({ row }: { row: { original: Product } })}
  <span class="row-actions">
    <button type="button" onclick={() => handleEdit(row.original)}>Edit</button>
    <button type="button" class="danger" onclick={() => handleDelete(row.original)}>Delete</button>
  </span>
{/snippet}

<SvGrid
  {data}
  columns={[
    { id: 'name',    field: 'name',  header: 'Name',  width: 220 },
    { id: 'price',   field: 'price', header: 'Price', width: 100, type: 'number' },
    { id: 'stock',   field: 'stock', header: 'Stock', width: 100, type: 'number' },
    { id: 'actions', header: '',     width: 140, pinned: 'right',
      cell: (c) => renderSnippet(actionCell, { row: c.row }) },
  ]}
  onApiReady={(a) => { api = a }}
/>
```

The optimistic pattern - remove from the grid first, then hit the server, then restore on failure - makes the UI feel instant while keeping the data consistent.

## Accessible buttons, not clickable spans

The most common failure mode I see in action columns: a `<div>` or `<span>` with an `onclick` handler instead of a `<button>`. That looks fine visually but breaks keyboard navigation and screen readers. A user who navigates with Tab or a keyboard shortcut cannot reach those elements at all.

SvGrid's cell renderer lets you put actual `<button>` elements in cells. They get proper focus handling automatically because they are native interactive elements. Use them.

For icon-only buttons (where the label is just a trash can icon), an `aria-label` is required - not optional, required. The label should describe the action AND the target: `aria-label="Delete Ana Folau"` is far more useful than `aria-label="Delete"` when a screen reader announces a focused button. The snippet above threads the row name through to do this.

```css
/* styles for the actions column - keep it compact */
.row-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
}

.row-actions button {
  padding: 3px 10px;
  border: 1px solid var(--sg-border);
  border-radius: var(--sg-radius);
  background: var(--sg-bg);
  color: var(--sg-fg);
  cursor: pointer;
  font-size: 0.8rem;
  line-height: 1.4;
}

.row-actions button.danger {
  border-color: #e55;
  color: #e55;
}

.row-actions button:hover {
  background: var(--sg-accent);
  color: #fff;
  border-color: var(--sg-accent);
}

.row-actions button.danger:hover {
  background: #e55;
  border-color: #e55;
  color: #fff;
}
```

SvGrid exposes `--sg-bg`, `--sg-fg`, `--sg-accent`, `--sg-border`, and `--sg-radius` as CSS tokens, so styling buttons to match the current theme requires no extra configuration.

## When per-row actions are not enough

Sometimes one user needs to delete thirty rows at once. Per-row buttons are the wrong tool for that - you want row selection plus a toolbar bulk action.

The two approaches work well together. Keep the actions column for quick single-record operations. Add `rowSelectionFeature` plus a toolbar delete button for multi-record workflows. Users learn which pattern to use quickly, because the affordances are visually distinct.

```svelte
<script lang="ts">
  import SvGrid, {
    tableFeatures, rowSelectionFeature, renderSnippet,
    type SvGridApi, type ColumnDef
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSelectionFeature })
  let api = $state<SvGridApi | null>(null)

  async function deleteSelected() {
    const selected = api?.getSelectedRows() ?? []
    if (selected.length === 0) return
    if (!confirm(`Delete ${selected.length} rows?`)) return
    api?.applyTransaction({ remove: selected })
    // then fire your batch API call
  }
</script>

<button onclick={deleteSelected}>Delete selected</button>

<SvGrid
  {data}
  {columns}
  {features}
  rowSelection="multiple"
  onApiReady={(a) => { api = a }}
/>
```

The two patterns - single-row action buttons and bulk selection - cover nearly every admin workflow. Pick the right one for each action rather than trying to make one handle both.

## Confirmation UX

`confirm()` is synchronous and modal, which makes it easy to use but ugly in a polished app. For production, a custom dialog component is better. The pattern is the same: await a boolean result before proceeding with the destructive operation.

What you should never do is skip confirmation entirely for delete. Even with undo support, a delete with no friction trains users to be careless. One confirmation step - one click - is not too much to ask before removing a record.
