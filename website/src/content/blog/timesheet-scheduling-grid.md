---
title: Building a Timesheet / Scheduling Grid in Svelte
description: How to wire up grouped column headers, live row totals, footer aggregation, and per-cell validation in SvGrid to build a weekly timesheet.
date: 2026-09-16
updated: "2026-07-02"
category: Use cases
tags: timesheet, scheduling, use case, svelte data grid
author: Boyko Markov
---
Most timesheet grids look simple until you try to build one properly. Rows are people or tasks, columns are days, cells hold editable hours - but then you need row totals that update as you type, footer totals that sum each column, per-cell validation that blocks submission on bad input, and grouped column headers that keep "Mon" through "Sun" visually under a single "This week" label. Four distinct concerns, all active at the same time.

SvGrid handles all four through plain column configuration and one event callback. No custom reducers, no manual DOM tricks. The full component below is self-contained and runs in any Svelte 5 project with `@svgrid/grid` installed.

## The row type and helper functions

Keeping the row type flat makes everything else simpler. Each numeric field maps directly to a column, which means SvGrid can read and write it without any getter/setter plumbing.

```ts
// timesheet-types.ts
export type TimesheetRow = {
  id: string
  task: string
  mon: number
  tue: number
  wed: number
  thu: number
  fri: number
  sat: number
  sun: number
}

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Day = (typeof DAYS)[number]

export const DAY_LABELS: Record<Day, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed',
  thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

export function weekTotal(row: TimesheetRow): number {
  return DAYS.reduce((sum, d) => sum + (Number(row[d]) || 0), 0)
}

export function sampleRows(): TimesheetRow[] {
  return [
    { id: '1', task: 'Frontend', mon: 8, tue: 8, wed: 6, thu: 8, fri: 7, sat: 0, sun: 0 },
    { id: '2', task: 'API work', mon: 0, tue: 4, wed: 8, thu: 8, fri: 8, sat: 0, sun: 0 },
    { id: '3', task: 'Code review', mon: 2, tue: 2, wed: 2, thu: 2, fri: 2, sat: 0, sun: 0 },
    { id: '4', task: 'Meetings', mon: 2, tue: 2, wed: 2, thu: 2, fri: 1, sat: 0, sun: 0 },
    { id: '5', task: 'Documentation', mon: 0, tue: 0, wed: 4, thu: 2, fri: 4, sat: 2, sun: 0 },
  ]
}
```

`weekTotal` is used in two places: the `fieldFn` on the total column, and the `cellClass` callback that applies a warning style when the week exceeds 40 hours. Keeping it outside the component means you can test it in isolation.

## Column definition - where the layout comes from

The day columns are generated from the `DAYS` array so you never have to write seven nearly-identical objects by hand. The `footer` callback on each one returns the per-column sum, and `fieldFn` on the total column computes the row sum without touching any stored field.

```ts
const dayColumns: ColumnDef<TimesheetRow>[] = DAYS.map((d) => ({
  id: d,
  field: d,
  header: DAY_LABELS[d],
  width: 72,
  editorType: 'number',
  editorOptions: { min: 0, max: 16, step: 0.5 },
  cellClass: (row) => {
    const key = `${row.id}:${d}`
    return errors[key] ? 'cell-error' : ''
  },
  footer: () => String(dayTotals[d] ?? 0),
}))

const columns: ColumnDef<TimesheetRow>[] = [
  {
    id: 'task',
    field: 'task',
    header: 'Task',
    width: 160,
    pinned: 'left',
  },
  {
    header: 'This week',
    columns: dayColumns,
  },
  {
    id: 'total',
    header: 'Total',
    width: 80,
    editable: false,
    fieldFn: (row) => weekTotal(row),
    footer: () => String(grandTotal),
    cellClass: (row) => weekTotal(row) > 40 ? 'cell-warn' : '',
  },
]
```

The `header: 'This week'` object with a nested `columns` array is how SvGrid renders a multi-level column group - no plugin, no special prop on `<SvGrid>`. The footer row is activated by `showFooter={true}` on the component.

One thing to be explicit about: `fieldFn` columns are not writable. If you forget `editable: false` and a user double-clicks the total cell, the editor opens but `onCellValueChange` fires with `field: undefined` and the change silently vanishes. Adding `editable: false` prevents the editor from opening at all.

## The full component

