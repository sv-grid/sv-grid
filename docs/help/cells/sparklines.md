# Sparklines

A sparkline is a tiny, word-sized chart drawn inside a single cell. SvGrid
renders them as a first-class column type: set `sparkline` on a column whose
value is an array of numbers and the grid paints an inline SVG. No chart
library, no custom cell snippet.

<div data-docs-demo="140-sparkline-cells" data-height="480"></div>

The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid } from '@svgrid/grid'

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
</script>
```

```svelte
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Row = { product: string; revenue: number[] }

  const columns: GridColumns<Row> = [
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

See the live [Sparkline cells](https://svgrid.com/demos/140-sparkline-cells/)
demo.

## A sparkline column

`sparkline` is a column prop, not a component you place. The cell's value has
to be the array of numbers - the column renders it, so the row stays plain data.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
    joined: string
    active: boolean
    trend: number[]
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000, joined: '2021-03-01', active: true,  trend: [4, 6, 5, 9, 12, 11, 15] },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000, joined: '2019-07-15', active: true,  trend: [9, 8, 11, 10, 14, 16, 15] },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000, joined: '2020-01-20', active: false, trend: [12, 10, 9, 7, 6, 6, 4] },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000, joined: '2022-09-05', active: true,  trend: [3, 5, 4, 8, 7, 11, 13] },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',  header: 'Name',      width: 190 },
    { field: 'trend', header: 'Last 7 wks', width: 160, sparkline: { type: 'line' } },
    { field: 'salary', header: 'Salary',   width: 140,
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<SvGrid data={people} {columns} rowHeight={36} />
```


## Bars and win/loss

`bar` reads as discrete periods and `winloss` throws the magnitude away to show
only direction. A custom `cell` renderer wins over `sparkline` if you set both,
so pick one per column.

```svelte {runnable}
<script lang="ts">
  import { SvGrid, type GridColumns, type SvGridApi } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
    joined: string
    active: boolean
    trend: number[]
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000, joined: '2021-03-01', active: true,  trend: [4, 6, 5, 9, 12, 11, 15] },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000, joined: '2019-07-15', active: true,  trend: [9, 8, 11, 10, 14, 16, 15] },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000, joined: '2020-01-20', active: false, trend: [12, 10, 9, 7, 6, 6, 4] },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000, joined: '2022-09-05', active: true,  trend: [3, 5, 4, 8, 7, 11, 13] },
  ]

  const columns: GridColumns<Person> = [
    { field: 'name',  header: 'Name', width: 170 },
    { field: 'trend', header: 'Bars', width: 150, sparkline: { type: 'bar' } },
    { field: 'trend', id: 'wl', header: 'Direction', width: 150, sparkline: { type: 'winloss' } },
  ]
</script>

<SvGrid data={people} {columns} rowHeight={36} />
```
