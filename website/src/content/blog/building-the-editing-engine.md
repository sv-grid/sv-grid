---
title: 'Inside SvGrid: The Inline Editing Engine'
description: Turning SvGrid from a viewer into a tool: typed editors, a keyboard-first edit flow, and the deliberate choice never to mutate your data.
date: 2026-07-08
category: Engineering
tags: editing, validation, engineering, story
author: Boyko Markov
---

By this point SvGrid could sort and filter a hundred thousand rows smoothly. But a grid you can only read is half a grid. The next piece was editing, the feature that turns a data viewer into a data tool, and the one with the most opinions baked into it.

![Inline cell editing in SvGrid.](/blog-media/inline-editing.png)
*Inline cell editing in SvGrid.*

## The biggest decision: do not touch the data

The first thing we settled was what editing would not do: it would not mutate your data. When a user commits an edit, the grid emits an event with the old and new values, and you decide what happens next.

```ts
function onCellValueChange(e) {
  // e: { rowIndex, columnId, oldValue, newValue, row }
  rows[e.rowIndex] = { ...e.row, [e.columnId]: e.newValue }
}
```

This was deliberate. In a Svelte 5 `$state` world, surprise mutation is the enemy of predictable UI. By making the grid emit an intention rather than perform a write, saving to a server, validating, rolling back, and optimistic updates all became things you compose, not things you fight.

## Typed editors

An editor has to match the data or it produces garbage. We built the editor type into the column definition:

```ts
const columns = [
  { field: 'name',   header: 'Name',   editorType: 'text' },
  { field: 'age',    header: 'Age',    editorType: 'number' },
  { field: 'active', header: 'Active', editorType: 'checkbox' },
]
```

The detail that mattered: a `number` editor commits a number, not the string `"42"`. Same theme as sorting and filtering, keep the value's type intact so the rest of the pipeline keeps working. An edited number column still sorts numerically.

## Keyboard first, because data entry is keyboard work

Anyone entering data in bulk lives on the keyboard, so the edit flow had to be excellent without a mouse. We wired the conventions people already know from spreadsheets: F2 or double-click to edit, Enter to commit and move down, Tab to commit and move right, Escape to cancel. The active cell is part of the grid's roving focus model, so you can navigate, edit, and move on without ever reaching for the pointer.

## Validation as a sequence, not a checkbox

We resisted building one validation hook and calling it done. Validation is really layers: the editor restricts input shape, a synchronous rule in the change handler rejects bad business values, and async validation defers to the server. Because the grid hands you the change event rather than committing for you, all three fit naturally, you choose when a value is good enough to keep.

The usage side of all this is written up in [Inline Editing with Validation in SvGrid](inline-editing-with-validation) and [Optimistic Updates](optimistic-updates). This post is about why editing emits events instead of mutating.

## What it unlocked

With editing in place, SvGrid crossed from "show me the data" to "let me work with the data." That opened the door to the features that assume a living dataset. Read next: [grouping, trees, and master-detail](building-grouping-trees-master-detail).
