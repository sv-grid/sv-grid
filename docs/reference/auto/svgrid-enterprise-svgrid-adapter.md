# `@svgrid/enterprise` · `server/svgrid-adapter.ts`

Auto-generated. Source: `packages\enterprise\src\server\svgrid-adapter.ts`.

### `type CallbackServerRequest`

The request a callback-style datasource receives; the subset the adapter reads.

```ts
export type CallbackServerRequest = {
  startRow?: number
  endRow?: number
  rowGroupCols: Array<{ id: string; displayName?: string; field?: string; aggFunc?: string | null }>
  groupKeys: string[]
  valueCols: Array<{ id: string; displayName?: string; field?: string; aggFunc?: string | null }>
  pivotCols: Array<{ id: string; displayName?: string; field?: string }>
  pivotMode: boolean
  sortModel: Array<{ colId: string; sort: 'asc' | 'desc' }>
  filterModel: Record<string, CallbackColumnFilter> | null
}
```

### `type CallbackColumnFilter`

One column of the callback-style filter model (text, number or set).

```ts
export type CallbackColumnFilter = {
  filterType?: string
  type?: string
  filter?: unknown
  filterTo?: unknown
  values?: string[]
}
```

### `type CallbackGetRowsParams`

What a callback-style datasource's `getRows` receives, and how it answers.

```ts
export type CallbackGetRowsParams<TData = unknown> = {
  request: CallbackServerRequest
  success: (result: { rowData: TData[]; rowCount?: number; pivotResultFields?: string[] }) => void
  fail: () => void
  context?: unknown
  parentNode?: { data?: TData } | null
}
```

### `type CallbackDatasource`

A datasource in the callback shape: `getRows(params)` answering through `params.success` / `params.fail`.

```ts
export type CallbackDatasource<TData = unknown> = {
  getRows(params: CallbackGetRowsParams<TData>): void
  destroy?(): void
}
```

### `function fromCallbackFilterModel`

The callback-style per-column filter model -> `ServerFilterModel`.

```ts
export function fromCallbackFilterModel(model: Record<string, CallbackColumnFilter> | null | undefined): ServerFilterModel
```

### `function toCallbackFilterModel`

`ServerFilterModel` -> the callback-style per-column filter model. The global search has no form there and is dropped.

```ts
export function toCallbackFilterModel(model: ServerFilterModel): Record<string, CallbackColumnFilter>
```

### `function toCallbackRequest`

`ServerRequest` -> the callback-style request shape.

```ts
export function toCallbackRequest(req: ServerRequest): CallbackServerRequest
```

### `function fromCallbackRequest`

The callback-style request shape -> `ServerRequest`.

```ts
export function fromCallbackRequest(req: CallbackServerRequest, extra: Partial<ServerRequest> = {}): ServerRequest
```

### `function adaptCallbackDatasource`

Wrap a callback-style datasource so `createServerRowModel` (or
`createServerDataSource`) can drive it.

```ts
const ctl = createServerRowModel(adaptCallbackDatasource(myDatasource), { groupBy: ['country'] })
```

```ts
export function adaptCallbackDatasource<TData>(ds: CallbackDatasource<TData>): ServerDataSource<TData>
```

### `function toCallbackDatasource`

The other direction: a `ServerDataSource` as a callback-style datasource,
so one backend can serve two grids side by side.

```ts
export function toCallbackDatasource<TData>(source: ServerDataSource<TData>): CallbackDatasource<TData>
```

### `type CallbackSelectionState`

The flat selection rule in the callback-style shape.

```ts
export type CallbackSelectionState = {
  selectAll: boolean
  /** Exceptions to `selectAll`, as row ids. */
  toggledNodes: string[]
}
```

### `type CallbackGroupSelectionState`

One node of the callback-style hierarchical rule. The root carries no
`nodeId`; a child is a group row or a leaf, told apart by whether it has
exceptions of its own (see `SelectionStateMapping.isGroup`).

```ts
export type CallbackGroupSelectionState = {
  nodeId?: string
  selectAllChildren?: boolean
  toggledNodes?: CallbackGroupSelectionState[]
}
```

### `type SelectionStateMapping`

How group rows are named across the two shapes. This model keys a group
by its route segment (`['EMEA', 'DE']` is the DE group under EMEA); the
callback shape keys it by a row node id that the app chose. When the two
are the same string - the default - nothing needs to be passed.

```ts
export type SelectionStateMapping = {
  /** The node id of the group at `route`. Default: the last key of the route. */
  groupId?: (route: string[]) => string
  /** The group key for a node id under `parentRoute`. Default: the id itself. */
  groupKey?: (nodeId: string, parentRoute: string[]) => string
  /**
   * Whether the node `nodeId` under `parentRoute` is a group row. Default:
   * it is when it carries exceptions of its own, a leaf otherwise. A flipped
   * group read as a leaf still selects the same rows; only `selectedCount`
   * is off, since a group exception has no size of its own.
   */
  isGroup?: (nodeId: string, parentRoute: string[]) => boolean
}
```

### `function isCallbackSelectionState`

Whether a selection state is in the callback-style shape (either level).

```ts
export function isCallbackSelectionState(
  state: unknown,
): state is CallbackSelectionState | CallbackGroupSelectionState
```

### `function toCallbackSelectionState`

The selection rule -> the callback-style shape, flat or per group.

```ts
export function toCallbackSelectionState(
  state: ServerSelectionState | ServerGroupSelectionNode,
  mapping: SelectionStateMapping = {},
): CallbackSelectionState | CallbackGroupSelectionState
```

### `function fromCallbackSelectionState`

The callback-style shape -> the selection rule this model keeps.

```ts
export function fromCallbackSelectionState(
  state: CallbackSelectionState | CallbackGroupSelectionState,
  mapping: SelectionStateMapping = {},
): ServerSelectionState | ServerGroupSelectionNode
```
