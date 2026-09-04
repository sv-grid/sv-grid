# Conditional formatting

Conditional formatting colors a cell by its value. SvGrid ships it as a
declarative engine prop, `conditionalFormats`, so you describe the rules once
and the grid paints every cell - no per-cell `cell` snippet required.

<div data-docs-demo="141-conditional-formatting" data-height="480"></div>

It goes beyond the `cellClass(ctx)` callback (which only toggles static CSS
classes): color scales and data bars need a value computed against the
column's min/max range, which the engine does for you.

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    email: string
    department: string
    age: number
    salary: number
    city: string
    startDate: string
    active: boolean
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   department: 'Engineering', age: 36, salary: 142000, city: 'London',   startDate: '2021-03-01', active: true },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', department: 'Engineering', age: 45, salary: 168000, city: 'New York', startDate: '2019-07-15', active: true },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', department: 'Platform',    age: 54, salary: 155000, city: 'Portland', startDate: '2020-01-20', active: false },
    { id: 4, name: 'Radia Perlman',  email: 'radia@example.com', department: 'Networking',  age: 49, salary: 161000, city: 'Seattle',  startDate: '2022-09-05', active: true },
    { id: 5, name: 'Barbara Liskov', email: 'barbara@example.com', department: 'Platform',  age: 52, salary: 172000, city: 'Boston',   startDate: '2018-11-11', active: true },
  ]

  const data = people

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'city',       header: 'City',       width: 140 },
    { field: 'age',        header: 'Age',        width: 90 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```

```svelte
<script lang="ts">
  import { SvGrid, type ConditionalFormat } from '@svgrid/grid'

  type Row = { rep: string; revenue: number; score: number }

  const conditionalFormats: ConditionalFormat<Row>[] = [
    { type: 'dataBar', columns: ['revenue'], color: '#3b82f6' },
    { type: 'colorScale', columns: ['score'], min: '#fca5a5', mid: '#fde68a', max: '#86efac' },
  ]
</script>

<SvGrid {data} {columns} {conditionalFormats} />
```

## Format kinds

### `colorScale` - gradient fill

A 2-stop (`min`/`max`) or 3-stop (`min`/`mid`/`max`) gradient mapped across the
column's value range. Fix the scale with `minValue`/`maxValue` to make rows
comparable.

```ts
{ type: 'colorScale', columns: ['score'], min: '#fca5a5', mid: '#fde68a', max: '#86efac', minValue: 0, maxValue: 100 }
```

The color scale has several modes for turning a column into a live heat map:

**Alpha ramp (`mode: 'alpha'`)** - keep a single `base` color and interpolate its
*opacity* instead of its hue. Because the tint is translucent it composites over
zebra striping, selection, and pinned backgrounds rather than painting over
them - the cleanest heat-map look. Tune the opacity range with
`alphaBounds: [min, max]` (default `[0.05, 0.85]`).

```ts
{ type: 'colorScale', columns: ['score'], mode: 'alpha', base: '#2563eb', alphaBounds: [0.08, 0.8] }
```

**Zero-centred (`zeroCentred: true`)** - a diverging scale pinned at 0: negatives
and positives shade outward from a neutral midpoint, symmetric around zero.
Ideal for P&L, price deltas, or day-over-day change.

```ts
{ type: 'colorScale', columns: ['pnl'], min: '#ef4444', mid: '#f8fafc', max: '#22c55e', zeroCentred: true }
```

**Percent bounds (`bounds: 'percent'`)** - read `minValue`/`maxValue` as 0..100
positions along the column's own span, so you can tint "the top 20%" without
knowing the numbers up front.

```ts
{ type: 'colorScale', columns: ['score'], min: '#f8fafc', max: '#2563eb', bounds: 'percent', minValue: 80, maxValue: 100 }
```

**Banded / N-stop (`stops`)** - supply any number of `{ offset, color }` stops
(offsets 0..1) for a traffic-light or multi-band ramp; this overrides
`min`/`mid`/`max`.

```ts
{ type: 'colorScale', columns: ['risk'], stops: [
  { offset: 0, color: '#22c55e' }, { offset: 0.5, color: '#f59e0b' }, { offset: 1, color: '#ef4444' },
] }
```

**Column comparison (`compareColumn`)** - tint each cell by its value as a
proportion of another field on the *same row* (filled vs target, open vs total)
instead of the column extremes. No column stats needed.

```ts
{ type: 'colorScale', columns: ['filled'], mode: 'alpha', base: '#2563eb', compareColumn: 'target' }
```

Add `reverse: true` to flip any ramp so the lowest values draw the eye, and
`tooltip: 'value' | 'percent'` to show the raw value or its position on the ramp
on hover.

### `dataBar` - in-cell bar

An in-cell horizontal bar proportional to the value. Diverging data (can go
negative) gets `negativeColor`. `showValue: false` hides the text and shows the
bar alone. `gradient: true` fills the bar with a left-to-right gradient.

```ts
{ type: 'dataBar', columns: ['revenue'], color: '#3b82f6', negativeColor: '#ef4444' }
```

Data bars accept the same relational range options as the color scale:
`bounds: 'percent'` and `compareColumn: 'target'` size the bar against a percent
of the span or another column on the row.

```ts
{ type: 'dataBar', columns: ['filled'], color: '#3b82f6', compareColumn: 'target' }
```

### `iconSet` - threshold icons

An icon chosen by ascending `thresholds` (n thresholds => n+1 buckets). Built-in
sets: `'arrows'`, `'traffic'`, `'triangles'`. `iconOnly: true` hides the number.

```ts
// growth < 0 -> down, 0..10 -> flat, >= 10 -> up
{ type: 'iconSet', columns: ['growth'], set: 'arrows', thresholds: [0, 10] }
```

### `rule` - style on a predicate

Apply `background` / `color` / `fontWeight` when `when(ctx)` returns true. The
predicate receives the typed row, so you can key off other fields.

```ts
{ type: 'rule', columns: ['churn'], when: ({ value }) => Number(value) >= 20,
  background: '#fee2e2', color: '#991b1b', fontWeight: 700 }
```

## Scoping and precedence

- `columns: [...]` limits a format to those column ids. Omit it to apply to
  every column.
- Formats are evaluated in array order; **later entries win** on conflict, so
  list general formats first and specific overrides last.
- Empty / non-numeric cells are skipped by the numeric formats (color scale,
  data bar, icon set) and never count toward a column's min/max.

## Stat scope

`colorScale` and `dataBar` scale against a column's min/max. `conditionalStatScope`
picks which rows feed that range:

| Value | Rows scanned |
| --- | --- |
| `filtered` (default) | Everything that survives the filters, ignoring the page slice. |
| `visible` | Only the rows on screen, so each page normalizes to itself. |
| `all` | The full unfiltered dataset, so the ramp stays put as you filter. |

The default deliberately ignores paging: with a per-page range the same value
renders one colour on page 1 and a different one on page 2, which makes the
encoding misleading. Opt into `visible` when you actually want per-page
normalization.

```svelte
<SvGrid {data} {columns} {conditionalFormats} conditionalStatScope="all" />
```

## Notes

- The color-scale fill and data bar render as layers behind the text, so they
  survive app stylesheets that force the cell background.
- `mode: 'alpha'` tints are translucent, so they layer cleanly over zebra rows,
  selection, and pinned columns; `mode: 'hue'` (default) paints an opaque fill
  and auto-picks a legible text color.
- The resolver is exported as `resolveCellFormat(value, row, columnId, formats,
  stat)` if you want to compute the same result yourself.

See the live [Conditional formatting](https://svgrid.com/demos/141-conditional-formatting/)
demo.

## More examples

### Conditional formatting

Excel-style color scale, data bars, icon sets, heatmap tint - all via user-land cellRenderers. Per-formatter toggles to compare on/off.

<div data-docs-demo="94-conditional-formatting" data-height="460"></div>

### Anomaly highlights

IQR + rare-value detectors paint outliers per cell with severity halos (warning / outlier / extreme). Severity threshold toggle, per-detector tooltip explaining what tripped.

<div data-docs-demo="100-anomaly-highlights" data-height="460"></div>
