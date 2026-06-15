---
title: Keyboard Navigation and Accessibility in SvGrid
description: SvGrid ships WAI-ARIA roles and full keyboard control by default. Learn the keyboard map and how to keep custom cells accessible.
date: 2026-02-17
category: Accessibility
tags: accessibility, wai-aria, keyboard navigation, svelte data grid
author: Kamelia M
---

Accessibility is not a feature you add later; it is a default a grid should ship with, because retrofitting it almost never works. SvGrid renders a semantic table with WAI-ARIA roles and full keyboard navigation from the very first line, so keyboard and screen-reader users are covered before you write a single extra line.

![Keyboard navigation and accessibility in SvGrid](/blog-media/accessibility.png)
*SvGrid is keyboard-navigable and screen-reader friendly by default.*

## What you get for free

Every grid SvGrid renders includes:

- `role="grid"`, `role="row"`, `role="columnheader"`, and `role="gridcell"` on the right nodes.
- A roving focus model: one cell is the active tab stop, and arrow keys move focus.
- A visible focus ring so sighted keyboard users always know where they are.

You do not configure any of this. It is simply how the grid is built.

## The keyboard map

| Action                 | Keys                      |
| ---------------------- | ------------------------- |
| Move active cell       | Arrow keys                |
| First / last in row    | Home / End                |
| First / last in grid   | Ctrl + Home / Ctrl + End  |
| Page up / down         | Page Up / Page Down       |
| Edit the active cell   | F2 or Enter               |
| Commit / cancel edit   | Enter / Escape            |

This matches what users already know from spreadsheets, so there is nothing new to learn.

## Keep custom cells accessible

When you render a custom cell with a snippet, keep it keyboard-friendly:

- Use real `<button>` and `<a>` elements for actions, not clickable `<div>`s.
- Provide an `aria-label` on icon-only buttons so screen readers announce them.
- Do not trap focus inside a cell; let arrow keys continue to move through the grid.

A badge or progress bar needs no extra work; an interactive control does, and the standard HTML elements give you accessibility for free.

## Test it

The fastest accessibility test costs nothing: unplug your mouse. Tab into the grid, move with the arrow keys, edit a cell, and trigger a row action - all without touching the pointer. If that flow works, most keyboard users are covered. Follow up with a screen reader to confirm cells and headers are announced.

## Frequently asked questions

### Is SvGrid accessible by default?

Yes. It renders WAI-ARIA grid roles and supports full keyboard navigation - arrow keys, Home/End, Ctrl+Home/End, and F2 to edit - without any configuration.

### How do I keep custom cells accessible?

Use native `<button>` and `<a>` elements for interactive content, add `aria-label` to icon-only controls, and avoid trapping focus so arrow-key navigation keeps working.
