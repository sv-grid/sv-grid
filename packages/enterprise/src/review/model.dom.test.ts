import { describe, expect, it, vi } from 'vitest'
import { createReview, type ReviewGridApi } from './model.svelte'
import type { Proposal, ProposalSource } from './types'

type Row = { id: string; name: string; region: string; amount: number; done?: boolean }
const AGENT: ProposalSource = { kind: 'agent', id: 'agent', label: 'Agent' }
const IMPORT: ProposalSource = { kind: 'import', id: 'import', label: 'Import' }

/**
 * A stand-in for the grid. `grid` is the grid's own copy (what api.getData
 * returns, including its own writes such as a paste); `app` is the app's
 * array. They are the same until the grid writes on its own.
 */
function setup(opts: { fullRowEditing?: boolean; visible?: (r: Row) => boolean; onCommit?: any; server?: any; pageSize?: number } = {}) {
  const rows: Row[] = [
    { id: 'a', name: 'Acme ', region: '', amount: 100 },
    { id: 'b', name: 'Globex', region: 'EMEA', amount: 200 },
    { id: 'c', name: 'Initech', region: '', amount: 300 },
  ]
  const state = { app: rows, grid: rows, page: 0, active: null as null | { rowIndex: number; colIndex: number; columnId: string } }
  const undo: Array<{ u: () => void; r: () => void }> = []
  const displayed = () => state.grid.filter(opts.visible ?? (() => true))
  const api = {
    getData: () => state.grid,
    getOption: (k: string) => (k === 'getRowId' ? (r: Row) => r.id : k === 'fullRowEditing' ? !!opts.fullRowEditing : k === 'pageable' ? !!opts.pageSize : undefined),
    getActiveCell: () => state.active,
    getRowId: (i: number | Row) => (typeof i === 'number' ? displayed()[i]?.id ?? null : i.id),
    getColumns: () => [
      { id: 'name', field: 'name', header: 'Name', visible: true },
      { id: 'region', field: 'region', header: 'Region', visible: true },
      { id: 'amount', field: 'amount', header: 'Amount', visible: true },
    ],
    getCommandContext: () => ({ recordUndo: (u: () => void, r: () => void) => undo.push({ u, r }) }),
    stopEditing: vi.fn(() => false),
    scrollToRow: vi.fn(),
    getDisplayedRows: () => displayed(),
    getState: () => ({ grouping: [] }),
    getRowPosition: (id: string) => {
      const i = displayed().findIndex((r) => r.id === id)
      return i < 0 ? null : i
    },
    getPageInfo: () => ({ pageIndex: state.page, pageSize: opts.pageSize ?? 100, pageCount: 1, total: 3 }),
    setPage: vi.fn((p: number) => (state.page = p)),
  } as unknown as ReviewGridApi
  const setRows = vi.fn((next: Row[]) => {
    state.app = next
    state.grid = next
  })
  const review = createReview<Row>({
    api: () => api,
    setRows: opts.server ? undefined : setRows,
    server: opts.server,
    onCommit: opts.onCommit,
    user: 'dana',
  })
  /** The grid writes on its own (a paste): its copy changes, the app's does not. */
  const gridWrite = (rowId: string, field: keyof Row, value: unknown) => {
    state.grid = state.grid.map((r) => (r.id === rowId ? { ...r, [field]: value } : r))
  }
  const cell = (rowId: string, field: keyof Row) => state.grid.find((r) => r.id === rowId)![field]
  return { review, api, state, undo, setRows, gridWrite, cell }
}

const props = (...xs: Array<[string, keyof Row, unknown, unknown]>) =>
  xs.map(([rowId, field, before, after]) => ({ rowId, field, before, after }))

