import { describe, expect, it } from 'vitest'
import { createServerSelectionModel } from './server-selection'

describe('createServerSelectionModel (self)', () => {
  it('starts empty, selects individually, and counts exactly', () => {
    const sel = createServerSelectionModel()
    expect(sel.headerState()).toBe('none')
    expect(sel.selectedCount(1_000_000)).toBe(0)

    sel.toggle([], 'a', true)
    sel.toggle(['EMEA'], 'b', true)
    expect(sel.isSelected([], 'a')).toBe(true)
    expect(sel.isSelected(['EMEA'], 'b')).toBe(true)
    expect(sel.isSelected([], 'c')).toBe(false)
    expect(sel.headerState()).toBe('some')
    expect(sel.selectedCount(1_000_000)).toBe(2)
  })

  it('select-all means everything the grid has never seen, minus exceptions', () => {
    const sel = createServerSelectionModel()
    sel.setAll(true)
    expect(sel.headerState()).toBe('all')
    expect(sel.isSelected([], 'never-loaded-row-77')).toBe(true)
    expect(sel.selectedCount(1_000_000)).toBe(1_000_000)
    expect(sel.isSelectAllWithoutExceptions()).toBe(true)

    sel.toggle([], 'x', false)
    expect(sel.isSelected([], 'x')).toBe(false)
    expect(sel.headerState()).toBe('some')
    expect(sel.selectedCount(1_000_000)).toBe(999_999)
    expect(sel.isSelectAllWithoutExceptions()).toBe(false)

    // Re-ticking the exception removes it rather than stacking a second rule.
    sel.toggle([], 'x', true)
    expect(sel.getState()).toEqual({ selectAll: true, toggled: [] })
    expect(sel.headerState()).toBe('all')
  })

  it('reports null for a count it cannot know', () => {
    const sel = createServerSelectionModel()
    sel.setAll(true)
    expect(sel.selectedCount(null)).toBeNull()
  })

  it('round-trips its state as plain data', () => {
    const sel = createServerSelectionModel()
    sel.setAll(true)
    sel.toggle([], 'x', false)
    const state = JSON.parse(JSON.stringify(sel.getState()))

    const again = createServerSelectionModel()
    again.setState(state)
    expect(again.isSelected([], 'x')).toBe(false)
    expect(again.isSelected([], 'y')).toBe(true)
  })

  it('notifies on every change', () => {
    let n = 0
    const sel = createServerSelectionModel({ onChange: () => (n += 1) })
    sel.toggle([], 'a', true)
    sel.setAll(true)
    sel.clear()
    sel.setState({ selectAll: false, toggled: [] })
    expect(n).toBe(4)
  })
})

