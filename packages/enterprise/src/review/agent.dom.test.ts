import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGridTools, registerWebMcpTools, type GridTool } from './agent'
import { createReview, type ReviewGridApi } from './model.svelte'

type Row = { id: string; name: string; region: string; amount: number }

function setup(fields?: string[]) {
  let data: Row[] = [
    { id: 'a', name: 'Acme', region: '', amount: 100 },
    { id: 'b', name: 'Globex', region: 'EMEA', amount: 250 },
    { id: 'c', name: 'Initech', region: '', amount: 40 },
  ]
  const api = {
    getData: () => data,
    getOption: (k: string) => (k === 'getRowId' ? (r: Row) => r.id : undefined),
    getColumns: () => [
      { id: 'name', field: 'name', header: 'Name', visible: true },
      { id: 'region', field: 'region', header: 'Region', visible: true },
      { id: 'amount', field: 'amount', header: 'Amount', visible: true, cellDataType: 'number' as const },
    ],
    getActiveCell: () => null,
    getRowId: () => null,
    getCommandContext: () => ({ recordUndo() {} }),
    stopEditing: () => false,
    scrollToRow() {},
    getDisplayedRows: () => data,
  } as unknown as ReviewGridApi
  const review = createReview<Row>({ api, setRows: (next) => (data = next) })
  const tools = createGridTools({ review, api: () => api, fields, source: { kind: 'agent', id: 'bot', label: 'Bot' } })
  const tool = (name: string) => tools.find((t) => t.name === name) as GridTool
  return { review, tools, tool, rows: () => data }
}

describe('createGridTools', () => {
  it('describes the table and marks the writable fields', async () => {
    const { tool } = setup(['region'])
    const out = (await tool('grid_describe').execute({})) as any
    expect(out.rowCount).toBe(3)
    expect(out.columns).toEqual([
      { field: 'name', header: 'Name', type: 'text', writable: false },
      { field: 'region', header: 'Region', type: 'text', writable: true },
      { field: 'amount', header: 'Amount', type: 'number', writable: false },
    ])
  })

  it('queries with where, fields and paging, always returning rowId', async () => {
    const { tool } = setup()
    const out = (await tool('grid_query_rows').execute({ where: [{ field: 'region', op: 'blank' }], fields: ['name'] })) as any
    expect(out).toEqual({ total: 2, offset: 0, rows: [{ rowId: 'a', name: 'Acme' }, { rowId: 'c', name: 'Initech' }] })
    const big = (await tool('grid_query_rows').execute({ where: [{ field: 'amount', op: 'gt', value: 50 }], limit: 1, offset: 1 })) as any
    expect(big.total).toBe(2)
    expect(big.rows.map((r: any) => r.rowId)).toEqual(['b'])
    await expect(tool('grid_query_rows').execute({ where: [{ field: 'nope', op: 'blank' }] })).rejects.toThrow(/unknown field/)
  })

  it('proposes edits into the review, never into the data, and reports what it skipped', async () => {
    const { tool, review, rows } = setup(['region'])
    const out = (await tool('grid_propose_edits').execute({
      title: 'Fill regions',
      edits: [
        { rowId: 'a', field: 'region', value: 'AMER', reason: 'US company', confidence: 0.9 },
        { rowId: 'c', field: 'region', value: 'AMER', confidence: 7 },
        { rowId: 'zz', field: 'region', value: 'X' },
        { rowId: 'a', field: 'name', value: 'Acme Inc' },
        { rowId: 'b', field: 'region', value: 'EMEA' },
      ],
    })) as any
    expect(out.proposed).toBe(2)
    expect(out.skipped.map((s: any) => s.index)).toEqual([2, 3, 4])
    expect(rows()[0]!.region).toBe('')
    const pending = review.pending()
    expect(pending.map((p) => [p.rowId, p.after, p.confidence])).toEqual([['a', 'AMER', 0.9], ['c', 'AMER', 1]])
    expect(pending[0]!.source.label).toBe('Bot')
  })

  it('reports back what the person decided', async () => {
    const { tool, review } = setup(['region'])
    await tool('grid_propose_edits').execute({ edits: [{ rowId: 'a', field: 'region', value: 'AMER' }, { rowId: 'c', field: 'region', value: 'APAC' }] })
    const [first, second] = review.pending()
    await review.accept([first!.id])
    review.reject([second!.id])
    expect(await tool('grid_review_status').execute({})).toMatchObject({ pending: 0, accepted: 1, rejected: 1, stale: 0 })
  })
})

describe('registerWebMcpTools', () => {
  afterEach(() => {
    delete (document as any).modelContext
  })

  it('does nothing where WebMCP is missing', () => {
    expect(registerWebMcpTools([]).supported).toBe(false)
  })

  it('registers each tool with an abort signal and wraps results as text content', async () => {
    const registered: Array<{ tool: any; signal: AbortSignal }> = []
    ;(document as any).modelContext = { registerTool: vi.fn((tool, o) => registered.push({ tool, signal: o.signal })) }
    const { tools } = setup()
    const handle = registerWebMcpTools(tools)
    expect(handle.supported).toBe(true)
    expect(registered.map((r) => r.tool.name)).toEqual(['grid_describe', 'grid_query_rows', 'grid_propose_edits', 'grid_review_status'])
    const result = await registered[0]!.tool.execute({})
    expect(result.content[0].type).toBe('text')
    expect(JSON.parse(result.content[0].text).rowCount).toBe(3)
    handle.unregister()
    expect(registered.every((r) => r.signal.aborted)).toBe(true)
  })
})

it('query_rows clamps a negative or string offset instead of slicing from the end', async () => {
  const { tool } = setup()
  const out = (await tool('grid_query_rows').execute({ offset: -2, limit: '1' as unknown as number })) as any
  expect(out.offset).toBe(0)
  expect(out.rows.map((r: any) => r.rowId)).toEqual(['a'])
})