describe('adding', () => {
  it('skips no-ops; a newer proposal from the same source replaces the older and keeps its before', () => {
    const { review } = setup()
    review.add({ source: AGENT, proposals: props(['a', 'name', 'Acme ', 'Acme '], ['a', 'region', '', 'EU']) })
    review.add({ source: AGENT, proposals: props(['a', 'region', 'EU', 'EMEA']) })
    const pending = review.pending()
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({ field: 'region', before: '', after: 'EMEA' })
  })

  it('two sources on one cell are a conflict; resolving keeps one and rejects the rest', () => {
    const { review } = setup()
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA']) })
    review.add({ source: IMPORT, proposals: props(['a', 'region', '', 'AMER']) })
    expect(review.pending()).toHaveLength(0)
    const [first, second] = review.conflicts() as [Proposal, Proposal]
    expect(review.groups()).toHaveLength(0)
    review.resolveConflict(second.id)
    expect(review.get(second.id)!.status).toBe('pending')
    expect(review.get(first.id)!.status).toBe('rejected')
  })
})

describe('accept', () => {
  it('writes once through setRows, by row id, and records who decided', async () => {
    const { review, setRows, state } = setup()
    review.add({ source: AGENT, proposals: props(['a', 'name', 'Acme ', 'Acme'], ['c', 'region', '', 'APAC']) })
    const before = state.app
    const out = await review.accept(review.pending().map((p) => p.id))
    expect(out.accepted).toHaveLength(2)
    expect(setRows).toHaveBeenCalledTimes(1)
    expect(state.app[0]!.name).toBe('Acme')
    expect(state.app[2]!.region).toBe('APAC')
    expect(state.app[1]).toBe(before[1]) // untouched rows are not copied
    expect(review.proposals().every((p) => p.status === 'accepted' && p.decidedBy === 'dana')).toBe(true)
  })

  it('never overwrites a cell that changed since proposing, including by a paste', async () => {
    const { review, gridWrite, cell } = setup()
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA'], ['a', 'amount', 100, 1]) })
    gridWrite('a', 'region', 'AMER') // pasted into the grid, not in the app's array
    const out = await review.accept(review.pending().map((p) => p.id))
    expect(out.stale).toHaveLength(1)
    expect(cell('a', 'region')).toBe('AMER')
    expect(cell('a', 'amount')).toBe(1) // the paste survived the accept's setRows
  })

  it('checks again after onCommit: an edit during the await wins', async () => {
    let edit = () => {}
    const { review, cell, gridWrite } = setup({ onCommit: async () => edit() })
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA']) })
    edit = () => gridWrite('a', 'region', 'typed')
    const out = await review.accept(review.pending().map((p) => p.id))
    // onCommit already saved it: told apart from a proposal stale before saving.
    expect(out).toMatchObject({ accepted: [], stale: [], committedStale: [expect.any(String)] })
    expect(cell('a', 'region')).toBe('typed')
  })

  it('a rejected commit writes nothing and keeps the proposals pending', async () => {
    const { review, setRows } = setup({ onCommit: async () => { throw new Error('offline') } })
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA']) })
    const out = await review.accept(review.pending().map((p) => p.id))
    expect((out.error as Error).message).toBe('offline')
    expect(setRows).not.toHaveBeenCalled()
    expect(review.pending()).toHaveLength(1)
  })

  it('a second accept of the same proposals while the first is saving is skipped', async () => {
    let release = () => {}
    const { review, setRows } = setup({ onCommit: () => new Promise<void>((r) => (release = r)) })
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA']) })
    const ids = review.pending().map((p) => p.id)
    const first = review.accept(ids)
    const second = await review.accept(ids)
    expect(second.skipped).toEqual(ids)
    release()
    expect((await first).accepted).toEqual(ids)
    expect(setRows).toHaveBeenCalledTimes(1)
  })

  it('commits an open cell editor first, so the typed value makes the proposal stale', async () => {
    const { review, api, gridWrite } = setup()
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA']) })
    ;(api.stopEditing as any).mockImplementation(() => {
      gridWrite('a', 'region', 'typed')
      return true
    })
    const out = await review.accept(review.pending().map((p) => p.id))
    expect(api.stopEditing).toHaveBeenCalledWith(false)
    expect(out.stale).toHaveLength(1)
  })

  it('under fullRowEditing, leaves the active row alone', async () => {
    const { review, state, cell } = setup({ fullRowEditing: true })
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA'], ['c', 'region', '', 'APAC']) })
    state.active = { rowIndex: 0, colIndex: 0, columnId: 'name' } // row a
    const out = await review.accept(review.pending().map((p) => p.id))
    expect(out.skipped).toHaveLength(1)
    expect(cell('a', 'region')).toBe('')
    expect(cell('c', 'region')).toBe('APAC')
    expect(review.pending()[0]!.note).toBe('the row is being edited')
  })

  it('a group is accepted only as far as it was shown', async () => {
    const { review } = setup()
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA'], ['c', 'region', '', 'EMEA']) })
    const g = review.groups()[0]!
    review.add({ source: IMPORT, proposals: props(['b', 'name', 'Globex', 'Globex Inc']) })
    const out = await review.acceptGroup(g.key, [g.ids[0]!])
    expect(out.accepted).toEqual([g.ids[0]!])
    expect(review.pending()).toHaveLength(2)
  })

  it('throws a clear error when the grid has no getRowId', async () => {
    const { review, api } = setup()
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA']) })
    ;(api as any).getOption = () => undefined
    await expect(review.accept(review.pending().map((p) => p.id))).rejects.toThrow(/getRowId/)
  })
})

