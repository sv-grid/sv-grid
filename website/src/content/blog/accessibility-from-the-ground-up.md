---
title: Accessibility from the Ground Up
description: Why SvGrid shipped WAI-ARIA roles and full keyboard navigation as defaults, and what it takes to keep a feature-rich grid accessible as it grows.
date: 2026-06-29
category: Engineering
tags: accessibility, keyboard, aria, engineering, story
author: Boyko Markov
---

Accessibility is the feature we insisted on from the first render and had to prove at depth as the grid grew. With sorting, filtering, editing, grouping, and hierarchy in place, all of it had to be usable by keyboard and screen reader - not as a retrofit, but as the thing it had been from line one.

## We did not bolt it on, because that never works

The hardest lesson in accessible UI is that you cannot add it later. A grid built without focus management or semantic roles cannot be patched into one; the assumptions are wrong all the way down. So accessibility was a day-one default, and this month was about holding that line as the feature set grew.

From the very first three-row grid, SvGrid rendered a semantic table with the right WAI-ARIA roles - `grid`, `row`, `columnheader`, `gridcell` - and a roving focus model where one cell is the tab stop and arrow keys move it. Every feature added after had to preserve that, not break it.

## The keyboard map people already know

We did not invent a navigation scheme. We implemented the one users carry from spreadsheets, so there is nothing to learn:

- Arrow keys move the active cell.
- Home / End jump to row edges; Ctrl+Home / Ctrl+End to the grid corners.
- Page Up / Page Down move by a viewport.
- F2 or Enter edits; Escape cancels.

The discipline was making each new feature fit this map rather than add a special case. Expansion got Enter and arrow semantics. Editing got the commit-and-move flow. Selection got Shift-arrow ranges.

## The hard part: features and focus

Each feature we had built was a potential accessibility regression. Virtualization recycles DOM rows - so focus had to survive a row scrolling out and a recycled node taking its place. Inline editing puts an input inside a cell - so focus had to move in and back out cleanly without trapping. Expansion changes how many rows exist - so the roving model had to stay coherent as the row count shifted under it.

None of this is glamorous, and all of it is the difference between a grid that claims accessibility and one that has it.

## Custom cells stay accessible if you let them

We could make the grid accessible, but cells are where authors add their own controls. So the guidance we built around custom cells is simple and load-bearing: use real `<button>` and `<a>` elements, label icon-only controls, and do not trap focus. A badge needs nothing extra; an interactive control gets accessibility for free from the right HTML element.

The usage write-up is [Keyboard Navigation and Accessibility in SvGrid](keyboard-navigation-and-accessibility). This post is about why it was never optional.

## How we tested it

The cheapest accessibility test costs nothing: unplug the mouse. We tabbed into the grid, moved with the arrow keys, edited a cell, expanded a row, and triggered an action, all without the pointer - then confirmed with a screen reader that cells and headers were announced. A feature was not done until it passed that.

## What it secured

Proving accessibility held across the whole feature set meant SvGrid could go into the kinds of products our team has always served, where keyboard and screen-reader support is a requirement, not a nice-to-have. Read next: [a theming system on CSS variables](building-the-theming-system) - how the grid looks.

## Frequently asked questions

### Is SvGrid accessible by default?

Yes. It renders WAI-ARIA grid roles and supports full keyboard navigation - arrow keys, Home/End, Ctrl+Home/End, F2 to edit - from the first render, with no configuration required.

### Why can't accessibility be added to a grid later?

Because focus management and semantic roles shape the architecture. A grid built without them makes assumptions that cannot be patched into accessibility, which is why SvGrid treated it as a day-one default and preserved it as features were added.
