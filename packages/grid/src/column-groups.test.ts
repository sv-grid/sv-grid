import { describe, expect, it } from 'vitest'
import { computeColumnGroupMeta, hiddenLeavesForCollapse } from './column-groups'
import { resolveColumnId } from './column-id'

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

// ---------------------------------------------------------------------------
// Id agreement with the engine
// ---------------------------------------------------------------------------

describe('unnamed columns', () => {
  // Columns with neither `id` nor `field` get an id synthesized from their
  // position. The engine, this module, and the group-header derivation all
  // have to synthesize the SAME one - they used to disagree (`q1_d_1` here vs
  // `q1_1_1` in the engine), so `columnGroupShow` on an unnamed column looked
  // wired up but never actually hid anything.
  const unnamed = [
    { field: 'name' },
    {
      id: 'q1',
      header: 'Q1',
      columns: [
        { field: 'jan', columnGroupShow: 'open' },
        { header: 'Closed', columnGroupShow: 'closed' },
        { header: 'Always' },
      ],
    },
  ]

  it('keys leafControl by the id the engine assigns', () => {
    const meta = computeColumnGroupMeta(unnamed)
    // `<parentId>_<depth>_<index>`: depth 1 under "q1", index 1 in its siblings.
    expect(meta.leafControl.has('q1_1_1')).toBe(true)
    expect(meta.leafControl.get('q1_1_1')).toEqual({ groupId: 'q1', show: 'closed' })
    // The untagged sibling is not controlled, and no stale `_d_` key survives.
    expect(meta.leafControl.has('q1_1_2')).toBe(false)
    expect([...meta.leafControl.keys()].some((k) => k.includes('_d_'))).toBe(false)
  })

  it('hides an unnamed closed-mode leaf once the group is expanded', () => {
    const meta = computeColumnGroupMeta(unnamed)
    expect(hiddenLeavesForCollapse(meta, new Set<string>())).toEqual({ q1_1_1: true })
    expect(hiddenLeavesForCollapse(meta, new Set(['q1']))).toEqual({ jan: true })
  })

  it('matches resolveColumnId at every depth', () => {
    expect(resolveColumnId({ field: 'jan' }, 'q1', 1, 0)).toBe('jan')
    expect(resolveColumnId({ id: 'q1' }, undefined, 0, 1)).toBe('q1')
    expect(resolveColumnId({ header: 'X' }, 'q1', 1, 2)).toBe('q1_1_2')
    expect(resolveColumnId({ header: 'X' }, undefined, 0, 3)).toBe('col_0_3')
  })
})
