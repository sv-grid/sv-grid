---
title: What Makes a Data Table Accessible? (WCAG)
description: A practical guide to accessible data tables and grids - semantic markup, WAI-ARIA grid roles, keyboard navigation, and the WCAG criteria that apply.
date: 2026-06-20
category: Accessibility
tags: accessibility, wcag, aria, data table, concepts
author: Kamelia M
---

Accessible data tables are a requirement for many organizations - government, finance, healthcare, and any enterprise with a procurement checklist. They are also just good engineering. Here is what "accessible" actually means for a table or grid, and how to get there.

![A high-contrast accessible SvGrid theme](/blog-media/high-contrast.png)
*A high-contrast theme; SvGrid ships accessible by default.*

## Two kinds of tables, two markup patterns

The right semantics depend on what the table is:

- **A static data table** (information in rows and columns) should use semantic `<table>`, `<thead>`, `<th scope="col">`, `<tbody>`, and `<caption>`. Screen readers announce row/column relationships from this structure.
- **An interactive data grid** (editable, navigable like a spreadsheet) should use the WAI-ARIA grid pattern: `role="grid"`, `role="row"`, `role="columnheader"`, and `role="gridcell"`, with a managed focus model.

Using grid roles on a static table, or omitting them on an interactive one, both cause problems. Match the pattern to the behavior.

## Keyboard navigation is non-negotiable

If it works only with a mouse, it is not accessible. An accessible grid supports:

- Arrow keys to move the active cell.
- Home/End and Ctrl+Home/Ctrl+End for row and grid edges.
- A single tab stop into the grid (roving tabindex), so keyboard users are not trapped tabbing through thousands of cells.
- Enter/F2 to edit, Escape to cancel - matching spreadsheet conventions users already know.

## The WCAG criteria that apply

The ones a table most often touches:

- **1.3.1 Info and Relationships** - structure conveyed programmatically (proper headers and scope).
- **1.4.3 Contrast** - text and UI contrast against the background.
- **2.1.1 Keyboard** - all functionality available from the keyboard.
- **2.4.7 Focus Visible** - a clear focus indicator on the active cell.
- **4.1.2 Name, Role, Value** - controls (sort buttons, checkboxes, editors) expose their role and state.

## Common mistakes

- Clickable `<div>`s instead of real `<button>`/`<a>` for actions (no keyboard, no role).
- Icon-only buttons with no `aria-label`.
- A focus indicator removed for aesthetics.
- Virtualization that drops focus when a row recycles.
- Color as the only signal (red/green with no text or icon).

## Accessibility cannot be retrofitted

The hard truth: a grid built without focus management and semantic roles cannot be patched into an accessible one - the assumptions are wrong throughout, and you rebuild. That is why it should be a default, not a setting.

SvGrid renders the WAI-ARIA grid pattern and full keyboard navigation from the first render, and preserves focus across virtualized row recycling. The practical guide is [Keyboard Navigation and Accessibility](keyboard-navigation-and-accessibility). For custom cells, the rule is simple: use real interactive elements and label icon-only controls.

## Frequently asked questions

### What makes a data table accessible?

Semantic markup (or the WAI-ARIA grid pattern for interactive grids), full keyboard navigation with a visible focus indicator, programmatic header relationships, sufficient contrast, and controls that expose their name, role, and value - aligning with WCAG criteria like 1.3.1, 2.1.1, and 2.4.7.

### Can I add accessibility to a data grid later?

Not really. Focus management and semantic roles shape the architecture, so a grid built without them must be rebuilt rather than patched. Choose a grid that ships accessibility as a default - SvGrid renders ARIA grid roles and keyboard navigation from the first render.
