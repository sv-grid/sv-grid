/**
 * `createServerRowModel` - the block-cached server row model.
 *
 * The backend here is a scripted one: every request is recorded and can be
 * held open, so a test can assert exactly which levels asked for what, and
 * when. Row shapes follow the documented contract: while `groupKeys` is
 * shorter than `groupBy` the server answers with one row per distinct key
 * (carrying its aggregates), and at the bottom with the leaves under the path.
 */
import { describe, expect, it, vi } from 'vitest'
import { rowPlaceholderState, type ServerDataSource, type ServerRequest } from '@svgrid/grid/server'
import { createServerRowModel, serverGroupText, GRAND_TOTAL_ROW_ID, GROUP_TOTAL_ROW_ID_PREFIX } from './server-row-model'

type Sale = { region: string; country: string; rep: string; amount: number }

function makeSales(perCountry: number): Sale[] {
  const out: Sale[] = []
  const world: Record<string, string[]> = { EMEA: ['DE', 'FR'], APAC: ['JP'] }
  let n = 0
  for (const [region, countries] of Object.entries(world)) {
    for (const country of countries) {
      for (let i = 0; i < perCountry; i += 1) {
        out.push({ region, country, rep: `rep${n % 7}`, amount: 100 + (n % 13) })
        n += 1
      }
    }
  }
  return out
}

type Recorded = { req: ServerRequest; release: () => void; fail: () => void }

/**
 * A grouping backend that holds every request until the test releases it.
 * `total` rows per country, so `perCountry` leaves under each (region, country).
 */
function backend(opts: { perCountry?: number; hold?: boolean; grandTotal?: boolean } = {}) {
  const rows = makeSales(opts.perCountry ?? 250)
  const log: Recorded[] = []
  const source: ServerDataSource<Sale> = {
    getRows(req) {
      return new Promise((resolve, reject) => {
        const answer = () => {
          const groupBy = req.groupBy ?? []
          const keys = req.groupKeys ?? []
          const scoped = rows.filter((r) =>
            keys.every((k, i) => String((r as Record<string, unknown>)[groupBy[i]!]) === k),
          )
          const level = keys.length
          let out: Sale[]
          let count: number
          if (level < groupBy.length) {
            const field = groupBy[level]!
            const buckets = new Map<string, { amount: number; n: number; next: Set<string> }>()
            const nextField = groupBy[level + 1]
            for (const r of scoped) {
              const k = String((r as Record<string, unknown>)[field])
              const b = buckets.get(k) ?? { amount: 0, n: 0, next: new Set<string>() }
              b.amount += r.amount
              b.n += 1
              if (nextField) b.next.add(String((r as Record<string, unknown>)[nextField]))
              buckets.set(k, b)
            }
            // childCount is what the NEXT level holds: countries under a
            // region, or leaves under a country.
            let groups = [...buckets].map(
              ([k, b]) =>
                ({ [field]: k, amount: b.amount, childCount: nextField ? b.next.size : b.n }) as unknown as Sale,
            )
            const sort = req.sortModel[0]
            if (sort && sort.id === 'amount') {
              groups = [...groups].sort((a, b) => (sort.desc ? b.amount - a.amount : a.amount - b.amount))
            }
            out = groups.slice(req.startRow, req.endRow)
            count = groups.length
          } else {
            let leaves = scoped
            const sort = req.sortModel[0]
            if (sort) {
              const col = sort.id as keyof Sale
              leaves = [...leaves].sort((a, b) =>
                (sort.desc ? -1 : 1) * String(a[col]).localeCompare(String(b[col]), undefined, { numeric: true }),
              )
            }
            const g = req.filterModel.global
            if (g) leaves = leaves.filter((r) => r.rep.includes(g))
            out = leaves.slice(req.startRow, req.endRow)
            count = leaves.length
          }
          const result: { rows: Sale[]; rowCount: number; grandTotal?: Sale } = { rows: out, rowCount: count }
          if (req.needsGrandTotal && opts.grandTotal) {
            result.grandTotal = { amount: rows.reduce((s, r) => s + r.amount, 0) } as unknown as Sale
          }
          resolve(result)
        }
        const rec: Recorded = { req, release: answer, fail: () => reject(new Error('boom')) }
        log.push(rec)
        if (!opts.hold) answer()
      })
    },
  }
  return {
    source,
    log,
    /** `[groupKeys]:startRow-endRow` for every request so far. */
    trace: () => log.map((r) => `${JSON.stringify(r.req.groupKeys)}:${r.req.startRow}-${r.req.endRow}`),
    /**
     * Answer every open request, including ones that only reach the backend
     * a microtask from now (the model awaits a concurrency slot before it
     * calls `getRows`), and keep going until nothing new arrives.
     */
    async releaseAll() {
      for (;;) {
        await settle()
        const pending = log.filter((r) => !(r as Recorded & { done?: boolean }).done)
        if (pending.length === 0) return
        for (const r of pending) {
          ;(r as Recorded & { done?: boolean }).done = true
          r.release()
        }
      }
    },
  }
}

