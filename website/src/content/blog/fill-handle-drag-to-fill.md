---
title: A Fill Handle (Drag to Fill) in SvGrid
description: Build the spreadsheet fill handle - drag a cell's corner to copy its value down a column - on top of SvGrid's cell selection.
date: 2026-07-29
category: Editing
tags: fill handle, editing, spreadsheet, cell selection, recipe
author: Boyko Markov
---

The fill handle - that little square in a cell's corner you grab and drag to copy a value down a column - is one of those spreadsheet moves people miss instantly when it is gone. SvGrid gives you the cell selection and editing underneath; the fill handle is a thin layer on top.

![A spreadsheet fill handle in SvGrid](/blog-media/fill-handle.png)
*A drag-to-fill handle in SvGrid.*

## The interaction

A fill handle has three steps: the user grabs the handle on the active cell, drags over a range, and on release the source value is written to every cell in that range. You drive it with pointer events and your own `data` updates.

```svelte
{#snippet Cell(p: { row: Row; rowIndex: number; field: string; value: unknown })}
  <span class="cell" onpointerdown={() => focusCell(p.rowIndex, p.field)}>
    {p.value}
    <span class="fill-handle" onpointerdown={(e) => startFill(e, p.rowIndex, p.field, p.value)}></span>
  </span>
{/snippet}
```

## Track the drag and commit

On drag, highlight the target range; on release, write the source value to each row in it:

```ts
function startFill(e: PointerEvent, fromRow: number, field: string, value: unknown) {
  e.stopPropagation()
  const move = (ev: PointerEvent) => { fillTo = rowIndexAt(ev.clientY) /* highlight */ }
  const up = () => {
    for (let r = fromRow + 1; r <= fillTo; r++) rows[r] = { ...rows[r], [field]: value }
    rows = [...rows]
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
}
```

## Beyond copy: series fill

Spreadsheets also fill *series*, drag 1, 2 and it continues 3, 4; drag a date and it increments. Detect a numeric or date pattern in the source selection and extrapolate rather than copy. Start with plain copy (the common case) and add series detection if your users need it.

## Make it commit like an edit

Route the filled values through the same path as a normal edit - your `onCellValueChange` logic or a shared `commit` function - so validation, persistence, and [undo/redo](undo-redo-grid-edits) all apply to a fill just as they do to a typed edit. A fill that bypasses validation is a bug magnet.

## Frequently asked questions

### How do I add a fill handle to a Svelte data grid?

Render a small handle in the active cell, track a pointer drag to determine the target range, and on release write the source value into each row of that range in your `data`. Route those writes through your normal edit/commit path.

### Can the fill handle continue a series, not just copy?

Yes, detect a numeric or date pattern in the dragged source cells and extrapolate it across the fill range. Most apps start with simple copy (the common case) and add series detection only if needed.