```svelte
<!-- Timesheet.svelte -->
<script lang="ts">
  import SvGrid, {
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  import {
    type TimesheetRow,
    DAYS,
    DAY_LABELS,
    weekTotal,
    sampleRows,
  } from './timesheet-types'

  const MAX_HOURS = 16

  let rows = $state<TimesheetRow[]>(sampleRows())
  let gridApi = $state<SvGridApi | null>(null)
  let errors = $state<Record<string, string>>({})
  let submitted = $state(false)

  const dayTotals = $derived(
    DAYS.reduce(
      (acc, d) => {
        acc[d] = rows.reduce((s, r) => s + (Number(r[d]) || 0), 0)
        return acc
      },
      {} as Record<string, number>,
    )
  )

  const grandTotal = $derived(
    Object.values(dayTotals).reduce((s, v) => s + v, 0)
  )

  function validate(rowId: string, field: string, value: number): string | null {
    if (value < 0) return 'Hours cannot be negative'
    if (value > MAX_HOURS) return `Max ${MAX_HOURS} h per cell`
    return null
  }

  const dayColumns: ColumnDef<TimesheetRow>[] = DAYS.map((d) => ({
    id: d,
    field: d,
    header: DAY_LABELS[d],
    width: 72,
    editorType: 'number',
    editorOptions: { min: 0, max: MAX_HOURS, step: 0.5 },
    cellClass: (row) => (errors[`${row.id}:${d}`] ? 'cell-error' : ''),
    footer: () => String(dayTotals[d] ?? 0),
  }))

  const columns: ColumnDef<TimesheetRow>[] = [
    { id: 'task', field: 'task', header: 'Task', width: 160, pinned: 'left' },
    { header: 'This week', columns: dayColumns },
    {
      id: 'total',
      header: 'Total',
      width: 80,
      editable: false,
      fieldFn: (row) => weekTotal(row),
      footer: () => String(grandTotal),
      cellClass: (row) => weekTotal(row) > 40 ? 'cell-warn' : '',
    },
  ]

  function onCellValueChange(event: {
    rowId: string
    field: string
    newValue: unknown
  }) {
    const { rowId, field, newValue } = event
    const value = Number(newValue) // editor always returns a string
    const key = `${rowId}:${field}`
    const error = validate(rowId, field, value)

    if (error) {
      errors = { ...errors, [key]: error }
    } else {
      const { [key]: _, ...rest } = errors
      errors = rest
    }

    rows = rows.map((r) =>
      r.id === rowId ? { ...r, [field]: value } : r
    )
  }

  function onApiReady(api: SvGridApi) {
    gridApi = api
  }

  function handleSubmit() {
    if (Object.keys(errors).length > 0) return
    submitted = true
    console.log('Submitting timesheet:', rows)
  }
</script>

<div class="timesheet-wrap">
  {#if submitted}
    <p class="banner-ok">Timesheet submitted.</p>
  {/if}

  <SvGrid
    {columns}
    data={rows}
    features={tableFeatures([rowSortingFeature])}
    showFooter={true}
    onCellValueChange={onCellValueChange}
    onApiReady={onApiReady}
    class="timesheet-grid"
  />

  {#if Object.keys(errors).length > 0}
    <ul class="error-list">
      {#each Object.entries(errors) as [key, msg]}
        <li>{key.replace(':', ' – ')}: {msg}</li>
      {/each}
    </ul>
  {/if}

  <button
    onclick={handleSubmit}
    disabled={Object.keys(errors).length > 0}
    class="submit-btn"
  >
    Submit timesheet
  </button>
</div>

<style>
  .timesheet-wrap { display: flex; flex-direction: column; gap: 12px; }
  :global(.cell-error) { background: #fef2f2 !important; outline: 2px solid #ef4444; }
  :global(.cell-warn) { background: #fffbeb !important; color: #b45309; font-weight: 600; }
  .error-list { color: #dc2626; font-size: 0.875rem; padding-left: 1rem; }
  .submit-btn { align-self: flex-end; padding: 8px 24px; }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .banner-ok { color: #16a34a; font-weight: 600; }
</style>
```

## How validation and reactivity interact

When the user commits a cell edit, SvGrid fires `onCellValueChange` with `rowId`, `field`, and `newValue`. The value arrives as a string even when the editor type is `'number'` - always wrap it in `Number()` before arithmetic. `Number("8") === 8`, but `"8" + 1 === "81"`.

The handler validates first, writes the error or clears it from the `errors` map, then updates `rows`. Because `dayTotals` and `grandTotal` are `$derived`, Svelte recalculates them in the same microtask - you do not need to call any SvGrid refresh method. The footer just updates.

Cell styling uses `cellClass`, which receives the full row object and returns a class string. The `:global(...)` wrapper is necessary because SvGrid renders cells outside the Svelte component's style boundary, so scoped classes never reach them.

## Turning it into a shift scheduler

If you need cells to hold shift labels (Morning / Afternoon / Night) instead of numeric hours, the changes are small:

- Change `editorType: 'number'` to `editorType: 'select'`
- Add `editorOptions: { options: ['Morning', 'Afternoon', 'Night', 'Off'] }` to each day column
- Update `TimesheetRow` so day fields are `string` instead of `number`
- Replace numeric validation with an allowlist check
- Replace the `reduce` in `dayTotals` with a count per shift type if you want footer aggregation to mean something

The column structure, the group header, the pinned task column, and the footer row all stay exactly the same.

## Filtering and totals

If you add `filterable` to `<SvGrid>` and users filter by task name, the footer totals will still reflect the full dataset because `dayTotals` is derived from `rows`, not from what SvGrid currently displays. To make the footer track the filtered view, pull visible rows from the api and re-derive:

```ts
let filteredTotals = $state<Record<string, number>>({})

function onFilterChange() {
  if (!gridApi) return
  const visible = gridApi.getDisplayedRows()
  filteredTotals = DAYS.reduce(
    (acc, d) => {
      acc[d] = visible.reduce((s, r) => s + (Number(r[d]) || 0), 0)
      return acc
    },
    {} as Record<string, number>,
  )
}
```

Then pass `filteredTotals` instead of `dayTotals` into the footer callbacks. You get a footer that tracks exactly what the user is looking at.

## Undo support

SvGrid exposes `api.undo()`, `api.redo()`, and `api.canUndo()` once you have the api reference from `onApiReady`. Tracking history is a matter of snapshotting `rows` before each `onCellValueChange` commit and restoring it on undo. SvGrid re-renders automatically when `data` changes - no extra nudge required.

The component as written is a solid starting point. The interesting extensions - approval workflows, locked past days, overtime highlighting per employment contract, server-side persistence on blur rather than submit - all layer on top of the same column and event model without restructuring anything.
