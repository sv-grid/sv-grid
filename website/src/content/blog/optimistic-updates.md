---
title: Optimistic Updates - A Grid That Feels Instant
description: Make edits in your Svelte data grid feel immediate by updating the UI first and reconciling with the server, with clean rollback on failure.
date: 2025-12-23
category: Editing
tags: optimistic updates, editing, ux, svelte data grid
author: Kamelia M
---

The fastest interaction is the one that does not wait for the network. Optimistic updates apply a change to the grid immediately, fire the request in the background, and roll back only if the server rejects it. Done well, edits feel instant even on a slow connection.

![Optimistic edits in SvGrid](/blog-media/optimistic-updates.png)
*Optimistic updates: edits apply instantly, then reconcile.*

## The pattern

```ts
async function save(e) {
  // e: { rowIndex, columnId, oldValue, newValue, row }
  rows[e.rowIndex] = { ...e.row, [e.columnId]: e.newValue } // 1. apply now
  try {
    await api.patch(e.row.id, { [e.columnId]: e.newValue })  // 2. confirm
  } catch {
    rows[e.rowIndex] = { ...e.row, [e.columnId]: e.oldValue } // 3. roll back
  }
}
```

The user sees the change the instant they commit. The network round trip happens out of sight, and only a failure is visible - as a revert.

## Make failures honest

A silent rollback is confusing. When the server rejects an edit, tell the user: flash the row, show a toast, or mark the cell with an error style so they know the change did not stick and why.

## Pending state

For slow operations, a subtle "saving" indicator on the row reassures users that their change is in flight. Track a per-row pending set in your own state and clear it when the request resolves. The grid stays responsive while the indicator does the explaining.

## Optimistic inserts and deletes

The same idea covers adding and removing rows: add the new row to `data` immediately with a temporary id, then swap in the server id when it returns; remove a row on click, and restore it if the delete fails. Because SvGrid does not mutate your data, you stay in full control of these transitions.

## Reconcile, do not clobber

If a background refresh arrives while an edit is in flight, do not blindly overwrite the user's pending change with server data. Merge: keep optimistic fields that have not been confirmed, and accept server values for everything else. This avoids the jarring "my edit disappeared" bug.

## Frequently asked questions

### What is an optimistic update in a data grid?

It applies the user's edit to the grid immediately, sends the request in the background, and only rolls back if the server rejects it - so the interaction feels instant.

### How do I handle a failed optimistic update?

Restore the old value from the change event, and surface the failure visibly - a flash, toast, or error style - so the user knows the edit did not persist.
