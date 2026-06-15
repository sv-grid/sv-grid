---
title: Conditional Row Styling in SvGrid
description: Highlight whole rows by their data - overdue invoices, errors, VIP customers - with value-driven row classes and styles in your Svelte data grid.
date: 2026-07-14
category: Rows
tags: conditional formatting, row styling, rows, recipe, svelte data grid
author: Kamelia M
---

Sometimes the whole row matters, not a single cell: an overdue invoice in red, a failed job tinted, a VIP customer highlighted. This is row-level conditional formatting, and it is the fastest way to make a grid scannable. Here is how to drive it from your data.

## Style rows by a derived flag

Compute a status from the row and map it to a class. Keep the logic in one place so it is easy to reason about:

```ts
function rowClass(row: Row): string {
  if (row.dueDate < today && !row.paid) return 'row-overdue'
  if (row.priority === 'high') return 'row-priority'
  return ''
}
```

```css
.row-overdue { background: color-mix(in srgb, #e5484d 12%, transparent); }
.row-priority { background: color-mix(in srgb, var(--sg-accent) 10%, transparent); }
```

Apply the class to the row via SvGrid's row styling hook (or a wrapper class), so the tint spans the whole row, under every cell.

## Use tokens, not hard-coded colors

Drive the colors from `--sg-*` and theme variables so row highlights look right in both light and dark mode and match your brand. A hard-coded red can look wrong on a dark surface; `color-mix` with a token adapts. See [theming and dark mode](theming-and-dark-mode).

## Do not rely on color alone

Color is a signal, not the only signal - colorblind users and screen readers need more. Pair a row tint with an icon, a badge, or text ("Overdue") in one of the cells. This is both better UX and a WCAG consideration - see [accessible data tables](accessible-data-table-wcag).

## Row vs cell formatting

Use **row** styling when the whole record has a state (overdue, archived, selected). Use **cell** conditional formatting when a single value crosses a threshold (a negative number, a low score) - see [conditional formatting](conditional-formatting). They compose: a tinted overdue row can still have a red balance cell.

## Frequently asked questions

### How do I highlight an entire row based on its data in SvGrid?

Compute a status from the row, map it to a CSS class, and apply that class at the row level so the style spans every cell. Drive the colors from theme tokens so they adapt to light and dark mode.

### Is it okay to use only color to flag rows?

No - color alone excludes colorblind and screen-reader users. Pair a row tint with an icon, badge, or text label so the meaning is conveyed without relying on color, in line with WCAG guidance.
