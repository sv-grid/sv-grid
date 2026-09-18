/**
 * Golden test for the Server-Side Row Model relocation.
 *
 * `createServerGroupModel` and its two components moved from `@svgrid/grid`
 * into `@svgrid/enterprise` unchanged. The unit tests beside this file moved
 * with them and assert behaviour a slice at a time; this one pins the WHOLE
 * display list, verbatim, through one realistic session - expand, drill, load
 * more, collapse, footers, skeletons, tree mode - so that "the move changed
 * nothing" is a thing the suite can prove rather than a claim in a commit
 * message.
 *
 * Every id, level and kind below was produced by the free-package version at
 * `@svgrid/grid@3.0.3`. If a future refactor has to change one of them, that
 * is a breaking change to what apps render and it belongs in a changeset.
 */
import { describe, expect, it } from 'vitest'
import type { ServerDataSource, ServerRequest, ServerDisplayRow } from '@svgrid/grid'
import { createServerGroupModel } from './server-group-model'

type Sale = { region: string; country: string; rep: string; amount: number }

const LEAVES: Sale[] = [
  { region: 'EMEA', country: 'DE', rep: 'ada', amount: 100 },
  { region: 'EMEA', country: 'DE', rep: 'brian', amount: 200 },
  { region: 'EMEA', country: 'FR', rep: 'chen', amount: 300 },
  { region: 'APAC', country: 'JP', rep: 'dina', amount: 400 },
]

/**
 * A minimal but honest backend: while the path is shorter than `groupBy` it
 * answers with one pre-aggregated row per distinct key at that level, and at
 * the bottom it answers with the leaves under the path - the contract exactly
 * as `docs/help/server/server-grouping.md` states it.
 */
function groupingSource(): ServerDataSource<Sale> {
  return {
    async getRows(req: ServerRequest) {
      const groupBy = req.groupBy ?? []
      const keys = req.groupKeys ?? []
      const scoped = LEAVES.filter((r) =>
        keys.every((k, i) => String((r as Record<string, unknown>)[groupBy[i]!]) === k),
      )
      const level = keys.length
      if (level < groupBy.length) {
        const field = groupBy[level]!
        const buckets = new Map<string, number>()
        for (const r of scoped) {
          const k = String((r as Record<string, unknown>)[field])
          buckets.set(k, (buckets.get(k) ?? 0) + r.amount)
        }
        const rows = [...buckets].map(([k, amount]) => ({ [field]: k, amount }) as unknown as Sale)
        return { rows: rows.slice(req.startRow, req.endRow), rowCount: rows.length }
      }
      return { rows: scoped.slice(req.startRow, req.endRow), rowCount: scoped.length }
    },
  }
}

/** Run the microtask queue until the model stops fetching. */
const settle = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve()
}

/** The shape a cell renderer actually reads, minus the row payload. */
const shape = (rows: ServerDisplayRow<Sale>[]) =>
  rows.map((r) => {
    const base: Record<string, unknown> = { kind: r.kind, id: r.id, level: r.level }
    if (r.kind === 'group') {
      base.key = r.key
      base.field = r.field
      base.expanded = r.expanded
      base.aggregates = r.aggregates
    }
    if (r.kind === 'footer') base.key = r.key
    if (r.kind === 'more') base.remaining = r.remaining
    if (r.kind === 'leaf') base.rep = (r.data as Sale).rep
    return base
  })

