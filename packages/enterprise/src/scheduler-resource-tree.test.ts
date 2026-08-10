import { describe, expect, it } from 'vitest'
import { buildResourceRows, visibleResourceIds, type SchedulerResourceGroup } from './scheduler-resource-tree'

type Res = { id: string; title?: string; group?: string }
const groupOf = (r: Res) => r.group

const groups: SchedulerResourceGroup[] = [
  { id: 'clinic', title: 'Clinic' },
  { id: 'cardio', title: 'Cardiology', parentId: 'clinic' },
  { id: 'derm', title: 'Dermatology', parentId: 'clinic' },
]
const resources: Res[] = [
  { id: 'dr-a', title: 'Dr A', group: 'cardio' },
  { id: 'dr-b', title: 'Dr B', group: 'cardio' },
  { id: 'dr-c', title: 'Dr C', group: 'derm' },
]

describe('buildResourceRows', () => {
  it('nests groups and interleaves resources in tree order', () => {
    const rows = buildResourceRows(resources, groups, groupOf)
    expect(rows.map((r) => `${r.kind}:${r.id}@${r.depth}`)).toEqual([
      'group:clinic@0',
      'group:cardio@1',
      'resource:dr-a@2',
      'resource:dr-b@2',
      'group:derm@1',
      'resource:dr-c@2',
    ])
  })

  it('computes childResourceIds (roll-up) for each group subtree', () => {
    const rows = buildResourceRows(resources, groups, groupOf)
    const byId = Object.fromEntries(rows.filter((r) => r.kind === 'group').map((r) => [r.id, r.childResourceIds]))
    expect(byId.clinic).toEqual(['dr-a', 'dr-b', 'dr-c'])
    expect(byId.cardio).toEqual(['dr-a', 'dr-b'])
    expect(byId.derm).toEqual(['dr-c'])
  })

  it('collapsing a group hides its subtree but keeps the header', () => {
    const rows = buildResourceRows(resources, groups, groupOf, new Set(['cardio']))
    expect(rows.map((r) => `${r.kind}:${r.id}`)).toEqual([
      'group:clinic',
      'group:cardio', // header stays
      // dr-a, dr-b hidden
      'group:derm',
      'resource:dr-c',
    ])
    expect(rows.find((r) => r.id === 'cardio')?.collapsed).toBe(true)
  })

  it('collapsing an ancestor hides all descendants', () => {
    const rows = buildResourceRows(resources, groups, groupOf, new Set(['clinic']))
    expect(rows.map((r) => r.id)).toEqual(['clinic'])
  })

  it('puts ungrouped / unknown-group resources in a trailing section (no header)', () => {
    const res: Res[] = [{ id: 'x', group: 'cardio' }, { id: 'y' }, { id: 'z', group: 'nope' }]
    const rows = buildResourceRows(res, groups, groupOf)
    const last2 = rows.slice(-2).map((r) => `${r.kind}:${r.id}@${r.depth}`)
    expect(last2).toEqual(['resource:y@0', 'resource:z@0'])
  })

  it('treats a group with an unknown parent as a root', () => {
    const g: SchedulerResourceGroup[] = [{ id: 'a', title: 'A', parentId: 'ghost' }]
    const rows = buildResourceRows([{ id: 'r', group: 'a' }], g, groupOf)
    expect(rows[0]).toMatchObject({ kind: 'group', id: 'a', depth: 0 })
  })

  it('does not loop on a cyclic parent chain', () => {
    const g: SchedulerResourceGroup[] = [
      { id: 'a', title: 'A', parentId: 'b' },
      { id: 'b', title: 'B', parentId: 'a' },
    ]
    const rows = buildResourceRows([{ id: 'r', group: 'a' }], g, groupOf)
    // Should terminate; both groups appear at most once.
    expect(rows.filter((r) => r.id === 'a').length).toBeLessThanOrEqual(1)
    expect(rows.filter((r) => r.id === 'b').length).toBeLessThanOrEqual(1)
  })

  it('visibleResourceIds returns leaf resources in order', () => {
    const rows = buildResourceRows(resources, groups, groupOf)
    expect(visibleResourceIds(rows)).toEqual(['dr-a', 'dr-b', 'dr-c'])
  })
})
