---
title: A Date-Picker Cell Editor in SvGrid
description: Make date columns editable with a real date picker - using SvGrid's built-in date editor, formatting the display, and handling time zones.
date: 2026-07-12
category: Editing
tags: editing, date picker, cell editor, formatting, recipe
author: SvGrid Team
---

Dates are everywhere in business data and easy to get wrong. SvGrid has a built-in date editor, so making a column editable with a proper date picker is one property - the care is in formatting and time zones. Here is the recipe.

## Use the built-in date editor

Set `editorType: 'date'` (or `'datetime'` for date + time) and format the display separately:

```ts
const columns: ColumnDef<{}, Row>[] = [
  {
    field: 'startedAt',
    header: 'Started',
    editorType: 'date',
    format: { type: 'date', pattern: 'y-m-d' },
  },
]
```

The user gets a native date picker on edit; the cell displays a formatted date the rest of the time. Because formatting lives in `format`, the column still sorts and filters as a real date, not a string.

## Store ISO, display localized

The reliable pattern: store dates as ISO strings (or `Date`s) and let `format` localize them. Mixing display strings into your data is the root of most date sorting bugs - keep the raw value clean and format on the column. See [locale-aware formatting](locale-aware-formatting).

## Time zones: be deliberate

The classic off-by-one-day bug comes from mixing zones. Decide once:

- Render in the **user's local zone**, or
- Render in **UTC** consistently.

Do not mix. When committing an edit, normalize to the zone your backend expects. A date with no time component is safest stored as a plain `YYYY-MM-DD` to avoid midnight-rollover surprises.

## Validation

Reject impossible values in `onCellValueChange` - an end date before a start date, a date outside an allowed range - before writing it back, and surface the error without discarding the user's input. See [inline editing with validation](inline-editing-with-validation).

## Frequently asked questions

### How do I make a date column editable in SvGrid?

Set `editorType: 'date'` (or `'datetime'`) on the column and use the `format` option for display. Users get a native date picker on edit, while the column keeps sorting and filtering as a real date.

### How do I avoid off-by-one date bugs in a grid?

Store dates as ISO values and format them on the column, never mixing display strings into your data. Pick one time zone (user-local or UTC) and stick to it, and consider plain `YYYY-MM-DD` for date-only fields to avoid midnight rollovers.