describe('undo and redo', () => {
  it('one step per accept, by row id, also for rows paged or filtered out of view', async () => {
    const { review, undo, cell } = setup({ visible: (r) => r.id === 'b' })
    review.add({ source: AGENT, proposals: props(['a', 'name', 'Acme ', 'Acme'], ['c', 'region', '', 'APAC']) })
    await review.accept(review.pending().map((p) => p.id))
    expect(undo).toHaveLength(1)
    undo[0]!.u()
    expect(cell('a', 'name')).toBe('Acme ')
    expect(cell('c', 'region')).toBe('')
    expect(review.pending()).toHaveLength(2)
    undo[0]!.r()
    expect(cell('a', 'name')).toBe('Acme')
    expect(review.pending()).toHaveLength(0)
  })

  it('undo leaves a cell edited after the accept as it is', async () => {
    const { review, undo, cell, gridWrite } = setup()
    review.add({ source: AGENT, proposals: props(['a', 'name', 'Acme ', 'Acme'], ['c', 'region', '', 'APAC']) })
    await review.accept(review.pending().map((p) => p.id))
    gridWrite('c', 'region', 'Japan')
    undo[0]!.u()
    expect(cell('a', 'name')).toBe('Acme ')
    expect(cell('c', 'region')).toBe('Japan')
    expect(review.pending().map((p) => p.rowId)).toEqual(['a'])
  })

  it('reject is undoable too', () => {
    const { review, undo } = setup()
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA']) })
    review.reject(review.pending().map((p) => p.id))
    expect(review.pending()).toHaveLength(0)
    undo[0]!.u()
    expect(review.pending()).toHaveLength(1)
  })
})

describe('server row model', () => {
  it('commits, refreshes, and undoes through onCommit with the inverse', async () => {
    const commits: any[] = []
    const server = { refresh: vi.fn() }
    const { review, undo } = setup({ server, onCommit: async (ps: any[]) => void commits.push(ps) })
    review.add({ source: AGENT, proposals: props(['zz', 'region', '', 'EMEA']) }) // a row not loaded
    const out = await review.accept(review.pending().map((p) => p.id))
    expect(out.accepted).toHaveLength(1)
    expect(server.refresh).toHaveBeenCalledTimes(1)
    undo[0]!.u()
    await Promise.resolve()
    await Promise.resolve()
    expect(commits[1][0]).toMatchObject({ before: 'EMEA', after: '' })
    expect(server.refresh).toHaveBeenCalledTimes(2)
    expect(review.pending()).toHaveLength(1)
  })

  it('requires onCommit', () => {
    expect(() => createReview({ api: {} as ReviewGridApi, server: { refresh() {} } })).toThrow(/onCommit/)
  })
})

