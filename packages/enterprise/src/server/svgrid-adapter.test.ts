import { describe, expect, it } from 'vitest'
import type { ServerRequest } from '@svgrid/grid'
import {
  adaptCallbackDatasource,
  fromCallbackFilterModel,
  fromCallbackRequest,
  fromCallbackSelectionState,
  isCallbackSelectionState,
  toCallbackDatasource,
  toCallbackRequest,
  toCallbackSelectionState,
  type CallbackGetRowsParams,
} from './svgrid-adapter'
import { createServerSelectionModel } from './server-selection'

const req = (over: Partial<ServerRequest> = {}): ServerRequest => ({
  startRow: 200,
  endRow: 300,
  pageIndex: 2,
  pageSize: 100,
  sortModel: [{ id: 'amount', desc: true }],
  filterModel: { columns: { region: { operator: 'equals', value: 'EMEA' } }, global: 'ada' },
  groupBy: ['region', 'country'],
  groupKeys: ['EMEA'],
  aggregations: [{ col: 'amount', fn: 'sum' }],
  pivotBy: ['year'],
  pivotMode: true,
  ...over,
})

describe('request mapping', () => {
  it('maps a ServerRequest onto the other shape and back', () => {
    const ag = toCallbackRequest(req())
    expect(ag).toEqual({
      startRow: 200,
      endRow: 300,
      rowGroupCols: [
        { id: 'region', field: 'region', displayName: 'region' },
        { id: 'country', field: 'country', displayName: 'country' },
      ],
      groupKeys: ['EMEA'],
      valueCols: [{ id: 'amount', field: 'amount', displayName: 'amount', aggFunc: 'sum' }],
      pivotCols: [{ id: 'year', field: 'year', displayName: 'year' }],
      pivotMode: true,
      sortModel: [{ colId: 'amount', sort: 'desc' }],
      filterModel: { region: { filterType: 'text', type: 'equals', filter: 'EMEA' } },
    })
    const back = fromCallbackRequest(ag)
    expect(back).toMatchObject({
      startRow: 200,
      endRow: 300,
      pageIndex: 2,
      pageSize: 100,
      sortModel: [{ id: 'amount', desc: true }],
      groupBy: ['region', 'country'],
      groupKeys: ['EMEA'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      pivotBy: ['year'],
      pivotMode: true,
    })
    // The global search has no counterpart there, so it does not survive.
    expect(back.filterModel).toEqual({ columns: { region: { operator: 'equals', value: 'EMEA' } } })
  })

  it('leaves grouping, aggregation and pivot out of a flat request', () => {
    const back = fromCallbackRequest(
      toCallbackRequest(req({ groupBy: undefined, groupKeys: undefined, aggregations: undefined, pivotBy: undefined, pivotMode: undefined })),
    )
    expect(back.groupBy).toBeUndefined()
    expect(back.aggregations).toBeUndefined()
    expect(back.pivotBy).toBeUndefined()
    expect(back.pivotMode).toBeUndefined()
  })

  it('translates the filter operators both ways, ranges and sets included', () => {
    const grid = fromCallbackFilterModel({
      amount: { filterType: 'number', type: 'inRange', filter: 10, filterTo: 20 },
      name: { filterType: 'text', type: 'notEqual', filter: 'x' },
      region: { filterType: 'set', values: ['EMEA', 'APAC'] },
      note: { filterType: 'text', type: 'blank' },
    })
    expect(grid.columns).toEqual({
      amount: { operator: 'between', value: '10', valueTo: '20' },
      name: { operator: 'notEquals', value: 'x' },
      region: { operator: 'in', value: '', selectedValues: ['EMEA', 'APAC'] },
      note: { operator: 'isBlank', value: '' },
    })
    const ag = toCallbackRequest(req({ filterModel: grid })).filterModel!
    expect(ag.amount).toEqual({ filterType: 'text', type: 'inRange', filter: '10', filterTo: '20' })
    expect(ag.region).toEqual({ filterType: 'set', values: ['EMEA', 'APAC'] })
    expect(ag.note).toEqual({ filterType: 'text', type: 'blank', filter: '' })
  })
})

describe('adaptCallbackDatasource', () => {
  it('turns success into a result and fail into a rejection', async () => {
    const seen: CallbackGetRowsParams['request'][] = []
    const source = adaptCallbackDatasource<{ id: number }>({
      getRows(params) {
        seen.push(params.request)
        if (params.request.groupKeys[0] === 'boom') params.fail()
        else params.success({ rowData: [{ id: 1 }], rowCount: -1, pivotResultFields: ['2024_amount'] })
      },
    })
    const res = await source.getRows(req())
    expect(res).toEqual({ rows: [{ id: 1 }], rowCount: -1, pivotResultFields: ['2024_amount'] })
    expect(seen[0]!.groupKeys).toEqual(['EMEA'])
    await expect(source.getRows(req({ groupKeys: ['boom'] }))).rejects.toThrow('failed load')
  })

  it('hands the context and the parent row through', async () => {
    let got: CallbackGetRowsParams<{ id: number }> | null = null
    const source = adaptCallbackDatasource<{ id: number }>({
      getRows(params) {
        got = params
        params.success({ rowData: [], rowCount: 0 })
      },
    })
    await source.getRows(req({ context: { tenant: 't1' }, parentRow: { id: 7 } }))
    expect(got!.context).toEqual({ tenant: 't1' })
    expect(got!.parentNode).toEqual({ data: { id: 7 } })
  })
})

describe('toCallbackDatasource', () => {
  it('answers through success, with an unknown count left undefined', async () => {
    const ds = toCallbackDatasource<{ id: number }>({
      async getRows(r) {
        return { rows: [{ id: r.startRow }], rowCount: -1, pivotResultFields: ['f'] }
      },
    })
    const answer = await new Promise<unknown>((resolve, reject) => {
      ds.getRows({ request: toCallbackRequest(req()), success: resolve, fail: () => reject(new Error('fail')) })
    })
    expect(answer).toEqual({ rowData: [{ id: 200 }], rowCount: undefined, pivotResultFields: ['f'] })
  })

  it('answers a rejection through fail', async () => {
    const ds = toCallbackDatasource<{ id: number }>({
      async getRows() {
        throw new Error('down')
      },
    })
    const failed = await new Promise<boolean>((resolve) => {
      ds.getRows({ request: toCallbackRequest(req()), success: () => resolve(false), fail: () => resolve(true) })
    })
    expect(failed).toBe(true)
  })
})

describe('selection state mapping', () => {
  it('maps the flat rule both ways', () => {
    const theirs = toCallbackSelectionState({ selectAll: true, toggled: ['s2', 's7'] })
    expect(theirs).toEqual({ selectAll: true, toggledNodes: ['s2', 's7'] })
    expect(fromCallbackSelectionState(theirs)).toEqual({ selectAll: true, toggled: ['s2', 's7'] })
    expect(isCallbackSelectionState(theirs)).toBe(true)
    expect(isCallbackSelectionState({ selectAll: true, toggled: [] })).toBe(false)
  })

  it('maps the group rule both ways, keeping which exceptions are groups', () => {
    // Everything, except EMEA, except DE within it, except one row in DE.
    const ours = {
      selectAllChildren: true,
      toggled: {
        EMEA: {
          selectAllChildren: false,
          group: true,
          toggled: { DE: { selectAllChildren: true, group: true, toggled: { s3: { selectAllChildren: false, toggled: {} } } } },
        },
      },
    }
    const theirs = toCallbackSelectionState(ours)
    expect(theirs).toEqual({
      selectAllChildren: true,
      toggledNodes: [
        {
          nodeId: 'EMEA',
          selectAllChildren: false,
          toggledNodes: [{ nodeId: 'DE', selectAllChildren: true, toggledNodes: [{ nodeId: 's3', selectAllChildren: false, toggledNodes: [] }] }],
        },
      ],
    })
    expect(fromCallbackSelectionState(theirs)).toEqual(ours)

    // The restored rule answers the same questions the original did.
    const model = createServerSelectionModel({ groupSelects: 'descendants' })
    model.setState(fromCallbackSelectionState(theirs))
    expect(model.isSelected(['APAC'], 's9')).toBe(true)
    expect(model.isSelected(['EMEA', 'FR'], 's5')).toBe(false)
    expect(model.isSelected(['EMEA', 'DE'], 's2')).toBe(true)
    expect(model.isSelected(['EMEA', 'DE'], 's3')).toBe(false)
  })

  it('takes a mapping when group ids and group keys differ', () => {
    const ours = {
      selectAllChildren: false,
      toggled: { EMEA: { selectAllChildren: true, group: true, toggled: {} } },
    }
    const mapping = {
      groupId: (route: string[]) => 'row-group-' + route.join('-'),
      groupKey: (id: string) => id.replace(/^row-group-(.*-)?/, ''),
      isGroup: (id: string) => id.startsWith('row-group-'),
    }
    const theirs = toCallbackSelectionState(ours, mapping)
    expect(theirs).toEqual({ selectAllChildren: false, toggledNodes: [{ nodeId: 'row-group-EMEA', selectAllChildren: true, toggledNodes: [] }] })
    // Without exceptions of its own the node would read as a leaf; the mapping says group.
    expect(fromCallbackSelectionState(theirs, mapping)).toEqual(ours)
  })
})
