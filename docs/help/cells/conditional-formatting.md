# Conditional formatting

Conditional formatting colors a cell by its value. SvGrid ships it as a
declarative engine prop, `conditionalFormats`, so you describe the rules once
and the grid paints every cell - no per-cell `cell` snippet required.

<div data-docs-demo="141-conditional-formatting" data-height="480"></div>

It goes beyond the `cellClass(ctx)` callback (which only toggles static CSS
classes): color scales and data bars need a value computed against the
column's min/max range, which the engine does for you.

```svelte
<script lang="ts">
  import { SvGrid, type ColumnDef, type ConditionalFormat } from '@svgrid/grid'

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

### `dataBar` - in-cell bar

An in-cell horizontal bar proportional to the value. Diverging data (can go
negative) gets `negativeColor`. `showValue: false` hides the text and shows the
bar alone.

```ts
{ type: 'dataBar', columns: ['revenue'], color: '#3b82f6', negativeColor: '#ef4444' }
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

## Notes

- The color-scale fill and data bar render as layers behind the text, so they
  survive app stylesheets that force the cell background.
- The resolver is exported as `resolveCellFormat(value, row, columnId, formats,
  stat)` if you want to compute the same result yourself.

See the live [Conditional formatting](https://sv-grid.com/demos/141-conditional-formatting)
demo.