describe('display and navigation', () => {
  it('formats: one tint rule per field, matching pending rows only', () => {
    const { review, state } = setup()
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA']) })
    const [rule] = review.formats as any[]
    expect(rule).toMatchObject({ type: 'rule', columns: ['region'] })
    expect(rule.when({ value: '', row: state.grid[0] })).toBe(true)
    expect(rule.when({ value: 'EMEA', row: state.grid[1] })).toBe(false)
  })

  it('columns: wraps plain and custom-cell columns, leaves rich ones, and keeps the array when nothing is pending', () => {
    const { review } = setup()
    const own = () => 'own'
    const cols = [
      { field: 'name' },
      { field: 'region', cell: own },
      { field: 'amount', sparkline: { type: 'line' } },
      { field: 'done', editorType: 'checkbox' },
    ]
    expect(review.columns(cols)).toBe(cols)
    review.add({ source: AGENT, proposals: props(['a', 'name', 'Acme ', 'Acme'], ['a', 'region', '', 'X'], ['a', 'amount', 100, 5], ['a', 'done', undefined, true]) })
    const out = review.columns(cols) as any[]
    expect(typeof out[0].cell).toBe('function')
    expect(out[1].cell).not.toBe(own)
    expect(out[2]).toBe(cols[2])
    expect(out[3]).toBe(cols[3])
    expect(review.columns(cols)).toBe(out) // cached while the pending fields do not change
    // A cell with no proposal draws what the column drew before.
    expect(out[1].cell({ row: { id: 'b' }, getValue: () => 'EMEA' })).toBe('own')
    expect(out[0].cell({ row: { id: 'b' }, getValue: () => 'Globex' })).toBeUndefined()
  })

  it('reveal scrolls to the row without moving the active cell, and counts what filters hide', () => {
    const { review, api } = setup({ visible: (r) => r.id !== 'a' })
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA'], ['c', 'region', '', 'APAC']) })
    const ids = review.pending().map((p) => p.id)
    const r = review.reveal(ids)
    expect(r.hidden).toBe(1)
    expect(api.scrollToRow).toHaveBeenCalledWith(1) // c is second on the page
  })

  it('reveal moves to the page a row is on, then scrolls within the page', () => {
    const { review, api } = setup({ pageSize: 1 })
    review.add({ source: AGENT, proposals: props(['c', 'region', '', 'APAC']) })
    const r = review.reveal(review.pending().map((p) => p.id))
    expect(r.hidden).toBe(0)
    expect(api.setPage).toHaveBeenCalledWith(2) // c is the third row, one row per page
    expect(api.scrollToRow).toHaveBeenLastCalledWith(0)
  })
})

it('toJSON / load round-trips to identical groups', () => {
  const { review } = setup()
  review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA'], ['c', 'region', '', 'EMEA'], ['a', 'name', 'Acme ', 'Acme']) })
  const json = JSON.parse(JSON.stringify(review.toJSON()))
  const other = setup().review
  other.load(json)
  expect(other.groups().map((g) => [g.key, g.ids])).toEqual(review.groups().map((g) => [g.key, g.ids]))
})

