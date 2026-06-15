---
title: Set Filters and Custom Filter Logic in SvGrid
description: Build Excel-style set filters with checkboxes, custom operators, and faceted filtering in a Svelte data grid.
date: 2025-11-25
category: Filtering
tags: set filter, custom filters, faceted search, svelte data grid
author: Victor Vidolov
---

Text and number filters cover most needs, but categorical data wants something different: a checklist of every distinct value, the way Excel's filter dropdown works. SvGrid supports set-style filtering and custom filter logic so users can pick exactly the categories they want.

![An Excel-style set filter in SvGrid](/blog-media/set-filter.png)
*An advanced set filter in SvGrid.*

## The set filter idea

A set filter lists the distinct values in a column - statuses, regions, owners - each with a checkbox. The user ticks the ones they want to see. It is the most intuitive filter for low-cardinality categorical columns.

Build the option list from your data and let the filter match any selected value:

```ts
const statuses = [...new Set(rows.map((r) => r.status))]
// render a checkbox per status; filter keeps rows whose status is checked
```

## Custom operators

When the built-in operators do not fit, you can filter on your own predicate. For example, "show rows where any tag matches" or "show records modified this week". Compute a derived, filtered list and feed it to the grid, or drive the grid's filter callbacks from your custom control.

## Faceted counts

A polished set filter shows how many rows each option would match - "Active (1,204)", "Archived (87)". Compute the facet counts from the current data and render them next to each checkbox, so users know what they will get before they apply.

## Combine filters across columns

Filters compose with AND across columns: a status set filter plus a date range plus a text search narrows the result to rows matching all three. SvGrid tracks the full filter model, so observing `onFiltersChange` gives you the complete picture for syncing to the URL or showing an active-filters summary.

## Server-side set filters

For huge datasets, do not compute distinct values in the browser. Fetch the facet list and counts from your API, render the checklist, and send the selected values back as a query. The user gets the same set-filter experience while the heavy lifting stays on the server.

## Frequently asked questions

### How do I build an Excel-style set filter in Svelte?

Compute the distinct values of a column, render a checkbox per value, and keep rows whose value is checked. SvGrid's filtering feature tracks the model for you.

### Can I show match counts next to each filter option?

Yes. Compute faceted counts from the current data (or fetch them from your API for large sets) and render them beside each checkbox so users see results before applying.
