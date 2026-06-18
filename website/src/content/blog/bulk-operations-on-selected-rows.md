---
title: Bulk Operations on Selected Rows in SvGrid
description: Turn row selection into action - bulk edit, delete, archive, and export selected rows in a Svelte data grid with a contextual toolbar.
date: 2025-12-02
category: Selection
tags: bulk operations, selection, toolbar, svelte data grid
author: Boyko Markov
---

Selecting rows is step one; the payoff is what happens next. Bulk operations collapse a set of selected rows into one action, archive these, delete those, bump a field across all of them at once. SvGrid hands you the selection; a contextual toolbar turns it into a workflow.

![Row selection driving bulk actions in SvGrid](/blog-media/selection-api.png)
*Selection powering bulk actions in SvGrid.*

## Capture the selection

```svelte
<script lang="ts">
  let selected = $state<Row[]>([])
</script>

<SvGrid
  data={rows}
  columns={columns}
  selectionMode="row"
  showRowSelection={true}
  onRowSelectionChange={(state, selectedRows) => (selected = selectedRows)}
/>
```

## A contextual bulk bar

Show a toolbar only when something is selected, so it stays out of the way otherwise:

```svelte
{#if selected.length}
  <div class="bulk-bar">
    <span>{selected.length} selected</span>
    <button onclick={() => archive(selected)}>Archive</button>
    <button onclick={() => remove(selected)}>Delete</button>
    <button onclick={() => exportRows(selected)}>Export</button>
  </div>
{/if}
```

## Bulk edit a field

A common power-user need is setting one field across many rows, mark fifty tickets "resolved" at once. Apply the change to each selected row and persist in one request where your API allows it:

```ts
async function setStatus(rows, status) {
  for (const r of rows) updateLocal(r.id, { status })
  await api.bulkPatch(rows.map((r) => r.id), { status })
}
```

## Confirm destructive actions

Bulk delete is powerful and easy to misfire. Confirm with a count - "Delete 23 rows?" - and consider a soft delete with undo rather than an irreversible wipe. The selection count gives users the information they need to confirm safely.

## Optimistic and reversible

Bulk actions feel best when they apply immediately and offer undo. Update the grid first, fire the batch request, and keep the previous state around long enough to restore it if the user clicks undo or the request fails. Because SvGrid does not mutate your data, snapshotting and restoring is straightforward.
