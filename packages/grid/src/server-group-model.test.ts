import { describe, expect, it } from 'vitest'
import { createServerGroupModel } from './server-group-model'
import type { ServerDataSource, ServerDisplayRow, ServerGroupRow } from './server-data-source'

type Row = { country: string; city: string; amount: number }

const DATA: Row[] = [
  { country: 'DE', city: 'Berlin', amount: 10 },
  { country: 'DE', city: 'Berlin', amount: 5 },
  { country: 'DE', city: 'Munich', amount: 7 },
  { country: 'FR', city: 'Paris', amount: 3 },
]

/**
 * A fake backend that groups + aggregates DATA per the request's groupBy /
 * groupKeys, exactly as a real SQL GROUP BY would - returns group rows for a
 * group level and leaf rows at the bottom.
 */
function makeGroupSource(data: Row[], delay = 0): ServerDataSource<Row> & { calls: number } {
  return {
    calls: 0,
    async getRows(req) {
      this.calls += 1
      if (delay) await new Promise((r) => setTimeout(r, delay))
      const subset = data.filter((r) =>
        req.groupKeys!.every((k, i) => String((r as Record<string, unknown>)[req.groupBy![i]!]) === k),
      )
      const level = req.groupKeys!.length
      if (level < req.groupBy!.length) {
        const field = req.groupBy![level]!
        const map = new Map<string, Record<string, unknown>>()
        for (const r of subset) {
          const key = String((r as Record<string, unknown>)[field])
          const agg = map.get(key) ?? { [field]: (r as Record<string, unknown>)[field] }
          for (const a of req.aggregations!) {
            const cur = (agg[a.col] as number) ?? 0
            agg[a.col] = a.fn === 'count' ? cur + 1 : cur + ((r as Record<string, unknown>)[a.col] as number)
          }
          map.set(key, agg)
        }
        const groups = [...map.values()]
        return { rows: groups.slice(req.startRow, req.endRow) as unknown as Row[], rowCount: groups.length }
      }
      return { rows: subset.slice(req.startRow, req.endRow), rowCount: subset.length }
    },
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0))
const groups = (rows: ServerDisplayRow<Row>[]) => rows.filter((r): r is ServerGroupRow<Row> => r.kind === 'group')