describe('history and routing', () => {
  it('onDecision reports accept, reject, undo and redo with copies of the proposals', async () => {
    const decisions: any[] = []
    const rows: Row[] = [{ id: 'a', name: 'Acme ', region: '', amount: 1 }]
    let data = rows
    const undo: Array<{ u: () => void; r: () => void }> = []
    const api = {
      getData: () => data,
      getOption: (k: string) => (k === 'getRowId' ? (r: Row) => r.id : undefined),
      getActiveCell: () => null,
      getRowId: () => null,
      getColumns: () => [],
      getCommandContext: () => ({ recordUndo: (u: () => void, r: () => void) => undo.push({ u, r }) }),
      stopEditing: () => false,
      scrollToRow() {},
      getDisplayedRows: () => data,
    } as unknown as ReviewGridApi
    const review = createReview<Row>({ api, setRows: (n) => (data = n), user: 'dana', onDecision: (d) => decisions.push(d) })
    review.add({ source: AGENT, proposals: props(['a', 'name', 'Acme ', 'Acme'], ['a', 'region', '', 'EU']) })
    const [name, region] = review.pending()
    await review.accept([name!.id])
    review.reject([region!.id])
    undo[0]!.u()
    undo[0]!.r()
    expect(decisions.map((d) => [d.action, d.of, d.proposals.length, d.by])).toEqual([
      ['accept', undefined, 1, 'dana'],
      ['reject', undefined, 1, 'dana'],
      ['undo', 'accept', 1, 'dana'],
      ['redo', 'accept', 1, 'dana'],
    ])
    expect(decisions[0].proposals[0]).not.toBe(review.get(name!.id))
  })

  it('log lists decided proposals in decision order', async () => {
    const { review, gridWrite } = setup()
    review.add({ source: AGENT, proposals: props(['a', 'name', 'Acme ', 'Acme'], ['c', 'region', '', 'APAC'], ['b', 'name', 'Globex', 'Globex Inc']) })
    const [a, c, b] = review.pending()
    review.reject([b!.id])
    gridWrite('c', 'region', 'typed')
    await review.accept([a!.id, c!.id])
    expect(review.log().map((p) => [p.rowId, p.status])).toEqual([['b', 'rejected'], ['c', 'stale'], ['a', 'accepted']])
  })

  it('revertSet proposes the reverse of what a set wrote, and the stale check still guards it', async () => {
    const { review, cell, gridWrite } = setup()
    const set = review.add({ source: AGENT, title: 'Cleanup', proposals: props(['a', 'name', 'Acme ', 'Acme'], ['c', 'region', '', 'APAC']) })
    await review.accept(review.pending().map((p) => p.id))
    gridWrite('c', 'region', 'Japan') // edited after the accept
    const revert = review.revertSet(set.id)!
    expect(revert.source).toMatchObject({ kind: 'user', label: 'Revert: Cleanup' })
    const out = await review.accept(revert.proposals.map((p) => p.id))
    expect(out.accepted).toHaveLength(1)
    expect(out.stale).toHaveLength(1)
    expect(cell('a', 'name')).toBe('Acme ')
    expect(cell('c', 'region')).toBe('Japan')
    expect(review.revertSet('nope')).toBeNull()
  })

  it('an export of one set merges into another review beside what it has', () => {
    const author = setup().review
    const keep = author.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA']) })
    author.add({ source: IMPORT, proposals: props(['b', 'name', 'Globex', 'Globex Inc']) })
    const json = JSON.parse(JSON.stringify(author.toJSON({ setIds: [keep.id] })))
    expect(json.sets).toHaveLength(1)
    const approver = setup().review
    approver.add({ source: IMPORT, proposals: props(['a', 'region', '', 'AMER']) })
    approver.merge(json)
    approver.merge(json) // a second merge of the same set is skipped
    expect(approver.sets().map((s) => s.count)).toEqual([1, 1])
    expect(approver.conflicts()).toHaveLength(2) // EMEA from the author vs AMER here
  })
})

