# `@svgrid/grid` · `spreadsheet.ts`

Auto-generated. Source: `packages\grid\src\spreadsheet.ts`.

### `type BorderSpec`

A single edge of a cell border. */

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
 Covered cells are hidden so the origin visually fills the region. */

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
 `spansToMerges`. Matches the relevant slice of `ColumnDef`. */

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
): MergeSpec[] {
  const merges: MergeSpec[] = []
  const covered = new Set<string>()
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r]!
    for (let ci = 0; ci < columns.length; ci += 1) {
      const col = columns[ci]!
      if (!col.colSpan && !col.rowSpan) continue
      const key = `${r}:${ci}`
      if (covered.has(key)) continue
      const value = getValue
        ? getValue(row, col.id)
        : (row as Record<string, unknown>)[col.field ?? col.id]
      const params = { data: row, rowIndex: r, columnId: col.id, value }
      const cs = Math.max(1, Math.floor(col.colSpan?.(params) ?? 1))
      const rs = Math.max(1, Math.floor(col.rowSpan?.(params) ?? 1))
      if (cs <= 1 && rs <= 1) continue
      merges.push({
        rowIndex: r,
        columnId: col.id,
        colspan: cs > 1 ? cs : undefined,
        rowspan: rs > 1 ? rs : undefined,
      })
      for (let dr = 0; dr < rs; dr += 1) {
        for (let dc = 0; dc < cs; dc += 1) {
          if (dr === 0 && dc === 0) continue
          covered.add(`${r + dr}:${ci + dc}`)
        }
      }
    }
  }
  return merges
}
```

### `type CellBorderSpec`

Borders for one cell. Edges left unset render as the default
 cell border (i.e. no override). */

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
 `null` / empty arrays to clear. */

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
options change. */

```ts
export function spreadsheetLayout(node: HTMLElement, opts: SpreadsheetActionOptions) {
  let current = opts
  let frame = 0
  const OBSERVE_OPTIONS: MutationObserverInit = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'data-svgrid-row', 'data-col-id', 'style',
      // Watch selection-range attrs so we can transfer them from
      // hidden covered cells to merge origins.
      'data-range-top', 'data-range-bottom', 'data-range-left',
      'data-range-right', 'data-selected-range',
    ],
  }
  // The MutationObserver fires for EVERY DOM change inside the grid -
  // batch them into one rAF so a big virtualization scroll doesn't run
  // apply() dozens of times in a tick.
  function schedule() {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      // Stop observing while apply() mutates the DOM itself (it writes cell
      // `style.display`/`position` and appends overlay children). Otherwise
      // those writes re-trigger this observer and loop at 60fps on merged
      // cells (#50). A full apply() recomputes from the live DOM, so discarding
      // the queued records here loses nothing.
      observer.disconnect()
      apply(node, current)
      observer.observe(node, OBSERVE_OPTIONS)
    })
  }
  const observer = new MutationObserver(schedule)
  observer.observe(node, OBSERVE_OPTIONS)
  // First-paint pass: schedule the same way so we don't run before the
  // grid's initial render landed.
  schedule()
  return {
    update(next: SpreadsheetActionOptions) {
      current = next
      schedule()
    },
    destroy() {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    },
  }
}
```
