/**
 * Adapters between the `ServerDataSource` contract and the callback-style
 * datasource shape other server-side row models use: `getRows(params)` with
 * `params.request` describing the block and `params.success` / `params.fail`
 * answering it. A backend written for that shape keeps working behind
 * `createServerRowModel` through `adaptCallbackDatasource`, so a migration is
 * one line; `toCallbackDatasource` goes the other way, for a bench that runs
 * two grids over one backend.
 *
 * The request fields map one for one:
 *
 * | Callback request              | ServerRequest                          |
 * |-------------------------------|----------------------------------------|
 * | `startRow` / `endRow`         | the same                               |
 * | `rowGroupCols[].id`           | `groupBy`                              |
 * | `groupKeys`                   | `groupKeys`                            |
 * | `valueCols[].{id,aggFunc}`    | `aggregations[].{col,fn}`              |
 * | `pivotCols[].id`, `pivotMode` | `pivotBy`, `pivotMode`                 |
 * | `sortModel[].{colId,sort}`    | `sortModel[].{id,desc}`                |
 * | `filterModel[col].{type,filter,filterTo}` | `filterModel.columns[col].{operator,value,valueTo}` |
 *
 * and the answer: `success({ rowData, rowCount, pivotResultFields })` becomes
 * `{ rows, rowCount, pivotResultFields }` (a `rowCount` of `-1` or absent
 * stays unknown), `fail()` rejects.
 *
 * A backend that keeps parsing the callback-style request JSON needs no
 * datasource object at all: `getRows(request)` posts
 * `toCallbackRequest(request)` and reads the answer as usual.
 *
 * The selection rule has a counterpart there too, `{ selectAll,
 * toggledNodes }` flat and `{ nodeId, selectAllChildren, toggledNodes }`
 * per group; `toCallbackSelectionState` / `fromCallbackSelectionState` map
 * it for a saved selection or a bulk endpoint written against that shape.
 */
import type { ServerDataSource, ServerFilterModel, ServerRequest, ServerResult, ServerSortModel } from '@svgrid/grid'
import type { ServerGroupSelectionNode, ServerSelectionState } from './server-selection'

/** The request a callback-style datasource receives; the subset the adapter reads. */
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

/** One column of the callback-style filter model (text, number or set). */
export type CallbackColumnFilter = {
  filterType?: string
  type?: string
  filter?: unknown
  filterTo?: unknown
  values?: string[]
}

/** What a callback-style datasource's `getRows` receives, and how it answers. */
export type CallbackGetRowsParams<TData = unknown> = {
  request: CallbackServerRequest
  success: (result: { rowData: TData[]; rowCount?: number; pivotResultFields?: string[] }) => void
  fail: () => void
  context?: unknown
  parentNode?: { data?: TData } | null
}

/** A datasource in the callback shape: `getRows(params)` answering through `params.success` / `params.fail`. */
export type CallbackDatasource<TData = unknown> = {
  getRows(params: CallbackGetRowsParams<TData>): void
  destroy?(): void
}

const CALLBACK_TO_GRID_OPERATOR: Record<string, string> = {
  contains: 'contains',
  notContains: 'notContains',
  equals: 'equals',
  notEqual: 'notEquals',
  startsWith: 'startsWith',
  endsWith: 'endsWith',
  lessThan: 'lessThan',
  lessThanOrEqual: 'lessThanOrEqual',
  greaterThan: 'greaterThan',
  greaterThanOrEqual: 'greaterThanOrEqual',
  inRange: 'between',
  blank: 'isBlank',
  notBlank: 'isNotBlank',
}
const GRID_TO_CALLBACK_OPERATOR: Record<string, string> = Object.fromEntries(
  Object.entries(CALLBACK_TO_GRID_OPERATOR).map(([theirs, ours]) => [ours, theirs]),
)

const asString = (v: unknown): string => (v == null ? '' : String(v))

/** The callback-style per-column filter model -> `ServerFilterModel`. */
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

