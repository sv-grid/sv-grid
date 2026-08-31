/**
 * The dev-time config checks. The bar for each rule is two-sided: it must fire
 * on the broken config AND stay silent on every valid shape near it, because a
 * warning people learn to ignore is worse than no warning.
 */
import { describe, expect, it } from 'vitest'
import { validateGridConfig } from './validate'

type Row = { name: string; amount: number }
const data: Row[] = [
  { name: 'Ada', amount: 100 },
  { name: 'Grace', amount: 200 },
]

const run = (over: Partial<Parameters<typeof validateGridConfig>[0]> = {}) =>
  validateGridConfig({
    data,
    columns: [{ field: 'name' }, { field: 'amount' }],
    ...over,
  } as any)

describe('unknown field', () => {
  it('flags a field that is not on the data', () => {
    const msgs = run({ columns: [{ field: 'naem' }, { field: 'amount' }] })
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toContain('"naem" does not exist')
  })

  it('suggests the near miss', () => {
    expect(run({ columns: [{ field: 'naem' }] })[0]).toContain('Did you mean "name"')
  })

  it('does not guess when nothing is close', () => {
    const msg = run({ columns: [{ field: 'zzzzzzzzz' }] })[0]!
    expect(msg).toContain('does not exist')
    expect(msg).not.toContain('Did you mean')
  })

  it('stays silent on valid fields', () => {
    expect(run()).toEqual([])
  })

  it('ignores a computed column', () => {
    expect(run({ columns: [{ id: 'full', fieldFn: (r: unknown) => (r as Row).name }] })).toEqual([])
  })

  it('ignores an id-only column, like an actions column', () => {
    expect(run({ columns: [{ id: 'actions', header: '' }] })).toEqual([])
  })

  it('looks through group columns', () => {
    const msgs = run({ columns: [{ header: 'Group', columns: [{ field: 'nope' }] }] })
    expect(msgs[0]).toContain('"nope" does not exist')
  })

  it('tolerates sparse data - a key missing from the first row but present later', () => {
    const sparse = [{ name: 'Ada' }, { name: 'Grace', amount: 200 }] as Row[]
    expect(run({ data: sparse, columns: [{ field: 'amount' }] })).toEqual([])
  })

  it('says nothing when there is no data to check against', () => {
    expect(run({ data: [], columns: [{ field: 'whatever' }] })).toEqual([])
  })
})

describe('duplicate ids', () => {
  it('flags two columns resolving to the same id', () => {
    const msgs = run({ columns: [{ field: 'name' }, { field: 'name' }] })
    expect(msgs.some((m) => m.includes('share the id "name"'))).toBe(true)
  })

  it('is happy when a duplicate field carries a distinct id', () => {
    const msgs = run({
      columns: [{ field: 'name' }, { id: 'name2', field: 'name' }],
    })
    expect(msgs.some((m) => m.includes('share the id'))).toBe(false)
  })
})

describe('inert pageSize', () => {
  it('flags pageSize when pagination was never mentioned', () => {
    expect(run({ pageSize: 25 })[0]).toContain('pagination was never turned on')
  })

  it('is silent with pageable', () => {
    expect(run({ pageSize: 25, pageable: true })).toEqual([])
  })

  it('is silent with showPagination', () => {
    expect(run({ pageSize: 25, showPagination: true })).toEqual([])
  })

  it('is silent when pagination is deliberately off', () => {
    // A bound toggle starting false - our own shortcut-config demo does this,
    // and warning on it was noise, not a finding.
    expect(run({ pageSize: 25, pageable: false })).toEqual([])
    expect(run({ pageSize: 25, showPagination: false })).toEqual([])
  })
})

describe('column sortable without sorting', () => {
  const columns = [{ field: 'name', sortable: true }]

  it('flags it when nothing enables sorting', () => {
    expect(run({ columns })[0]).toContain('sorting is not enabled')
  })

  it('is silent when the grid shortcut is on', () => {
    expect(run({ columns, sortable: true })).toEqual([])
  })

  it('is silent when the feature is registered explicitly', () => {
    expect(run({ columns, features: { rowSortingFeature: {} } })).toEqual([])
  })
})

describe('column ids referenced by other props', () => {
  it('flags a groupBy naming a column that does not exist', () => {
    const msg = run({ groupBy: ['naem'] })[0]!
    expect(msg).toContain('`groupBy` refers to column "naem"')
    expect(msg).toContain('Did you mean "name"')
  })

  it('is silent for a groupBy that matches', () => {
    expect(run({ groupBy: ['name'] })).toEqual([])
  })

  it('flags a treeData.column that does not exist', () => {
    expect(run({ treeData: { parentField: 'name', column: 'nope' } })[0]).toContain(
      '`treeData.column` refers to column "nope"',
    )
  })
})

describe('treeData fields', () => {
  it('flags a parentField that is not on the data', () => {
    const msg = run({ treeData: { parentField: 'managerId' } })[0]!
    expect(msg).toContain('`treeData.parentField` is "managerId"')
    expect(msg).toContain('every row becomes a root')
  })

  it('flags an explicit idField that is not on the data', () => {
    const msgs = run({ treeData: { parentField: 'name', idField: 'uid' } })
    expect(msgs.some((m) => m.includes('`treeData.idField` is "uid"'))).toBe(true)
  })

  it('does not complain about the default idField', () => {
    // `idField` defaults to 'id', which this fixture does not have - guessing
    // about a default the user never wrote would be a false positive.
    expect(run({ treeData: { parentField: 'name' } })).toEqual([])
  })
})

describe('pinning versus column virtualization', () => {
  it('flags pinning while column virtualization is on by default', () => {
    const msg = run({ initialColumnPinning: { left: ['name'] } })[0]!
    expect(msg).toContain('will not stick')
    expect(msg).toContain('columnVirtualization={false}')
  })

  it('is silent once column virtualization is off', () => {
    expect(
      run({ initialColumnPinning: { left: ['name'] }, columnVirtualization: false }),
    ).toEqual([])
  })

  it('is silent when nothing is pinned', () => {
    expect(run({ initialColumnPinning: { left: [] } })).toEqual([])
  })
})

describe('server-mode contracts', () => {
  it('flags externalPagination without rowCount', () => {
    expect(run({ externalPagination: true })[0]).toContain('`rowCount` is not set')
  })

  it('is silent when rowCount is supplied', () => {
    expect(run({ externalPagination: true, rowCount: 500 })).toEqual([])
  })

  it('flags externalSort with no handler', () => {
    expect(run({ externalSort: true })[0]).toContain('no `onSortingChange` handler')
  })

  it('is silent when the sort handler is wired', () => {
    expect(run({ externalSort: true, onSortingChange: () => {} })).toEqual([])
  })

  it('flags externalFilter with no handler', () => {
    expect(run({ externalFilter: true })[0]).toContain('no `onFiltersChange` handler')
  })

  it('is silent when the filter handler is wired', () => {
    expect(run({ externalFilter: true, onFiltersChange: () => {} })).toEqual([])
  })
})

describe('cost', () => {
  it('samples the data rather than scanning it', () => {
    // 100k rows must not cost 100k key reads: the check is capped at a fixed
    // sample, so this returns immediately.
    const many = Array.from({ length: 100_000 }, (_, i) => ({ name: 'n' + i, amount: i }))
    const started = Date.now()
    expect(run({ data: many })).toEqual([])
    expect(Date.now() - started).toBeLessThan(200)
  })
})
