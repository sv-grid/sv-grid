import { describe, expect, it } from 'vitest'
import { buildDisplayRows, isDetailRow, toggleExpanded } from './master-detail'

type Order = { id: string; customer: string }
const orders: Order[] = [
  { id: 'o1', customer: 'Ann' },
  { id: 'o2', customer: 'Bob' },
  { id: 'o3', customer: 'Cara' },
]
const idOf = (o: Order) => o.id

describe('toggleExpanded', () => {
  it('adds then removes an id, immutably', () => {
    const a = toggleExpanded(new Set(), 'o1')
    expect([...a]).toEqual(['o1'])
    const b = toggleExpanded(a, 'o1')
    expect([...b]).toEqual([])
    expect([...a]).toEqual(['o1']) // original untouched
  })
})

describe('isDetailRow', () => {
  it('distinguishes detail markers from plain rows', () => {
    expect(isDetailRow({ __svgridDetail: true, parent: {}, parentId: 'x' })).toBe(true)
    expect(isDetailRow({ id: 'o1' })).toBe(false)
    expect(isDetailRow(null)).toBe(false)
  })
})

describe('buildDisplayRows', () => {
  it('returns just the parents when nothing is expanded', () => {
    const rows = buildDisplayRows(orders, new Set(), idOf)
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => !isDetailRow(r))).toBe(true)
  })

  it('inserts a detail row right after each expanded parent, preserving order', () => {
    const rows = buildDisplayRows(orders, new Set(['o2']), idOf)
    expect(rows).toHaveLength(4)
    expect(isDetailRow(rows[2])).toBe(true) // after o2
    const detail = rows[2]
    if (isDetailRow(detail)) {
      expect(detail.parentId).toBe('o2')
      expect((detail.parent as Order).customer).toBe('Bob')
    }
    // surrounding parents intact
    expect((rows[1] as Order).id).toBe('o2')
    expect((rows[3] as Order).id).toBe('o3')
  })

  it('handles multiple expanded parents', () => {
    const rows = buildDisplayRows(orders, new Set(['o1', 'o3']), idOf)
    expect(rows.map((r) => (isDetailRow(r) ? 'detail' : (r as Order).id))).toEqual([
      'o1',
      'detail',
      'o2',
      'o3',
      'detail',
    ])
  })
})
