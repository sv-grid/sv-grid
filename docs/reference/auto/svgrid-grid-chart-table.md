# `@svgrid/grid` · `chart-table.ts`

Auto-generated. Source: `packages\grid\src\chart-table.ts`.

### `type ChartTableColumn`

One column of a chart's table: what `SvGrid` needs to draw it.

```ts
export type ChartTableColumn = {
  field: string
  header: string
  cellDataType?: 'number' | 'text' | 'date'
  format?: CellFormatConfig
  width?: number
}
```

### `type ChartTable`

A chart's data as a table: grid columns and plain row objects.

```ts
export type ChartTable = {
  columns: ChartTableColumn[]
  rows: Array<Record<string, unknown>>
}
```

### `function chartSpecToTable`

The rows and columns a chart spec amounts to. Never throws: a spec with
nothing to tabulate comes back with no rows and no columns.

```ts
export function chartSpecToTable(spec: ChartSpec): ChartTable
```