describe('found in review', () => {
  it('a proposal that arrives while another is being accepted leaves it alone; the stale check settles it', async () => {
    let release = () => {}
    const { review, cell } = setup({ onCommit: () => new Promise<void>((r) => (release = r)) })
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA']) })
    const first = review.pending()[0]!
    const accepting = review.accept([first.id])
    review.add({ source: IMPORT, proposals: props(['a', 'region', '', 'AMER']) })
    expect(review.get(first.id)!.status).toBe('pending') // not turned into a conflict mid-save
    release()
    expect((await accepting).accepted).toEqual([first.id])
    expect(cell('a', 'region')).toBe('EMEA')
    const late = review.pending()[0]!
    expect((await review.accept([late.id])).stale).toEqual([late.id])
  })

  it('undoing a conflict choice puts both proposals back in conflict', () => {
    const { review, undo } = setup()
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA']) })
    review.add({ source: IMPORT, proposals: props(['a', 'region', '', 'AMER']) })
    const [one] = review.conflicts()
    review.resolveConflict(one!.id)
    expect(review.conflicts()).toHaveLength(0)
    undo.at(-1)!.u()
    expect(review.conflicts()).toHaveLength(2)
    expect(review.pending()).toHaveLength(0)
  })

  it('undoing a reject of a conflict brings it back as a conflict, not as pending', () => {
    const { review, undo } = setup()
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA']) })
    review.add({ source: IMPORT, proposals: props(['a', 'region', '', 'AMER']) })
    review.reject(review.conflicts().map((p) => p.id))
    undo.at(-1)!.u()
    expect(review.conflicts()).toHaveLength(2)
  })

  it('with onCommit, undo saves the reverse first and writes once that resolves', async () => {
    const commits: any[][] = []
    const { review, undo, cell } = setup({ onCommit: async (ps: any[]) => void commits.push(ps) })
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA']) })
    await review.accept(review.pending().map((p) => p.id))
    undo.at(-1)!.u()
    expect(cell('a', 'region')).toBe('EMEA') // not yet: the save is in flight
    await Promise.resolve()
    await Promise.resolve()
    expect(commits[1]![0]).toMatchObject({ before: 'EMEA', after: '' })
    expect(cell('a', 'region')).toBe('')
    expect(review.pending()).toHaveLength(1)
  })

  it('an accept before the grid exists writes nothing and leaves the proposals pending', async () => {
    let data: any[] = []
    const review = createReview<any>({ api: () => null, setRows: (n) => (data = n) })
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA']) })
    const out = await review.accept(review.pending().map((p) => p.id))
    expect(out.skipped).toHaveLength(1)
    expect(review.pending()).toHaveLength(1)
    expect(data).toEqual([])
  })

  it('numeric row ids match as strings, so they never read as stale', async () => {
    let data = [{ id: 7, region: '' }]
    const api = {
      getData: () => data,
      getOption: (k: string) => (k === 'getRowId' ? (r: any) => r.id : undefined),
      getActiveCell: () => null,
      getRowId: () => null,
      getColumns: () => [],
      getCommandContext: () => ({ recordUndo() {} }),
      stopEditing: () => false,
      scrollToRow() {},
      getDisplayedRows: () => data,
    } as unknown as ReviewGridApi
    const review = createReview<any>({ api, setRows: (n) => (data = n) })
    review.add({ source: AGENT, proposals: [{ rowId: 7 as unknown as string, field: 'region', before: '', after: 'EMEA' }] })
    const out = await review.accept(review.pending().map((p) => p.id))
    expect(out.accepted).toHaveLength(1)
    expect(data[0]!.region).toBe('EMEA')
  })

  it('a replaced proposal leaves its set, so set counts stay true', () => {
    const { review } = setup()
    review.add({ source: AGENT, proposals: props(['a', 'region', '', 'EU']) })
    review.add({ source: AGENT, proposals: props(['a', 'region', 'EU', 'EMEA']) })
    expect(review.sets().map((s) => s.count)).toEqual([0, 1])
  })
})

it('a merged proposal keeps when it was made', () => {
  const author = setup().review
  author.add({ source: AGENT, proposals: props(['a', 'region', '', 'EMEA']) })
  const json = JSON.parse(JSON.stringify(author.toJSON()))
  json.sets[0].proposals[0].createdAt = 1_700_000_000_000
  const approver = setup().review
  approver.merge(json)
  expect(approver.pending()[0]!.createdAt).toBe(1_700_000_000_000)
})
