---
title: The WAI-ARIA Grid Pattern Explained
description: What the ARIA grid pattern is, the roles and keyboard behavior it requires, and when to use it instead of a plain table.
date: 2026-09-19
category: Concepts
tags: aria, accessibility, concepts, grid pattern, data grid
author: Victor Vidolov
---

If you are building an editable, keyboard-navigable table, there is already a spec for getting the accessibility right: the WAI-ARIA grid pattern. It is not optional folklore, it is the thing screen readers expect. Here is what it actually asks of you, in plain terms.

![Keyboard navigation and accessibility in SvGrid.](/blog-media/accessibility.png)
*Keyboard navigation and accessibility in SvGrid.*

## Grid vs table: pick the right one

The ARIA Authoring Practices define two relevant patterns:

- **A static data table** (information only) uses native `<table>` semantics, `<th scope>`, `<caption>`. Screen readers announce row/column relationships from the markup.
- **An interactive grid** (cells you navigate and edit with the keyboard, like a spreadsheet) uses the **grid pattern**, ARIA roles plus a managed focus model.

Using the grid pattern on a static table is overkill and can hurt; using a plain table for an interactive grid leaves keyboard users stranded. Match the pattern to the behavior.

## The roles

The grid pattern uses:

- `role="grid"` on the container.
- `role="row"` on each row.
- `role="columnheader"` (and `rowheader` where relevant) on header cells.
- `role="gridcell"` on body cells.

These tell assistive technology "this is a navigable grid", not just a layout of text.

## The keyboard model

This is the heart of the pattern, a **roving tabindex**: the grid is a single tab stop, and arrow keys move a single "active" cell within it. So a user tabs *into* the grid once, then navigates cells with arrows, rather than tabbing through thousands of cells. The expected keys:

- Arrow keys move the active cell.
- Home / End to row ends; Ctrl+Home / Ctrl+End to grid corners.
- Page Up / Page Down by a viewport.
- Enter / F2 to edit, Escape to cancel.

These match spreadsheets, so there is nothing new to learn.

## Why it is hard to retrofit

The roving focus model and roles shape the component's architecture. A grid built without them cannot be patched into compliance - you rebuild. That is why a serious grid implements the pattern from the start. SvGrid renders the grid pattern and full keyboard navigation by default - see [accessible data tables](accessible-data-table-wcag) and [keyboard navigation](keyboard-navigation-and-accessibility).

## Frequently asked questions

### What is the WAI-ARIA grid pattern?

It is the accessibility specification for interactive, spreadsheet-like tables: `role="grid"`, `row`, `columnheader`, and `gridcell`, plus a roving-tabindex keyboard model where the grid is one tab stop and arrow keys move the active cell.
