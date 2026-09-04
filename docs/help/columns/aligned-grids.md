# Aligned grids

Aligned grids are two or more independent `<SvGrid>` instances kept in lockstep:
**horizontal scroll** and **column-resize widths** propagate between them. Use it
for a budget-vs-actuals comparison, or a totals grid pinned under a body grid,
where the columns must stay lined up.

Give every grid in the set the same non-empty `alignedGridGroup`:

```svelte
<SvGrid data={budget}  columns={budgetCols}  alignedGridGroup="finance" />
<SvGrid data={actuals} columns={actualCols} alignedGridGroup="finance" />
```

<div data-docs-demo="182-aligned-grids" data-height="520"></div>

## What syncs

- **Horizontal scroll** - scrolling one grid scrolls the others to the same
  `scrollLeft`.
- **Column widths** - resizing a column mirrors to the matching column (by `id`)
  in every other grid in the group.

Vertical scroll and selection stay independent (each grid owns its own rows).

## Notes

- Declare the **same columns** (matched by `id`, falling back to `field`) in each
  grid so widths map one-to-one. Give each grid its **own** column-array
  instance.
- Only user resizes are mirrored; default and `fitColumns` widths already match
  when the columns and container widths match.
- Any number of grids can share a group; add/remove one and the rest keep
  working. Groups are independent - use different strings for unrelated sets.


## Two grids, one group

Scroll either grid sideways and the other follows; drag a column edge and the
matching column resizes in both. Nothing is shared but the group string - the two
grids have their own data, their own selection and their own vertical scroll.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Quarter = { line: string; q1: number; q2: number; q3: number; q4: number }

  const budget: Quarter[] = [
    { line: 'Salaries',  q1: 420000, q2: 430000, q3: 435000, q4: 440000 },
    { line: 'Cloud',     q1: 38000,  q2: 41000,  q3: 44000,  q4: 47000 },
    { line: 'Travel',    q1: 12000,  q2: 15000,  q3: 9000,   q4: 18000 },
  ]

  const actuals: Quarter[] = [
    { line: 'Salaries',  q1: 418200, q2: 433100, q3: 431900, q4: 447500 },
    { line: 'Cloud',     q1: 40100,  q2: 39800,  q3: 46600,  q4: 52300 },
    { line: 'Travel',    q1: 9400,   q2: 17600,  q3: 8100,   q4: 21200 },
  ]

  const money = { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } as const

  // Each grid gets its OWN column array instance, matched by id/field.
  const cols = (): GridColumns<Quarter> => [
    { field: 'line', header: 'Line item', width: 160 },
    { field: 'q1', header: 'Q1', width: 130, format: money },
    { field: 'q2', header: 'Q2', width: 130, format: money },
    { field: 'q3', header: 'Q3', width: 130, format: money },
    { field: 'q4', header: 'Q4', width: 130, format: money },
  ]
</script>

<p>Budget</p>
<SvGrid data={budget} columns={cols()} alignedGridGroup="finance" containerHeight={150} />

<p>Actuals</p>
<SvGrid data={actuals} columns={cols()} alignedGridGroup="finance" containerHeight={150} />
```

## A totals strip under the body

The common shape: a tall body grid and a one-row grid beneath it carrying the
totals. Same group, same column ids, so the totals stay under the right numbers
however far the body is scrolled.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Quarter = { line: string; q1: number; q2: number; q3: number; q4: number }

  const rows: Quarter[] = [
    { line: 'Salaries', q1: 420000, q2: 430000, q3: 435000, q4: 440000 },
    { line: 'Cloud',    q1: 38000,  q2: 41000,  q3: 44000,  q4: 47000 },
    { line: 'Travel',   q1: 12000,  q2: 15000,  q3: 9000,   q4: 18000 },
    { line: 'Hardware', q1: 61000,  q2: 22000,  q3: 18000,  q4: 74000 },
  ]

  const sum = (k: 'q1' | 'q2' | 'q3' | 'q4') => rows.reduce((s, r) => s + r[k], 0)

  const totals: Quarter[] = [
    { line: 'Total', q1: sum('q1'), q2: sum('q2'), q3: sum('q3'), q4: sum('q4') },
  ]

  const money = { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } as const

  const cols = (): GridColumns<Quarter> => [
    { field: 'line', header: 'Line item', width: 160 },
    { field: 'q1', header: 'Q1', width: 130, format: money },
    { field: 'q2', header: 'Q2', width: 130, format: money },
    { field: 'q3', header: 'Q3', width: 130, format: money },
    { field: 'q4', header: 'Q4', width: 130, format: money },
  ]
</script>

<SvGrid data={rows} columns={cols()} alignedGridGroup="totals-demo" containerHeight={170} sortable />

<SvGrid data={totals} columns={cols()} alignedGridGroup="totals-demo" containerHeight={80} />
```

## See also

- [Column sizing](./column-sizing.md)
- [Multi-grid sync](../../../examples/src/demos/70-multi-grid-sync.svelte) - sharing *data* (not layout) via `$state`
