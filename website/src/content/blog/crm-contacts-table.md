---
title: Building a CRM Contacts Table in Svelte
description: A blueprint for a CRM contacts grid - avatars, status badges, inline editing, saved views, and bulk actions - built with SvGrid.
date: 2026-07-17
category: Use cases
tags: crm, contacts, use case, svelte data grid
author: Boyko Markov
---

A CRM contacts table is the screen sales teams live in. It needs to be scannable, editable, and fast to act on. Here is a blueprint that combines a handful of SvGrid recipes into a polished CRM grid.

![A CRM sales pipeline grid in SvGrid](/blog-media/crm.png)
*A CRM pipeline built with SvGrid.*

## The columns

A useful contacts grid is more than text. Mix in rich cells:

- **Contact** - an [avatar cell](avatar-and-image-cells) with name and email.
- **Status** - a [status badge](status-badge-cells) (Lead, Active, Churned).
- **Owner** - an avatar or name.
- **Deal value** - a currency column (`format: { type: 'currency' }`).
- **Last contacted** - a date column.
- **Actions** - an [actions column](actions-column-edit-delete) (email, edit, delete).

## Inline editing

Sales reps update contacts constantly, so make key fields editable in place - status via an [editable dropdown](editable-select-dropdown-cell), owner via an [autocomplete cell](autocomplete-cell-editor), deal value via a number editor - committing through `onCellValueChange` with [optimistic saves](optimistic-updates).

## Filtering and saved views

Reps want their own slices: "My leads", "Closing this month", "Untouched in 30 days". Enable Excel-style filtering and layer [saved views](saved-views-persist-layout) so each rep keeps named filter+layout presets. Sync the active view to the [URL](sync-grid-state-to-url) so a view is shareable.

## Bulk actions

Selection plus a contextual toolbar turns the grid into a workflow: select contacts, then assign an owner, add a tag, or start a sequence - see [bulk operations](bulk-operations-on-selected-rows).

## Scaling

A few thousand contacts can live client-side for instant filtering. Past that, move to [server-side data](server-side-data) so the CRM scales to large books of business without shipping everything to the browser. The UI stays identical.

## Frequently asked questions

### How do I build a CRM contacts grid in Svelte?

Combine SvGrid recipes: avatar and badge cells for scannability, inline editing (dropdowns, autocomplete, number editors) for quick updates, Excel-style filters plus saved views for personal slices, and row selection with a toolbar for bulk actions.

### How many contacts can the grid handle?

A few thousand work client-side with instant filtering thanks to virtualization. For larger contact books, switch to server-side data so only the current page loads, keeping the CRM responsive at any scale.
