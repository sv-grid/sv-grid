# `@svgrid/grid` · `spreadsheet.ts`

Auto-generated. Source: `packages\grid\src\spreadsheet.ts`.

### `type BorderSpec`

A single edge of a cell border.

```ts
export type BorderSpec = {
  /** Thickness in pixels. Default 2. */
  width?: number
  /** CSS border-style. Default 'solid'. */
  style?: 'solid' | 'dashed' | 'dotted' | 'double'
  /** CSS color. Falls back to currentColor (i.e. text color). */
  color?: string
}
```

### `type MergeSpec`

A merge declaration. The cell at (rowIndex, columnId) is the ORIGIN;
 it spans `colspan` columns to the right + `rowspan` rows downward.
 Covered cells are hidden so the origin visually fills the region.

```ts
export type MergeSpec = {
  /** Display-row index — the same value the grid puts on
   *  `data-svgrid-row`. After sorting/filtering, recompute the spec
   *  against the new display order. */
  rowIndex: number
  columnId: string
  /** Default 1. */
  rowspan?: number
  /** Default 1. */
  colspan?: number
}
```

### `type SpanColumn`

A column with declarative spanning callbacks, as accepted by
 `spansToMerges`. Matches the relevant slice of `ColumnDef`.

```ts
export type SpanColumn<TData = Record<string, unknown>> = {
  id: string
  field?: string
  colSpan?: (params: { data: TData; rowIndex: number; columnId: string; value: unknown }) => number
  rowSpan?: (params: { data: TData; rowIndex: number; columnId: string; value: unknown }) => number
}
```

### `function spansToMerges`

Turn declarative per-column `colSpan` / `rowSpan` callbacks into a
`MergeSpec[]` you can hand to `spreadsheetLayout` - so value-driven,
Declarative spanning runs on the SAME real colspan/rowspan merge engine
instead of a second code path. Recompute after sort/filter (indexes are
display-row indexes). A common pattern is "merge runs of equal values":

  { field: 'region', rowSpan: ({ data, rowIndex }) =>
      rows.filter((r, i) => i >= rowIndex && r.region === data.region &&
        (i === rowIndex || rows[i-1].region === data.region)).length }

```ts
export function spansToMerges<TData = Record<string, unknown>>(
  rows: ReadonlyArray<TData>,
  columns: ReadonlyArray<SpanColumn<TData>>,
  getValue?: (row: TData, columnId: string) => unknown,
): MergeSpec[]
```

### `type CellBorderSpec`

Borders for one cell. Edges left unset render as the default
 cell border (i.e. no override).

```ts
export type CellBorderSpec = {
  rowIndex: number
  columnId: string
  top?: BorderSpec
  right?: BorderSpec
  bottom?: BorderSpec
  left?: BorderSpec
}
```

### `type SpreadsheetActionOptions`

What the Svelte action receives. Pass new values to update; pass
 `null` / empty arrays to clear.

```ts
export type SpreadsheetActionOptions = {
  merges?: ReadonlyArray<MergeSpec> | null
  borders?: ReadonlyArray<CellBorderSpec> | null
  /** Column id order the grid uses, in left-to-right order. Required
   *  to translate `colspan` into the right set of covered column ids.
   *  Pass `columns.map((c) => c.id)` from the consumer. */
  columnOrder: ReadonlyArray<string>
}
```

### `function spreadsheetLayout`

Svelte action. Attach to the element that hosts your `<SvGrid>` so
 the action can watch its DOM for re-renders.

```svelte
<div use:spreadsheetLayout={{ merges, borders, columnOrder }}>
  <SvGrid {data} {columns} ... />
</div>
```

The action re-applies the layout whenever the grid's body mutates
(new rows, column reorder, virtualization scroll) and whenever the
options change.

```ts
export function spreadsheetLayout(node: HTMLElement, opts: SpreadsheetActionOptions)
```