describe('createServerSelectionModel (descendants)', () => {
  const make = () => createServerSelectionModel({ groupSelects: 'descendants' })

  it('ticking a group selects everything beneath it', () => {
    const sel = make()
    sel.toggle([], 'EMEA', true, true)
    expect(sel.isSelected([], 'EMEA')).toBe(true)
    expect(sel.isSelected(['EMEA'], 'DE')).toBe(true)
    expect(sel.isSelected(['EMEA', 'DE'], 'row-1')).toBe(true)
    expect(sel.isSelected([], 'APAC')).toBe(false)
    expect(sel.isSelected(['APAC'], 'JP')).toBe(false)
    expect(sel.headerState()).toBe('some')
  })

  it('records an exception inside a selected group under that group', () => {
    const sel = make()
    sel.toggle([], 'EMEA', true, true)
    sel.toggle(['EMEA'], 'DE', false, true)
    expect(sel.isSelected(['EMEA'], 'DE')).toBe(false)
    expect(sel.isSelected(['EMEA', 'DE'], 'row-1')).toBe(false)
    expect(sel.isSelected(['EMEA'], 'FR')).toBe(true)
    expect(sel.getState()).toEqual({
      selectAllChildren: false,
      group: true,
      toggled: {
        EMEA: { selectAllChildren: true, toggled: { DE: { selectAllChildren: false, toggled: {}, group: true } }, group: true },
      },
    })
  })

  it('select-all with a group exception reads as the tree it describes', () => {
    const sel = make()
    sel.setAll(true)
    sel.toggle([], 'EMEA', false, true)
    sel.toggle(['EMEA'], 'DE', true, true)
    expect(sel.isSelected([], 'APAC')).toBe(true)
    expect(sel.isSelected(['APAC'], 'JP')).toBe(true)
    expect(sel.isSelected([], 'EMEA')).toBe(false)
    expect(sel.isSelected(['EMEA'], 'FR')).toBe(false)
    expect(sel.isSelected(['EMEA'], 'DE')).toBe(true)
    expect(sel.isSelected(['EMEA', 'DE'], 'row-9')).toBe(true)
    expect(sel.headerState()).toBe('some')
  })

  it('re-ticking a group throws away the exceptions beneath it', () => {
    const sel = make()
    sel.toggle([], 'EMEA', true, true)
    sel.toggle(['EMEA'], 'DE', false, true)
    sel.toggle([], 'EMEA', false, true)
    sel.toggle([], 'EMEA', true, true)
    expect(sel.isSelected(['EMEA'], 'DE')).toBe(true)
  })

  it('keeps the state minimal: a row set back to its parent\'s state is dropped', () => {
    const sel = make()
    sel.toggle(['EMEA'], 'DE', true, true)
    sel.toggle(['EMEA'], 'DE', false, true)
    expect(sel.getState()).toEqual({ selectAllChildren: false, toggled: {}, group: true })
    expect(sel.headerState()).toBe('none')
  })

  it('counts exactly only while no group of unknown size is an exception', () => {
    const sel = make()
    sel.toggle(['EMEA'], 'row-1', true)
    sel.toggle(['EMEA'], 'row-2', true)
    // Two leaf exceptions under EMEA: EMEA itself is a pass-through node.
    expect(sel.selectedCount(1000)).toBe(2)

    sel.setAll(true)
    expect(sel.selectedCount(1000)).toBe(1000)
    sel.toggle([], 'row-x', false)
    expect(sel.selectedCount(1000)).toBe(999)

    // A whole group excepted: its size is not known here.
    sel.toggle([], 'EMEA', false, true)
    expect(sel.selectedCount(1000)).toBeNull()
  })

  it('counts a flipped group when its leaf count is known', () => {
    // EMEA holds 300 leaves, APAC 200; the source of that is the group
    // row's count aggregate, which the row model hands in as leafCount.
    const sizes: Record<string, number> = { EMEA: 300, APAC: 200 }
    const sel = createServerSelectionModel({
      groupSelects: 'descendants',
      leafCount: (route) => (route.length === 1 ? (sizes[route[0]!] ?? null) : null),
    })
    // One plan ticked under an unticked root.
    sel.toggle([], 'EMEA', true, true)
    expect(sel.selectedCount(1000)).toBe(300)
    // Two of its leaves unticked again.
    sel.toggle(['EMEA'], 'row-1', false)
    sel.toggle(['EMEA'], 'row-2', false)
    expect(sel.selectedCount(1000)).toBe(298)
    // Everything, minus APAC, minus one leaf elsewhere: 1000 - 200 - 1.
    sel.setAll(true)
    sel.toggle([], 'APAC', false, true)
    sel.toggle([], 'row-x', false)
    expect(sel.selectedCount(1000)).toBe(799)
    // A group nobody can size keeps the answer unknown.
    sel.toggle([], 'LATAM', false, true)
    expect(sel.selectedCount(1000)).toBeNull()
  })

  it('accepts filteredDescendants as the same rule', () => {
    const sel = createServerSelectionModel({ groupSelects: 'filteredDescendants' })
    sel.toggle([], 'EMEA', true, true)
    expect(sel.isSelected(['EMEA', 'DE'], 'row-1')).toBe(true)
  })

  it('round-trips the tree as plain data', () => {
    const sel = make()
    sel.setAll(true)
    sel.toggle([], 'EMEA', false, true)
    sel.toggle(['EMEA'], 'DE', true, true)
    const state = JSON.parse(JSON.stringify(sel.getState()))
    const again = make()
    again.setState(state)
    expect(again.isSelected(['EMEA'], 'DE')).toBe(true)
    expect(again.isSelected(['EMEA'], 'FR')).toBe(false)
    expect(again.isSelected([], 'APAC')).toBe(true)
  })
})
