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
export function fromCallbackFilterModel(model: Record<string, CallbackColumnFilter> | null | undefined): ServerFilterModel {
  const columns: NonNullable<ServerFilterModel['columns']> = {}
  for (const [id, f] of Object.entries(model ?? {})) {
    if (!f) continue
    if (f.filterType === 'set' && Array.isArray(f.values)) {
      columns[id] = { operator: 'in', value: '', selectedValues: f.values.map(asString) }
      continue
    }
    const operator = CALLBACK_TO_GRID_OPERATOR[f.type ?? ''] ?? f.type ?? 'equals'
    columns[id] = {
      operator,
      value: asString(f.filter),
      ...(f.filterTo != null ? { valueTo: asString(f.filterTo) } : {}),
    }
  }
  return Object.keys(columns).length ? { columns } : {}
}
```

### `function toCallbackFilterModel`

`ServerFilterModel` -> the callback-style per-column filter model. The global search has no form there and is dropped.

```ts
export function toCallbackFilterModel(model: ServerFilterModel): Record<string, CallbackColumnFilter> {
  const out: Record<string, CallbackColumnFilter> = {}
  for (const [id, f] of Object.entries(model.columns ?? {})) {
    if (f.selectedValues) {
      out[id] = { filterType: 'set', values: f.selectedValues }
      continue
    }
    out[id] = {
      filterType: 'text',
      type: GRID_TO_CALLBACK_OPERATOR[f.operator] ?? f.operator,
      filter: f.value,
      ...(f.valueTo != null ? { filterTo: f.valueTo } : {}),
    }
  }
  return out
}
```

### `function toCallbackRequest`

`ServerRequest` -> the callback-style request shape.

```ts
export function toCallbackRequest(req: ServerRequest): CallbackServerRequest {
  return {
    startRow: req.startRow,
    endRow: req.endRow,
    rowGroupCols: (req.groupBy ?? []).map((id) => ({ id, field: id, displayName: id })),
    groupKeys: [...(req.groupKeys ?? [])],
    valueCols: (req.aggregations ?? []).map((a) => ({ id: a.col, field: a.col, displayName: a.col, aggFunc: a.fn })),
    pivotCols: (req.pivotBy ?? []).map((id) => ({ id, field: id, displayName: id })),
    pivotMode: !!req.pivotMode,
    sortModel: req.sortModel.map((s) => ({ colId: s.id, sort: s.desc ? 'desc' : 'asc' })),
    filterModel: toCallbackFilterModel(req.filterModel),
  }
}
```

### `function fromCallbackRequest`

The callback-style request shape -> `ServerRequest`.

```ts
export function fromCallbackRequest(req: CallbackServerRequest, extra: Partial<ServerRequest> = {}): ServerRequest {
  const startRow = req.startRow ?? 0
  const endRow = req.endRow ?? startRow + 100
  const pageSize = Math.max(1, endRow - startRow)
  const sortModel: ServerSortModel = req.sortModel.map((s) => ({ id: s.colId, desc: s.sort === 'desc' }))
  const out: ServerRequest = {
    startRow,
    endRow,
    pageIndex: Math.floor(startRow / pageSize),
    pageSize,
    sortModel,
    filterModel: fromCallbackFilterModel(req.filterModel),
    ...extra,
  }
  if (req.rowGroupCols.length) {
    out.groupBy = req.rowGroupCols.map((c) => c.id)
    out.groupKeys = [...req.groupKeys]
  }
  if (req.valueCols.length) {
    out.aggregations = req.valueCols.map((c) => ({
      col: c.id,
      fn: (c.aggFunc ?? 'sum') as 'sum' | 'avg' | 'min' | 'max' | 'count',
    }))
  }
  if (req.pivotMode && req.pivotCols.length) {
    out.pivotBy = req.pivotCols.map((c) => c.id)
    out.pivotMode = true
  }
  return out
}
```

### `function adaptCallbackDatasource`

Wrap a callback-style datasource so `createServerRowModel` (or
`createServerDataSource`) can drive it.

```ts
const ctl = createServerRowModel(adaptCallbackDatasource(myDatasource), { groupBy: ['country'] })
```

```ts
export function adaptCallbackDatasource<TData>(ds: CallbackDatasource<TData>): ServerDataSource<TData> {
  return {
    getRows(req) {
      return new Promise<ServerResult<TData>>((resolve, reject) => {
        let settled = false
        ds.getRows({
          request: toCallbackRequest(req),
          context: req.context,
          parentNode: req.parentRow === undefined ? null : { data: req.parentRow as TData },
          success: ({ rowData, rowCount, pivotResultFields }) => {
            if (settled) return
            settled = true
            const result: ServerResult<TData> = {
              rows: rowData,
              rowCount: rowCount == null || rowCount < 0 ? -1 : rowCount,
            }
            if (pivotResultFields) result.pivotResultFields = pivotResultFields
            resolve(result)
          },
          fail: () => {
            if (settled) return
            settled = true
            reject(new Error('The datasource reported a failed load'))
          },
        })
      })
    },
    ...(ds.destroy ? { destroy: () => ds.destroy!() } : {}),
  }
}
```

### `function toCallbackDatasource`

The other direction: a `ServerDataSource` as a callback-style datasource,
so one backend can serve two grids side by side.

```ts
export function toCallbackDatasource<TData>(source: ServerDataSource<TData>): CallbackDatasource<TData> {
  return {
    getRows(params) {
      const extra: Partial<ServerRequest> = {}
      if (params.context !== undefined) extra.context = params.context
      if (params.parentNode?.data !== undefined) extra.parentRow = params.parentNode.data as never
      source.getRows(fromCallbackRequest(params.request, extra)).then(
        (res) => {
          params.success({
            rowData: [...res.rows],
            rowCount: res.rowCount < 0 ? undefined : res.rowCount,
            ...(res.pivotResultFields ? { pivotResultFields: res.pivotResultFields } : {}),
          })
        },
        () => params.fail(),
      )
    },
    ...(source.destroy ? { destroy: () => source.destroy!() } : {}),
  }
}
```
