// @vitest-environment node
/**
 * The big-data engine checked against brute force: every filter, sort, group
 * and edit answer must equal what a plain array sort / filter gives.
 */
import { describe, expect, it } from 'vitest'
import { createEngine, type EngineRequest } from './engine'
import { cellValue, columnByField } from './data'

const N = 50_000

function brute(req: EngineRequest, edits = new Map<number, Record<string, unknown>>()): number[] {
  let ids = Array.from({ length: N }, (_, i) => i)
  const val = (f: string, r: number) => cellValue(columnByField(f)!, r, edits)
  for (const [field, f] of Object.entries(req.filterModel?.columns ?? {})) {
    if (f.selectedValues) ids = ids.filter((r) => f.selectedValues!.includes(String(val(field, r))))
    else if (f.operator === 'greaterThan') ids = ids.filter((r) => Number(val(field, r)) > Number(f.value))
    else if (f.operator === 'between') ids = ids.filter((r) => Number(val(field, r)) >= Number(f.value) && Number(val(field, r)) <= Number(f.valueTo))
    else if (f.operator === 'startsWith') ids = ids.filter((r) => String(val(field, r)).toLowerCase().startsWith(f.value!.toLowerCase()))
    else ids = ids.filter((r) => String(val(field, r)).toLowerCase().includes(String(f.value).toLowerCase()))
  }
  const keys = req.groupKeys ?? []
  keys.forEach((k, i) => (ids = ids.filter((r) => String(val(req.groupBy![i]!, r)) === k)))
  const sort = req.sortModel ?? []
  ids.sort((a, b) => {
    for (const s of sort) {
      const va = val(s.id, a)
      const vb = val(s.id, b)
      if (va !== vb) return (va! < vb! ? -1 : 1) * (s.desc ? -1 : 1)
    }
    return a - b
  })
  return ids
}

function all(engine: ReturnType<typeof createEngine>, req: Omit<EngineRequest, 'startRow' | 'endRow'>): number[] {
  return engine.getRows({ ...req, startRow: 0, endRow: N }).ids!
}

describe('big-data engine', () => {
  const engine = createEngine()
  engine.configure(N, 40)

  it('serves the identity view without scanning', () => {
    const r = engine.getRows({ startRow: 10, endRow: 13 })
    expect(r.ids).toEqual([10, 11, 12])
    expect(r.rowCount).toBe(N)
    expect(r.op).toBe('identity')
  })

  it('id descending is the reversed identity', () => {
    const r = engine.getRows({ startRow: 0, endRow: 2, sortModel: [{ id: 'id', desc: true }] })
    expect(r.ids).toEqual([N - 1, N - 2])
  })

  for (const sortModel of [
    [{ id: 'balance' }],
    [{ id: 'balance', desc: true }],
    [{ id: 'name' }],
    [{ id: 'country' }, { id: 'balance', desc: true }],
    [{ id: 'status', desc: true }, { id: 'rating' }, { id: 'name' }],
    [{ id: 'total' }],
    [{ id: 'joined', desc: true }],
    [{ id: 'm30' }],
  ]) {
    it(`sorts like brute force: ${JSON.stringify(sortModel)}`, () => {
      expect(all(engine, { sortModel })).toEqual(brute({ startRow: 0, endRow: N, sortModel }))
    })
  }

  it('filters and sorts together', () => {
    const req = {
      filterModel: {
        columns: {
          country: { operator: 'contains', value: '', selectedValues: ['France', 'Japan'] },
          balance: { operator: 'greaterThan', value: '500000' },
          name: { operator: 'startsWith', value: 'ma' },
        },
      },
      sortModel: [{ id: 'balance', desc: true }],
    }
    expect(all(engine, req)).toEqual(brute({ startRow: 0, endRow: N, ...req }))
  })

  it('groups with counts that add up, and leaves under a path', () => {
    const groups = engine.getRows({ startRow: 0, endRow: 100, groupBy: ['continent', 'country'] }).groups!
    expect(groups.reduce((s, g) => s + Number(g.__count), 0)).toBe(N)
    const europe = engine.getRows({ startRow: 0, endRow: 100, groupBy: ['continent', 'country'], groupKeys: ['Europe'] }).groups!
    const france = europe.find((g) => g.country === 'France')!
    const leaves = all(engine, { groupBy: ['continent', 'country'], groupKeys: ['Europe', 'France'] })
    expect(leaves.length).toBe(france.__count)
    expect(leaves).toEqual(brute({ startRow: 0, endRow: N, groupBy: ['continent', 'country'], groupKeys: ['Europe', 'France'] }))
  })

  it('searches every text column with the global filter', () => {
    const r = all(engine, { filterModel: { global: 'kenya' } })
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((id) => cellValue(columnByField('country')!, id) === 'Kenya')).toBe(true)
  })

  it('patches cached views and group totals on an edit', () => {
    const req = { sortModel: [{ id: 'balance' }], filterModel: { columns: { balance: { operator: 'greaterThan', value: '900000' } } } }
    all(engine, req) // build and cache the view
    const groupsBefore = engine.getRows({ startRow: 0, endRow: 10, groupBy: ['status'] }).groups!
    // Pick a row outside the filter and push it to the very top.
    const row = brute({ startRow: 0, endRow: N, filterModel: { columns: { balance: { operator: 'lessThan' as never, value: '1000' } } } })[0] ?? 0
    const patched = engine.updateRow(row, { balance: 999_999, status: 'VIP' })
    expect(patched.patchedViews).toBeGreaterThan(0)
    const edits = new Map([[row, { balance: 999_999, status: 'VIP' }]])
    expect(all(engine, req)).toEqual(brute({ startRow: 0, endRow: N, ...req }, edits))
    const groupsAfter = engine.getRows({ startRow: 0, endRow: 10, groupBy: ['status'] }).groups!
    const vip = (gs: typeof groupsAfter) => Number(gs.find((g) => g.status === 'VIP')!.__count)
    const wasVip = cellValue(columnByField('status')!, row) === 'VIP'
    expect(vip(groupsAfter)).toBe(vip(groupsBefore) + (wasVip ? 0 : 1))
  })
})