/** `ServerFilterModel` -> the callback-style per-column filter model. The global search has no form there and is dropped. */
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

/** `ServerRequest` -> the callback-style request shape. */
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

/** The callback-style request shape -> `ServerRequest`. */
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

/**
 * Wrap a callback-style datasource so `createServerRowModel` (or
 * `createServerDataSource`) can drive it.
 *
 * ```ts
 * const ctl = createServerRowModel(adaptCallbackDatasource(myDatasource), { groupBy: ['country'] })
 * ```
 */
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

/**
 * The other direction: a `ServerDataSource` as a callback-style datasource,
 * so one backend can serve two grids side by side.
 */
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

// ------------------------------------------------------- selection state

/** The flat selection rule in the callback-style shape. */
export type CallbackSelectionState = {
  selectAll: boolean
  /** Exceptions to `selectAll`, as row ids. */
  toggledNodes: string[]
}

/**
 * One node of the callback-style hierarchical rule. The root carries no
 * `nodeId`; a child is a group row or a leaf, told apart by whether it has
 * exceptions of its own (see `SelectionStateMapping.isGroup`).
 */
export type CallbackGroupSelectionState = {
  nodeId?: string
  selectAllChildren?: boolean
  toggledNodes?: CallbackGroupSelectionState[]
}

/**
 * How group rows are named across the two shapes. This model keys a group
 * by its route segment (`['EMEA', 'DE']` is the DE group under EMEA); the
 * callback shape keys it by a row node id that the app chose. When the two
 * are the same string - the default - nothing needs to be passed.
 */
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

/** Whether a selection state is in the callback-style shape (either level). */
export function isCallbackSelectionState(
  state: unknown,
): state is CallbackSelectionState | CallbackGroupSelectionState {
  return typeof state === 'object' && state !== null && 'toggledNodes' in state
}

/** The selection rule -> the callback-style shape, flat or per group. */
export function toCallbackSelectionState(
  state: ServerSelectionState | ServerGroupSelectionNode,
  mapping: SelectionStateMapping = {},
): CallbackSelectionState | CallbackGroupSelectionState {
  if ('selectAll' in state) return { selectAll: !!state.selectAll, toggledNodes: [...(state.toggled ?? [])] }
  const walk = (node: ServerGroupSelectionNode, route: string[]): CallbackGroupSelectionState => {
    const out: CallbackGroupSelectionState = {}
    if (route.length) {
      out.nodeId = node.group ? (mapping.groupId?.(route) ?? route[route.length - 1]!) : route[route.length - 1]!
    }
    out.selectAllChildren = !!node.selectAllChildren
    out.toggledNodes = Object.entries(node.toggled ?? {}).map(([key, child]) => walk(child, [...route, key]))
    return out
  }
  return walk(state, [])
}

/** The callback-style shape -> the selection rule this model keeps. */
export function fromCallbackSelectionState(
  state: CallbackSelectionState | CallbackGroupSelectionState,
  mapping: SelectionStateMapping = {},
): ServerSelectionState | ServerGroupSelectionNode {
  if ('selectAll' in state) {
    const flat = state as CallbackSelectionState
    return { selectAll: !!flat.selectAll, toggled: (flat.toggledNodes ?? []).map(String) }
  }
  const walk = (node: CallbackGroupSelectionState, route: string[]): ServerGroupSelectionNode => {
    const toggled: Record<string, ServerGroupSelectionNode> = {}
    for (const child of node.toggledNodes ?? []) {
      if (child.nodeId == null) continue
      const id = String(child.nodeId)
      const group = mapping.isGroup?.(id, route) ?? (child.toggledNodes?.length ?? 0) > 0
      const key = group ? (mapping.groupKey?.(id, route) ?? id) : id
      const plain = walk(child, [...route, key])
      toggled[key] = group ? { ...plain, group: true } : plain
    }
    return { selectAllChildren: !!node.selectAllChildren, toggled }
  }
  return walk(state, [])
}
