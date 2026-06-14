# Sparklines

A sparkline is a tiny, word-sized chart drawn inside a single cell. SvGrid
renders them as a first-class column type: set `sparkline` on a column whose
value is an array of numbers and the grid paints an inline SVG. No chart
library, no custom cell snippet.

```svelte
<script lang="ts">
  import { SvGrid, type ColumnDef } from 'sv-grid-community'

  type Row = { product: string; revenue: number[] }

  const columns: ColumnDef<{}, Row>[] = [
    { field: 'product', header: 'Product' },
    { field: 'revenue', header: 'Trend', sparkline: { type: 'line' } },
  ]
</script>

<SvGrid {data} {columns} />
```

## Value shape

The cell value is an array of numbers. A comma- or space-separated string
works too (`"1, 2, 3"`), so server payloads that send a CSV string render
without massaging. Non-finite entries are dropped; an empty array renders
nothing.

## Chart types

| `type`      | Looks like                                   |
| ----------- | -------------------------------------------- |
| `'line'`    | A single polyline with an end-point dot (default) |
| `'area'`    | A line plus a translucent fill to the baseline |
| `'bar'`     | One column per value, scaled to the row's min..max |
| `'winloss'` | Fixed-height up/down bars - sign only (W/L streaks) |

## Options (`SparklineConfig`)

| Option          | Default                  | Notes                                              |
| --------------- | ------------------------ | -------------------------------------------------- |
| `type`          | `'line'`                 | One of the four above.                             |
| `color`         | `var(--sg-accent)`       | Stroke (line/area) or positive fill (bar/winloss). |
| `negativeColor` | `#ef4444`                | Fill for negative bars / losses.                   |
| `width`         | `88`                     | SVG width in px.                                   |
| `height`        | `22`                     | SVG height in px.                                  |
| `min` / `max`   | derived from the row     | Fix the value scale so rows are comparable.        |
| `lineWidth`     | `1.5`                    | Stroke width (line/area).                          |
| `lastPoint`     | `true`                   | Draw the end-cap dot on line/area.                 |

```ts
// Green/red diverging bars on a column that can go negative:
{ field: 'delta', sparkline: { type: 'bar', color: '#16a34a', negativeColor: '#ef4444' } }

// Comparable rows: pin every sparkline to the same 0..100 scale:
{ field: 'score', sparkline: { type: 'area', min: 0, max: 100 } }
```

## Notes

- A custom `cell` renderer wins if both `cell` and `sparkline` are set.
- Sparklines are decorative SVG with an `aria-label` summarising the series
  (point count + last value). For a screen-reader-friendly exact readout,
  pair the chart column with a plain numeric column.
- The geometry helper is exported as `buildSparkline(values, config)` if you
  want to render the same chart outside a grid cell.

See the live [Sparkline cells](https://sv-grid.com/demos/140-sparkline-cells)
demo.
