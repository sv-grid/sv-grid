# `sv-grid-core` · `svgrid-wrapper.types.ts`

Auto-generated. Source: `packages\sv-grid-core\src\svgrid-wrapper.types.ts`.

### `type SvGridFilterOperator`

_No JSDoc yet._

```ts
export type SvGridFilterOperator =
```

### `type SvGridViewState`

A serializable snapshot of everything that makes up the current "view":
sort, grouping, pagination, column layout (width / pinning / order /
visibility), and all filter surfaces. Round-trippable through
`api.getState()` / `api.setState()` - persist it to a URL, localStorage, or
a server to implement "save view" / "named views".

```ts
export type SvGridViewState = {
  sorting: Array<{ id: string; desc: boolean }>
  grouping: string[]
  pagination: { pageIndex: number; pageSize: number }
  columnWidths: Record<string, number>
  columnPinning: { left: string[]; right: string[] }
  columnOrder: string[]
  /** Ids of columns currently hidden via setColumnVisible. */
  hiddenColumns: string[]
  globalFilter: string
  columnFilters: Record<
    string,
    { operator: SvGridFilterOperator; value: string; valueTo?: string }
  >
  /** Facet (Excel-style value checklist) selections, keyed by column id. */
  facetFilters: Record<string, string[]>
}
```

### `type SvGridTransaction`

A batch of row mutations for `api.applyTransaction`. `update` / `remove`
(by id) match on `getRowId`; `remove` also accepts row object references.

```ts
export type SvGridTransaction<TData> = {
  add?: ReadonlyArray<TData>
  update?: ReadonlyArray<TData>
  remove?: ReadonlyArray<TData | string>
}
```

### `type SvGridTransactionResult`

_No JSDoc yet._

```ts
export type SvGridTransactionResult = {
  added: number
  updated: number
  removed: number
}
```

### `type SvGridApi`

Imperative API exposed via the `<SvGrid onApiReady>` callback. Use it for
data, column, filter, sort, group, and visibility operations from outside
the component.

```ts
export type SvGridApi<
```

### `type SvGridWrapperProps`

_No JSDoc yet._

```ts
export type SvGridWrapperProps<
```
