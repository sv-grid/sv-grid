---
title: Undo/Redo for Grid Edits in SvGrid
description: Add Ctrl+Z / Ctrl+Y to your Svelte data grid - an edit history built from the change event, with a clean stack and keyboard shortcuts.
date: 2026-09-18
category: Editing
tags: undo, redo, editing, history, recipe
author: Boyko Markov
---

Any grid people edit needs a safety net, and undo/redo is it, the difference between "oh no" and a casual Ctrl+Z, and the thing that makes bulk data entry far less nerve-wracking. Because SvGrid hands you both the old and new value on every edit, the undo stack practically builds itself.

![Inline cell editing in SvGrid.](/blog-media/inline-editing.png)
*Inline cell editing in SvGrid.*

## The change event has everything you need

SvGrid's `onCellValueChange` gives you `{ rowIndex, columnId, oldValue, newValue, row }`, exactly the information to record and reverse an edit:

```ts
type Edit = { rowIndex: number; columnId: string; oldValue: unknown; newValue: unknown }
let undoStack = $state<Edit[]>([])
let redoStack = $state<Edit[]>([])

function onCellValueChange(e) {
  apply(e.rowIndex, e.columnId, e.newValue)
  undoStack.push({ rowIndex: e.rowIndex, columnId: e.columnId, oldValue: e.oldValue, newValue: e.newValue })
  redoStack = [] // a new edit invalidates the redo branch
}

function apply(rowIndex: number, columnId: string, value: unknown) {
  rows[rowIndex] = { ...rows[rowIndex], [columnId]: value }
}
```

## Undo and redo

Undo pops the last edit, restores the old value, and pushes it onto the redo stack; redo does the reverse:

```ts
function undo() {
  const e = undoStack.pop(); if (!e) return
  apply(e.rowIndex, e.columnId, e.oldValue)
  redoStack.push(e)
}
function redo() {
  const e = redoStack.pop(); if (!e) return
  apply(e.rowIndex, e.columnId, e.newValue)
  undoStack.push(e)
}
```

## Keyboard shortcuts

Wire the conventions users expect, and avoid hijacking them while typing in an input:

```svelte
<svelte:window onkeydown={(e) => {
  if (e.target instanceof HTMLInputElement) return
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo() }
}} />
```

## Coalescing and limits

- **Coalesce** rapid edits to the same cell (typing) into one undo step, so one Ctrl+Z does not revert character by character.
- **Cap the stack** (say 100 entries) so memory stays bounded.
- **Persist server changes too**: if edits hit the server, undo should also send the reverse update, not just change local state.

## Frequently asked questions

### How do I add undo/redo to an editable data grid?

Record each `onCellValueChange` as an edit with its old and new value on an undo stack. Undo restores the old value and moves the entry to a redo stack; redo reapplies the new value. Wire Ctrl+Z and Ctrl+Shift+Z/Ctrl+Y to them.

### How do I keep undo from reverting one character at a time?

Coalesce consecutive edits to the same cell into a single undo step, so typing produces one history entry rather than one per keystroke. Also cap the stack size to keep memory bounded.
