import { describe, expect, it } from 'vitest'
import { computeColumnGroupMeta, hiddenLeavesForCollapse } from './column-groups'

// A group "Q1" with an always-on Total plus Jan/Feb that only show when open.
const columns = [
  { field: 'name' },
  {
    id: 'q1',
    header: 'Q1',
    columns: [
      { field: 'q1Total' },
      { field: 'jan', columnGroupShow: 'open' },
      { field: 'feb', columnGroupShow: 'open' },
    ],
  },
  {
    id: 'q2',
    header: 'Q2',
    openByDefault: true,
    columns: [
      { field: 'q2Total', columnGroupShow: 'closed' },
      { field: 'apr', columnGroupShow: 'open' },
    ],
  },
]

describe('computeColumnGroupMeta', () => {
  it('marks groups with columnGroupShow children as collapsible', () => {
    const meta = computeColumnGroupMeta(columns)
    expect([...meta.collapsibleGroupIds].sort()).toEqual(['q1', 'q2'])
    expect(meta.defaultOpen.get('q1')).toBe(false)
    expect(meta.defaultOpen.get('q2')).toBe(true)
  })
  it('maps controlled leaves to their group + show mode', () => {
    const meta = computeColumnGroupMeta(columns)
    expect(meta.leafControl.get('jan')).toEqual({ groupId: 'q1', show: 'open' })
    expect(meta.leafControl.get('q2Total')).toEqual({ groupId: 'q2', show: 'closed' })
    // untagged always-on column is not controlled
    expect(meta.leafControl.has('q1Total')).toBe(false)
    expect(meta.leafControl.has('name')).toBe(false)
  })
})

describe('hiddenLeavesForCollapse', () => {
  const meta = computeColumnGroupMeta(columns)
  it('hides open-columns while collapsed, shows them while expanded', () => {
    const collapsed = new Set(['q1'])
    const hidden = hiddenLeavesForCollapse(meta, collapsed)
    expect(hidden.jan).toBe(true)
    expect(hidden.feb).toBe(true)
    expect(hidden.q1Total).toBeUndefined() // always on
  })
  it('hides closed-columns while expanded', () => {
    const collapsed = new Set<string>() // q2 expanded
    const hidden = hiddenLeavesForCollapse(meta, collapsed)
    expect(hidden.q2Total).toBe(true) // 'closed' hides when expanded
    expect(hidden.apr).toBeUndefined() // 'open' shows when expanded
  })
})