const settle = async () => {
  for (let i = 0; i < 30; i += 1) await Promise.resolve()
}

const kinds = (rows: ReadonlyArray<{ kind: string }>) => rows.map((r) => r.kind)

describe('createServerRowModel', () => {
  it('loads the top level on refresh and drills into a group on expand', async () => {
    const be = backend()
    let view: ReturnType<typeof ctl.getState> | null = null
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['region', 'country'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      onChange: (s) => (view = s),
    })

    ctl.refresh()
    await settle()
    expect(be.trace()).toEqual(['[]:0-100'])
    expect(kinds(view!.displayRows)).toEqual(['group', 'group'])
    expect(view!.rowCount).toBe(2)

    ctl.expandGroup(['EMEA'])
    await settle()
    expect(be.trace()).toEqual(['[]:0-100', '["EMEA"]:0-100'])
    expect(view!.displayRows.map((r) => ('key' in r ? r.key : r.kind))).toEqual([
      'EMEA',
      'DE',
      'FR',
      'APAC',
    ])
    // The child request named its parent row, for backends keyed off it.
    expect((be.log[1]!.req.parentRow as Sale).region).toBe('EMEA')
    ctl.dispose()
  })

  it('claims initialRowCount rows at a level before its first block, so a jump lands on placeholders', async () => {
    const be = backend({ hold: true, perCountry: 400 })
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: [],
      blockSize: 100,
      levelParams: (level) => (level === 0 ? { initialRowCount: 1000 } : {}),
    })
    ctl.refresh()
    await settle()
    // A thousand rows on screen before anything has answered - placeholders.
    const rows = ctl.getState().displayRows
    expect(rows).toHaveLength(1000)
    expect(kinds(rows).every((k) => k === 'placeholder')).toBe(true)
    // The grid scrolled to row 900: the block under it is what loads next.
    ctl.setViewport(900, 920)
    await settle()
    expect(be.trace()).toEqual(['[]:0-100', '[]:900-1000'])
    await be.releaseAll()
    expect(ctl.getState().displayRows[905]!.kind).toBe('leaf')
    ctl.dispose()
  })

  it('shows placeholders for a level before its first block lands', async () => {
    const be = backend({ hold: true })
    let view: ReturnType<typeof ctl.getState> | null = null
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['region'],
      skeletonRows: 3,
      onChange: (s) => (view = s),
    })

    ctl.refresh()
    await settle()
    // Root: three placeholders while block 0 is in flight, and nothing else.
    expect(kinds(view!.displayRows)).toEqual(['placeholder', 'placeholder', 'placeholder'])
    expect(view!.loading).toBe(true)
    expect(rowPlaceholderState(view!.gridRows[0])).toBe('loading')

    await be.releaseAll()
    expect(kinds(view!.displayRows)).toEqual(['group', 'group'])
    expect(view!.loading).toBe(false)
    ctl.dispose()
  })

  it('sizes an opened group from childCount before any of it has loaded', async () => {
    const be = backend({ hold: true, perCountry: 50 })
    let view: ReturnType<typeof ctl.getState> | null = null
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['region', 'country'],
      childCount: (r) => (r as unknown as { childCount?: number }).childCount,
      onChange: (s) => (view = s),
    })

    ctl.refresh()
    await be.releaseAll()
    ctl.expandGroup(['EMEA'])
    await settle()
    // EMEA has 2 countries; the group row said so, so the level claims 2 rows
    // (placeholders) straight away instead of the 3-row skeleton default.
    const emea = view!.displayRows[0]!
    expect(emea.kind === 'group' ? emea.childCount : emea.kind).toBe(2)
    expect(ctl.getLevelState(['EMEA'])!.rowCount).toBe(2)
    expect(kinds(view!.displayRows)).toEqual(['group', 'placeholder', 'placeholder', 'group'])
    ctl.dispose()
  })

  it('streams a big group in blocks as the viewport moves through it', async () => {
    const be = backend({ perCountry: 250 })
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['country'],
      blockSize: 100,
      onChange: () => {},
    })

    ctl.refresh()
    await settle()
    ctl.expandGroup(['DE'])
    await settle()
    // Only the first block of DE was primed.
    expect(be.trace()).toEqual(['[]:0-100', '["DE"]:0-100'])

    // Display: DE group at 0, its 250 leaves at 1..250, then FR, JP. Scrolling
    // to display rows 180-200 lands inside DE at leaf offsets 179-199.
    ctl.setViewport(180, 200)
    await settle()
    expect(be.trace()).toEqual(['[]:0-100', '["DE"]:0-100', '["DE"]:100-200'])

    const state = ctl.getState()
    expect(state.displayRows).toHaveLength(1 + 250 + 2)
    expect(kinds(state.displayRows.slice(0, 2))).toEqual(['group', 'leaf'])
    // Beyond block 1 of DE the rows are still placeholders.
    expect(state.displayRows[240]!.kind).toBe('placeholder')
    ctl.dispose()
  })

  it('applies one concurrency cap across every level', async () => {
    const be = backend({ hold: true, perCountry: 250 })
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['country'],
      blockSize: 50,
      maxConcurrentRequests: 2,
      onChange: () => {},
    })

    ctl.refresh()
    await be.releaseAll()
    ctl.expandGroup(['DE'])
    ctl.expandGroup(['FR'])
    ctl.expandGroup(['JP'])
    await settle()
    // Three groups primed, two slots: the third waits.
    expect(be.log.length).toBe(1 + 2)

    // Answering one frees a slot for it.
    be.log[1]!.release()
    await settle()
    expect(be.log.length).toBe(1 + 3)
    ctl.dispose()
  })

  it('re-fetches only the leaf level when a plain column is sorted', async () => {
    const be = backend()
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['region', 'country'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      onChange: () => {},
    })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['EMEA'])
    await settle()
    ctl.expandGroup(['EMEA', 'DE'])
    await settle()
    const before = be.trace().length

    ctl.setSort([{ id: 'rep', desc: false }])
    await settle()
    // `rep` is neither grouped nor aggregated: the region and country levels
    // keep their order; only the leaves under EMEA/DE reload.
    expect(be.trace().slice(before)).toEqual(['["EMEA","DE"]:0-100'])
    ctl.dispose()
  })

  it('re-fetches a grouped column\'s own level when it is sorted', async () => {
    const be = backend()
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['region', 'country'],
      onChange: () => {},
    })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['EMEA'])
    await settle()
    const before = be.trace().length

    ctl.setSort([{ id: 'country', desc: true }])
    await settle()
    expect(be.trace().slice(before)).toEqual(['["EMEA"]:0-100'])
    ctl.dispose()
  })

  it('re-fetches everything when an aggregated column is sorted', async () => {
    const be = backend()
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['region', 'country'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      onChange: () => {},
    })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['EMEA'])
    await settle()
    const before = be.trace().length

    ctl.setSort([{ id: 'amount', desc: true }])
    await settle()
    expect(be.trace().slice(before).sort()).toEqual(['["EMEA"]:0-100', '[]:0-100'])
    ctl.dispose()
  })

  it('sorts a fully loaded level locally when asked to', async () => {
    const be = backend({ perCountry: 5 })
    let view: ReturnType<typeof ctl.getState> | null = null
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['country'],
      clientSideSort: true,
      onChange: (s) => (view = s),
    })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['DE'])
    await settle()
    const before = be.trace().length
    const repsBefore = view!.displayRows.filter((r) => r.kind === 'leaf').map((r) => (r as { data: Sale }).data.rep)

    ctl.setSort([{ id: 'rep', desc: true }])
    await settle()
    // DE has 5 leaves, all loaded: no request, and they are re-ordered.
    expect(be.trace().length).toBe(before)
    const repsAfter = view!.displayRows.filter((r) => r.kind === 'leaf').map((r) => (r as { data: Sale }).data.rep)
    expect(repsAfter).toEqual([...repsBefore].sort().reverse())
    ctl.dispose()
  })

  it('reloads everything on a filter change, keeping what was open', async () => {
    const be = backend()
    let view: ReturnType<typeof ctl.getState> | null = null
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['region'],
      onChange: (s) => (view = s),
    })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['EMEA'])
    await settle()

    ctl.setFilter({ global: 'rep1' })
    await settle()
    const last = be.log.at(-1)!.req
    expect(last.filterModel.global).toBe('rep1')
    // EMEA is still open after the reload.
    expect(view!.expandedGroups).toEqual(['["EMEA"]'])
    expect(kinds(view!.displayRows.slice(0, 2))).toEqual(['group', 'leaf'])
    ctl.dispose()
  })

  it('accepts the grid\'s own filter payload', async () => {
    const be = backend()
    const ctl = createServerRowModel<Sale>(be.source, { groupBy: ['region'], onChange: () => {} })
    ctl.refresh()
    await settle()

    ctl.setFilter({ global: 'x', columns: [{ id: 'rep', operator: 'contains', value: 'rep1' }] })
    await settle()
    expect(be.log.at(-1)!.req.filterModel).toEqual({
      global: 'x',
      columns: { rep: { operator: 'contains', value: 'rep1' } },
    })
    ctl.dispose()
  })

  it('refresh reloads a level in place and purge starts it over', async () => {
    const be = backend()
    const refreshed: string[][] = []
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['region', 'country'],
      onChange: () => {},
      onStoreRefreshed: (route) => refreshed.push(route),
    })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['EMEA'])
    await settle()
    ctl.expandGroup(['EMEA', 'DE'])
    await settle()
    const before = be.trace().length

    // Refresh EMEA: only its direct children reload, DE stays open and loaded.
    ctl.refresh({ route: ['EMEA'] })
    await settle()
    expect(be.trace().slice(before)).toEqual(['["EMEA"]:0-100'])
    expect(refreshed).toEqual([['EMEA']])
    expect(ctl.isExpanded(['EMEA', 'DE'])).toBe(true)
    expect(ctl.getLevelState(['EMEA', 'DE'])!.rowCount).toBe(250)

    // Purge EMEA: the subtree is dropped and rebuilt; DE, still expanded,
    // reloads from scratch too.
    const b2 = be.trace().length
    ctl.refresh({ route: ['EMEA'], purge: true })
    await settle()
    expect(be.trace().slice(b2).sort()).toEqual(['["EMEA","DE"]:0-100', '["EMEA"]:0-100'])
    ctl.dispose()
  })

  it('marks a failed block, reports it, and recovers on retryLoads', async () => {
    const be = backend({ hold: true })
    const errors: string[][] = []
    let view: ReturnType<typeof ctl.getState> | null = null
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['region'],
      onChange: (s) => (view = s),
      onLoadError: (route) => errors.push(route),
    })
    ctl.refresh()
    await settle()
    be.log[0]!.fail()
    await settle()

    expect(errors).toEqual([[]])
    expect(view!.error).toBeInstanceOf(Error)
    expect(rowPlaceholderState(view!.gridRows[0])).toBe('failed')
    expect(ctl.getLevelState([])!.failedBlocks).toEqual([0])

    ctl.retryLoads()
    await settle()
    be.log[1]!.release()
    await settle()
    expect(view!.error).toBeNull()
    expect(kinds(view!.displayRows)).toEqual(['group', 'group'])
    ctl.dispose()
  })

  it('opens groups by default and only once each', async () => {
    const be = backend()
    const opened: string[][] = []
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['region', 'country'],
      isGroupOpenByDefault: (route) => route[0] === 'EMEA',
      onChange: () => {},
      onGroupOpened: (r) => opened.push(r),
    })
    ctl.refresh()
    await settle()
    // EMEA opened itself; its countries then arrived and opened themselves.
    expect(opened).toEqual([['EMEA'], ['EMEA', 'DE'], ['EMEA', 'FR']])

    // The user closes EMEA and reloads the root; it must not pop open again.
    ctl.collapseGroup(['EMEA'])
    ctl.refresh()
    await settle()
    expect(ctl.isExpanded(['EMEA'])).toBe(false)
    ctl.dispose()
  })

  it('expandAll opens what is loaded, and with includeUnloaded what arrives later', async () => {
    const be = backend()
    const ctl = createServerRowModel<Sale>(be.source, { groupBy: ['region', 'country'], onChange: () => {} })
    ctl.refresh()
    await settle()

    ctl.expandAll()
    await settle()
    expect(ctl.isExpanded(['EMEA'])).toBe(true)
    expect(ctl.isExpanded(['APAC'])).toBe(true)
    // Their countries loaded after the call, so they stayed closed.
    expect(ctl.isExpanded(['EMEA', 'DE'])).toBe(false)

    ctl.collapseAll()
    ctl.expandAll({ includeUnloaded: true })
    await settle()
    expect(ctl.isExpanded(['EMEA', 'DE'])).toBe(true)
    expect(ctl.isExpanded(['APAC', 'JP'])).toBe(true)

    ctl.collapseAll()
    expect(ctl.getState().expandedGroups).toEqual([])
    ctl.dispose()
  })

  it('asks for the grand total once and shows it where configured', async () => {
    const be = backend({ grandTotal: true })
    let view: ReturnType<typeof ctl.getState> | null = null
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['region'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      grandTotalRow: 'bottom',
      onChange: (s) => (view = s),
    })
    ctl.refresh()
    await settle()
    expect(be.log[0]!.req.needsGrandTotal).toBe(true)
    expect(view!.displayRows.at(-1)!.kind).toBe('grandTotal')
    expect((view!.displayRows.at(-1) as { id: string }).id).toBe(GRAND_TOTAL_ROW_ID)

    // A second root request (a sort) does not ask again: the total is cached.
    ctl.setSort([{ id: 'amount', desc: true }])
    await settle()
    expect(be.log.at(-1)!.req.needsGrandTotal).toBeUndefined()
    ctl.dispose()
  })

  it('hands a pinned grand total to the grid instead of the list', async () => {
    const be = backend({ grandTotal: true })
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['region'],
      aggregations: [{ col: 'amount', fn: 'sum' }],
      grandTotalRow: 'pinnedBottom',
      onChange: () => {},
    })
    ctl.refresh()
    await settle()
    expect(ctl.getState().displayRows.some((r) => r.kind === 'grandTotal')).toBe(false)
    expect(ctl.pinnedBottomRows).toHaveLength(1)
    expect(ctl.pinnedTopRows).toBeUndefined()
    // The pinned row is formatted from the column accessor, so the group
    // column's text has to come from a `fieldFn`; this is what it returns.
    expect(serverGroupText(ctl.pinnedBottomRows![0]!)).toBe('Grand total')
    ctl.dispose()
  })

  it('gives the group column one text per row kind', async () => {
    const be = backend({ perCountry: 3 })
    let view: ReturnType<typeof ctl.getState> | null = null
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['region', 'country'],
      groupFooters: true,
      levelParams: () => ({ infinite: false }),
      onChange: (s) => (view = s),
    })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['APAC'])
    await settle()
    ctl.expandGroup(['APAC', 'JP'])
    await settle()
    const texts = view!.gridRows.map((r) => `${r.__group.kind}:${serverGroupText(r, 'rep')}`)
    expect(texts).toEqual([
      'group:EMEA',
      'group:APAC',
      'group:JP',
      'leaf:rep6',
      'leaf:rep0',
      'leaf:rep1',
      'footer:Total',
      'footer:Total',
    ])
    // Without a leaf field a leaf reads as nothing, the way the cell draws it.
    expect(serverGroupText(view!.gridRows[3]!)).toBe('')
    ctl.dispose()
  })

  it('emits a subtotal footer with a stable, addressable id', async () => {
    const be = backend()
    let view: ReturnType<typeof ctl.getState> | null = null
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['region'],
      groupFooters: true,
      onChange: (s) => (view = s),
    })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['APAC'])
    await settle()
    const footer = view!.displayRows.find((r) => r.kind === 'footer') as { id: string }
    expect(footer.id).toBe(GROUP_TOTAL_ROW_ID_PREFIX + '["APAC"]')
    ctl.dispose()
  })

  it('applyRowData fills a level without a request', async () => {
    const be = backend()
    let view: ReturnType<typeof ctl.getState> | null = null
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['region'],
      onChange: (s) => (view = s),
    })
    ctl.applyRowData({
      rows: [{ region: 'PUSHED', amount: 1 } as unknown as Sale],
      rowCount: 1,
    })
    await settle()
    expect(be.trace()).toEqual([])
    expect(view!.displayRows.map((r) => ('key' in r ? r.key : r.kind))).toEqual(['PUSHED'])
    ctl.dispose()
  })

  it('loads a non-infinite level completely and keeps a debug log', async () => {
    const be = backend({ perCountry: 250 })
    const dbg = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const ctl = createServerRowModel<Sale>(be.source, {
      groupBy: ['country'],
      blockSize: 100,
      levelParams: (level) => (level === 1 ? { infinite: false } : {}),
      debug: true,
      onChange: () => {},
    })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['DE'])
    await settle()
    await settle()
    // All three blocks of DE loaded, with no viewport ever reported.
    expect(be.trace().filter((t) => t.startsWith('["DE"]'))).toEqual([
      '["DE"]:0-100',
      '["DE"]:100-200',
      '["DE"]:200-300',
    ])
    expect(dbg.mock.calls.some((c) => String(c[0]).includes('["DE"] block 2: loaded'))).toBe(true)
    dbg.mockRestore()
    ctl.dispose()
  })

  it('walks a self-referential tree by row id', async () => {
    type Node = { id: string; name: string; parent: string | null; leaf: boolean }
    const NODES: Node[] = [
      { id: 'r1', name: 'Root', parent: null, leaf: false },
      { id: 'c1', name: 'Child', parent: 'r1', leaf: false },
      { id: 'g1', name: 'Grandchild', parent: 'c1', leaf: true },
    ]
    const source: ServerDataSource<Node> = {
      async getRows(req) {
        const parent = (req.groupKeys ?? []).at(-1) ?? null
        const rows = NODES.filter((n) => n.parent === parent)
        return { rows, rowCount: rows.length }
      },
    }
    let view: ReturnType<typeof ctl.getState> | null = null
    const ctl = createServerRowModel<Node>(source, {
      treeData: true,
      getRowId: (r) => r.id,
      hasChildren: (r) => !r.leaf,
      onChange: (s) => (view = s),
    })
    ctl.refresh()
    await settle()
    ctl.expandGroup(['r1'])
    await settle()
    ctl.expandGroup(['r1', 'c1'])
    await settle()
    expect(view!.displayRows.map((r) => ('id' in r ? r.id : r.kind))).toEqual([
      '["r1"]',
      '["r1","c1"]',
      '["r1","c1"]:g1',
    ])
    // A node's key is its id; the label the cell shows is the leaf field.
    expect(view!.gridRows.map((r) => serverGroupText(r, 'name'))).toEqual(['Root', 'Child', 'Grandchild'])
    expect(serverGroupText(view!.gridRows[0]!)).toBe('r1')
    ctl.dispose()
  })

  it('is a GridRowModel', async () => {
    const be = backend()
    const ctl = createServerRowModel<Sale>(be.source, { groupBy: ['region'], onChange: () => {} })
    let notified = 0
    const off = ctl.subscribe(() => (notified += 1))
    ctl.refresh()
    await settle()
    expect(notified).toBeGreaterThan(0)
    expect(ctl.getRows()).toHaveLength(2)
    expect(ctl.isLoading()).toBe(false)
    expect(ctl.getRowId!(ctl.getRows()[0]!, 0)).toBe('["EMEA"]')
    expect(ctl.group!.isGroup(ctl.getRows()[0]!)).toBe(true)
    // Toggling through the group accessor is what the grid's keyboard does.
    ctl.group!.onToggle(ctl.getRows()[0]!)
    await settle()
    expect(ctl.isExpanded(['EMEA'])).toBe(true)
    off()
    ctl.dispose()
  })

  it('closes the source on dispose', () => {
    const destroy = vi.fn()
    const ctl = createServerRowModel<Sale>(
      { async getRows() { return { rows: [], rowCount: 0 } }, destroy },
      { onChange: () => {} },
    )
    ctl.dispose()
    expect(destroy).toHaveBeenCalledTimes(1)
  })
})