describe('server group model (golden)', () => {
  it('produces the documented display list through a full drill-down', async () => {
    let view: ServerDisplayRow<Sale>[] = []
    const ctl = createServerGroupModel<Sale>(groupingSource(), {
      groupBy: ['region', 'country'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      onChange: (s) => (view = s.displayRows),
    })

    ctl.refresh()
    await settle()
    expect(shape(view)).toEqual([
      { kind: 'group', id: '["EMEA"]', level: 0, key: 'EMEA', field: 'region', expanded: false, aggregates: { amount: 600 } },
      { kind: 'group', id: '["APAC"]', level: 0, key: 'APAC', field: 'region', expanded: false, aggregates: { amount: 400 } },
    ])

    ctl.expandGroup(['EMEA'])
    await settle()
    expect(shape(view)).toEqual([
      { kind: 'group', id: '["EMEA"]', level: 0, key: 'EMEA', field: 'region', expanded: true, aggregates: { amount: 600 } },
      { kind: 'group', id: '["EMEA","DE"]', level: 1, key: 'DE', field: 'country', expanded: false, aggregates: { amount: 300 } },
      { kind: 'group', id: '["EMEA","FR"]', level: 1, key: 'FR', field: 'country', expanded: false, aggregates: { amount: 300 } },
      { kind: 'group', id: '["APAC"]', level: 0, key: 'APAC', field: 'region', expanded: false, aggregates: { amount: 400 } },
    ])

    // The innermost level returns leaves, and their ids are the parent path
    // plus the row's offset in the block.
    ctl.expandGroup(['EMEA', 'DE'])
    await settle()
    expect(shape(view)).toEqual([
      { kind: 'group', id: '["EMEA"]', level: 0, key: 'EMEA', field: 'region', expanded: true, aggregates: { amount: 600 } },
      { kind: 'group', id: '["EMEA","DE"]', level: 1, key: 'DE', field: 'country', expanded: true, aggregates: { amount: 300 } },
      { kind: 'leaf', id: '["EMEA","DE"]:0', level: 2, rep: 'ada' },
      { kind: 'leaf', id: '["EMEA","DE"]:1', level: 2, rep: 'brian' },
      { kind: 'group', id: '["EMEA","FR"]', level: 1, key: 'FR', field: 'country', expanded: false, aggregates: { amount: 300 } },
      { kind: 'group', id: '["APAC"]', level: 0, key: 'APAC', field: 'region', expanded: false, aggregates: { amount: 400 } },
    ])

    ctl.collapseGroup(['EMEA'])
    await settle()
    expect(shape(view).map((r) => r.id)).toEqual(['["EMEA"]', '["APAC"]'])
    ctl.dispose()
  })

  it('emits skeletons while a block is in flight and a footer after it lands', async () => {
    let release: (() => void) | null = null
    const gate = new Promise<void>((r) => (release = r))
    const inner = groupingSource()
    let calls = 0
    const source: ServerDataSource<Sale> = {
      async getRows(req) {
        calls += 1
        if (calls === 2) await gate // hold the first expand open
        return inner.getRows(req)
      },
    }

    let view: ServerDisplayRow<Sale>[] = []
    const ctl = createServerGroupModel<Sale>(source, {
      groupBy: ['region'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      groupFooters: true,
      skeletonRows: 2,
      onChange: (s) => (view = s.displayRows),
    })

    ctl.refresh()
    await settle()
    ctl.expandGroup(['EMEA'])
    await settle()
    expect(shape(view)).toEqual([
      { kind: 'group', id: '["EMEA"]', level: 0, key: 'EMEA', field: 'region', expanded: true, aggregates: { amount: 600 } },
      { kind: 'skeleton', id: '["EMEA"]sk0', level: 1 },
      { kind: 'skeleton', id: '["EMEA"]sk1', level: 1 },
      { kind: 'group', id: '["APAC"]', level: 0, key: 'APAC', field: 'region', expanded: false, aggregates: { amount: 400 } },
    ])

    release!()
    await settle()
    expect(shape(view)).toEqual([
      { kind: 'group', id: '["EMEA"]', level: 0, key: 'EMEA', field: 'region', expanded: true, aggregates: { amount: 600 } },
      { kind: 'leaf', id: '["EMEA"]:0', level: 1, rep: 'ada' },
      { kind: 'leaf', id: '["EMEA"]:1', level: 1, rep: 'brian' },
      { kind: 'leaf', id: '["EMEA"]:2', level: 1, rep: 'chen' },
      { kind: 'footer', id: '["EMEA"]footer', level: 1, key: 'EMEA' },
      { kind: 'group', id: '["APAC"]', level: 0, key: 'APAC', field: 'region', expanded: false, aggregates: { amount: 400 } },
    ])
    ctl.dispose()
  })

  it('pages children in blocks and counts what is left', async () => {
    let view: ServerDisplayRow<Sale>[] = []
    const ctl = createServerGroupModel<Sale>(groupingSource(), {
      groupBy: ['region'],
      pageSize: 2,
      onChange: (s) => (view = s.displayRows),
    })

    ctl.refresh()
    await settle()
    ctl.expandGroup(['EMEA'])
    await settle()
    expect(shape(view)).toEqual([
      { kind: 'group', id: '["EMEA"]', level: 0, key: 'EMEA', field: 'region', expanded: true, aggregates: {} },
      { kind: 'leaf', id: '["EMEA"]:0', level: 1, rep: 'ada' },
      { kind: 'leaf', id: '["EMEA"]:1', level: 1, rep: 'brian' },
      { kind: 'more', id: '["EMEA","more"]', level: 1, remaining: 1 },
      { kind: 'group', id: '["APAC"]', level: 0, key: 'APAC', field: 'region', expanded: false, aggregates: {} },
    ])

    ctl.loadMoreChildren(['EMEA'])
    await settle()
    expect(shape(view).filter((r) => r.kind === 'more')).toEqual([])
    expect(shape(view).filter((r) => r.kind === 'leaf').map((r) => r.rep)).toEqual([
      'ada',
      'brian',
      'chen',
    ])
    ctl.dispose()
  })

  it('builds tree paths from row ids in treeData mode', async () => {
    type Node = { id: string; name: string; parent: string | null; leaf: boolean }
    const NODES: Node[] = [
      { id: 'r1', name: 'Root', parent: null, leaf: false },
      { id: 'c1', name: 'Child A', parent: 'r1', leaf: false },
      { id: 'g1', name: 'Grandchild', parent: 'c1', leaf: true },
    ]
    const source: ServerDataSource<Node> = {
      async getRows(req) {
        const parent = (req.groupKeys ?? []).at(-1) ?? null
        const rows = NODES.filter((n) => n.parent === parent)
        return { rows, rowCount: rows.length }
      },
    }

    let view: ServerDisplayRow<Node>[] = []
    const ctl = createServerGroupModel<Node>(source, {
      treeData: true,
      getRowId: (r) => r.id,
      hasChildren: (r) => !r.leaf,
      onChange: (s) => (view = s.displayRows),
    })

    ctl.refresh()
    await settle()
    ctl.expandGroup(['r1'])
    await settle()
    ctl.expandGroup(['r1', 'c1'])
    await settle()

    expect(
      view.map((r) => ({ kind: r.kind, id: r.id, level: r.level })),
    ).toEqual([
      { kind: 'group', id: '["r1"]', level: 0 },
      { kind: 'group', id: '["r1","c1"]', level: 1 },
      // A leaf in tree mode is keyed by the node id, not the block offset.
      { kind: 'leaf', id: '["r1","c1"]:g1', level: 2 },
    ])
    ctl.dispose()
  })
})
