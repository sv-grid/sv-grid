---
title: Building a Project / Task Board with a Svelte Data Grid
description: A blueprint for a task management grid - grouping by status or assignee, inline edits, subtasks via tree rows, and saved views.
date: 2026-08-27
category: Use cases
tags: tasks, project management, grouping, use case, svelte data grid
author: Victor Vidolov
---

Not every task tool needs a Kanban board - a grid view is often faster for triage, bulk edits, and seeing everything at once. Here is a blueprint for a task/project grid with SvGrid.

![A work-breakdown project tree in SvGrid](/blog-media/wbs-tree.png)
*A project breakdown as tree rows in SvGrid.*

## The columns

- **Task** - title, often with a subtask indent (see tree rows below).
- **Assignee** - an [avatar cell](avatar-and-image-cells) or [autocomplete editor](autocomplete-cell-editor).
- **Status** - a [badge](status-badge-cells) plus an [editable dropdown](editable-select-dropdown-cell) (Todo, In progress, Done).
- **Priority** - a colored badge.
- **Due date** - a [date editor](date-picker-cell-editor); flag overdue with [row styling](conditional-row-styling).

## Group by what matters

The grid view's superpower is grouping. [Group by status](grouping-and-aggregation) for a board-like view, by assignee for workload, or by sprint - each with a count per group. Let users switch the grouping; it is the fastest way to reframe the same data.

## Subtasks via tree rows

Represent subtasks as [tree rows](tree-data-hierarchies): a parent task expands to its children, indented. Roll up completion (3/5 done) on the parent with aggregation.

## Fast triage

Triage is bulk work: select tasks and reassign, re-prioritize, or close in one action via [bulk operations](bulk-operations-on-selected-rows). Inline-edit status and due dates with [optimistic saves](optimistic-updates). Sync the active filter/group to the [URL](sync-grid-state-to-url) so a view ("my overdue tasks") is shareable, and persist [saved views](saved-views-persist-layout).

## Live collaboration

If teammates edit concurrently, push [live updates](realtime-websocket-updates) so the board stays current, and flash changed rows so people see what moved.

## Frequently asked questions

### How do I build a task management grid in Svelte?

Use SvGrid with grouping (by status, assignee, or sprint) for a board-like view, tree rows for subtasks, inline editing for status and dates, and bulk operations for fast triage. Saved views and URL sync make personal task views shareable.

### Grid view or Kanban board for tasks?

A grid is often faster for triage, bulk edits, and seeing everything at once, while Kanban suits visual flow. With grouping by status, a grid gives you a board-like view plus the editing and bulk-action power of a table.