describe('createServerGroupModel', () => {
  it('refresh() loads the top-level groups with aggregates', async () => {
    const src = makeGroupSource(DATA)
    let state = createServerGroupModel<Row>(src, {
      groupBy: ['country', 'city'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      onChange: (s) => (state = s as never),
    }).getState()
    const ctl = createServerGroupModel<Row>(src, {
      groupBy: ['country', 'city'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      onChange: (s) => (state = s as never),
    })
    ctl.refresh()
    await flush()
    const g = groups(state.displayRows)
    expect(g.map((r) => r.key)).toEqual(['DE', 'FR'])
    expect(g.every((r) => r.level === 0 && !r.expanded)).toBe(true)
    expect(g[0]!.aggregates.amount).toBe(22) // 10 + 5 + 7
    expect(g[1]!.aggregates.amount).toBe(3)
  })

  it('expanding a group lazily fetches and splices its child groups', async () => {
    const src = makeGroupSource(DATA)
    let state = { displayRows: [] as ServerDisplayRow<Row>[] } as never
    const ctl = createServerGroupModel<Row>(src, {
      groupBy: ['country', 'city'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      onChange: (s) => (state = s as never),
    })
    ctl.refresh()
    await flush()
    const callsBefore = src.calls
    ctl.expandGroup(['DE'])
    await flush()
    expect(src.calls).toBe(callsBefore + 1) // one fetch for DE's children
    const rows = (state as { displayRows: ServerDisplayRow<Row>[] }).displayRows
    // DE (expanded), Berlin, Munich, FR
    expect(rows.map((r) => (r.kind === 'group' ? r.key : 'leaf'))).toEqual(['DE', 'Berlin', 'Munich', 'FR'])
    const berlin = rows.find((r) => r.kind === 'group' && r.key === 'Berlin') as ServerGroupRow<Row>
    expect(berlin.level).toBe(1)
    expect(berlin.aggregates.amount).toBe(15) // 10 + 5
  })

  it('expanding a bottom-level group returns leaf rows', async () => {
    const src = makeGroupSource(DATA)
    let state = { displayRows: [] as ServerDisplayRow<Row>[] } as never
    const ctl = createServerGroupModel<Row>(src, {
      groupBy: ['country', 'city'],
      onChange: (s) => (state = s as never),
    })
    ctl.refresh()
    await flush()
    ctl.expandGroup(['DE'])
    await flush()
    ctl.expandGroup(['DE', 'Berlin'])
    await flush()
    const rows = (state as { displayRows: ServerDisplayRow<Row>[] }).displayRows
    const leaves = rows.filter((r) => r.kind === 'leaf')
    expect(leaves).toHaveLength(2) // the two Berlin rows
    expect(leaves.every((r) => r.level === 2)).toBe(true)
  })

  it('collapse removes the children again', async () => {
    const src = makeGroupSource(DATA)
    let state = { displayRows: [] as ServerDisplayRow<Row>[] } as never
    const ctl = createServerGroupModel<Row>(src, {
      groupBy: ['country', 'city'],
      onChange: (s) => (state = s as never),
    })
    ctl.refresh()
    await flush()
    ctl.expandGroup(['DE'])
    await flush()
    ctl.collapseGroup(['DE'])
    const rows = ctl.getState().displayRows
    expect(rows.map((r) => (r.kind === 'group' ? r.key : 'leaf'))).toEqual(['DE', 'FR'])
    expect(ctl.isExpanded(['DE'])).toBe(false)
  })

  it('setFilter resets the tree and refetches from the top', async () => {
    const src = makeGroupSource(DATA)
    const ctl = createServerGroupModel<Row>(src, { groupBy: ['country'], onChange: () => {} })
    ctl.refresh()
    await flush()
    const before = src.calls
    ctl.setFilter({ global: 'x' })
    await flush()
    expect(src.calls).toBeGreaterThan(before)
    expect(ctl.getState().filterModel).toEqual({ global: 'x' })
  })

  it('a stale expand response is dropped after a reset (race safety)', async () => {
    const src = makeGroupSource(DATA, 20) // slow
    let state = { displayRows: [] as ServerDisplayRow<Row>[] } as never
    const ctl = createServerGroupModel<Row>(src, {
      groupBy: ['country', 'city'],
      onChange: (s) => (state = s as never),
    })
    ctl.refresh()
    await new Promise((r) => setTimeout(r, 30))
    ctl.expandGroup(['DE']) // in-flight, slow
    ctl.setGroupBy(['city']) // reset (bumps generation) before DE's children land
    await new Promise((r) => setTimeout(r, 60))
    const rows = (state as { displayRows: ServerDisplayRow<Row>[] }).displayRows
    // Regrouped by city at the top; no stale DE subtree leaked in.
    expect(rows.every((r) => r.level === 0)).toBe(true)
    expect(rows.some((r) => r.kind === 'group' && r.key === 'DE')).toBe(false)
  })

  it('pages a group\'s children in blocks (load more)', async () => {
    const data: Row[] = [
      { country: 'DE', city: 'B', amount: 1 },
      { country: 'DE', city: 'M', amount: 2 },
      { country: 'DE', city: 'H', amount: 3 },
      { country: 'DE', city: 'K', amount: 4 },
    ]
    const src = makeGroupSource(data)
    let state = { displayRows: [] as ServerDisplayRow<Row>[] } as never
    const ctl = createServerGroupModel<Row>(src, {
      groupBy: ['country'],
      pageSize: 2,
      onChange: (s) => (state = s as never),
    })
    ctl.refresh()
    await flush()
    ctl.expandGroup(['DE'])
    await flush()
    let rows = (state as { displayRows: ServerDisplayRow<Row>[] }).displayRows
    expect(rows.filter((r) => r.kind === 'leaf')).toHaveLength(2) // first block
    const more = rows.find((r) => r.kind === 'more')
    expect(more && more.kind === 'more' && more.remaining).toBe(2)

    ctl.loadMoreChildren(['DE'])
    await flush()
    rows = (state as { displayRows: ServerDisplayRow<Row>[] }).displayRows
    expect(rows.filter((r) => r.kind === 'leaf')).toHaveLength(4) // all loaded
    expect(rows.some((r) => r.kind === 'more')).toBe(false) // no more affordance
  })

  it('emits a subtotal footer row after an expanded group when groupFooters is on', async () => {
    const src = makeGroupSource(DATA)
    let state = { displayRows: [] as ServerDisplayRow<Row>[] } as never
    const ctl = createServerGroupModel<Row>(src, {
      groupBy: ['country', 'city'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      groupFooters: true,
      onChange: (s) => (state = s as never),
    })
    ctl.refresh()
    await flush()
    ctl.expandGroup(['DE'])
    await flush()
    const rows = (state as { displayRows: ServerDisplayRow<Row>[] }).displayRows
    const footers = rows.filter((r) => r.kind === 'footer')
    expect(footers).toHaveLength(1)
    expect(footers[0]!.kind === 'footer' && footers[0]!.key).toBe('DE')
  })

  it('shows skeleton rows while a group\'s first block is loading', async () => {
    const src = makeGroupSource(DATA, 20) // slow
    let state = { displayRows: [] as ServerDisplayRow<Row>[] } as never
    const ctl = createServerGroupModel<Row>(src, {
      groupBy: ['country', 'city'],
      skeletonRows: 3,
      onChange: (s) => (state = s as never),
    })
    ctl.refresh()
    await new Promise((r) => setTimeout(r, 35)) // root loaded
    ctl.expandGroup(['DE']) // fetch in flight -> synchronous emit with skeletons
    const loading = (state as { displayRows: ServerDisplayRow<Row>[] }).displayRows
    expect(loading.filter((r) => r.kind === 'skeleton')).toHaveLength(3)
    await new Promise((r) => setTimeout(r, 40)) // DE loads
    expect((state as { displayRows: ServerDisplayRow<Row>[] }).displayRows.some((r) => r.kind === 'skeleton')).toBe(false)
  })
})

type Node = { id: string; parentId: string | null; name: string; kids: boolean }
const TREE: Node[] = [
  { id: '1', parentId: null, name: 'Root A', kids: true },
  { id: '2', parentId: null, name: 'Root B', kids: false },
  { id: '1a', parentId: '1', name: 'Child A1', kids: true },
  { id: '1b', parentId: '1', name: 'Child A2', kids: false },
  { id: '1a1', parentId: '1a', name: 'Leaf A1a', kids: false },
]

/** A fake self-referential tree backend: return the children of the node at the end of groupKeys. */
function makeTreeSource(nodes: Node[]): ServerDataSource<Node> & { calls: number } {
  return {
    calls: 0,
    async getRows(req) {
      this.calls += 1
      const parent = req.groupKeys!.length ? req.groupKeys![req.groupKeys!.length - 1] : null
      const children = nodes.filter((n) => (n.parentId ?? null) === (parent ?? null))
      return { rows: children, rowCount: children.length }
    },
  }
}

describe('createServerGroupModel - treeData', () => {
  const opts = (onChange: (s: unknown) => void) => ({
    treeData: true,
    getRowId: (n: Node) => n.id,
    hasChildren: (n: Node) => n.kids,
    onChange: onChange as never,
  })
  const nameOf = (r: ServerDisplayRow<Node>) => ('data' in r ? r.data.name : `(${r.kind})`)

  it('throws without getRowId/hasChildren', () => {
    expect(() => createServerGroupModel<Node>(makeTreeSource(TREE), { treeData: true, onChange: () => {} })).toThrow()
  })

  it('loads roots, marking expandable nodes as groups and leaves as leaves', async () => {
    const src = makeTreeSource(TREE)
    let state = { displayRows: [] as ServerDisplayRow<Node>[] } as never
    const ctl = createServerGroupModel<Node>(src, opts((s) => (state = s as never)))
    ctl.refresh()
    await flush()
    const rows = (state as { displayRows: ServerDisplayRow<Node>[] }).displayRows
    expect(rows.map((r) => [r.kind, nameOf(r)])).toEqual([
      ['group', 'Root A'], // kids: true
      ['leaf', 'Root B'], // kids: false
    ])
  })

  it('expanding a node fetches and splices its children by id path', async () => {
    const src = makeTreeSource(TREE)
    let state = { displayRows: [] as ServerDisplayRow<Node>[] } as never
    const ctl = createServerGroupModel<Node>(src, opts((s) => (state = s as never)))
    ctl.refresh()
    await flush()
    ctl.expandGroup(['1'])
    await flush()
    let rows = (state as { displayRows: ServerDisplayRow<Node>[] }).displayRows
    expect(rows.map(nameOf)).toEqual(['Root A', 'Child A1', 'Child A2', 'Root B'])
    // drill one more level: Child A1 -> Leaf A1a
    ctl.expandGroup(['1', '1a'])
    await flush()
    rows = (state as { displayRows: ServerDisplayRow<Node>[] }).displayRows
    expect(rows.map(nameOf)).toEqual(['Root A', 'Child A1', 'Leaf A1a', 'Child A2', 'Root B'])
    expect(rows.find((r) => nameOf(r) === 'Leaf A1a')!.level).toBe(2)
  })
})
