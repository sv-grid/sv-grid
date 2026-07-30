import { describe, expect, it } from 'vitest'
import {
  pane,
  tabs,
  group,
  normalize,
  normalizeSizes,
  findTabsWithPane,
  allPaneIds,
  removePane,
  dockInto,
  movePane,
  setActive,
  setSizes,
  type DockNode,
  type DockTabs,
} from './dock-model'

// Deterministic id generator for tests.
function counter() {
  let n = 0
  return () => `n${n++}`
}

/** A row of two single-pane leaves: [A | B]. */
function twoPane() {
  const g = counter()
  const A = tabs(g, [pane('a', 'A')])
  const B = tabs(g, [pane('b', 'B')])
  return { root: group(g, 'row', [A, B]) as DockNode, A, B }
}

describe('normalizeSizes', () => {
  it('splits evenly when absent and normalizes to sum 1', () => {
    expect(normalizeSizes(undefined, 4)).toEqual([0.25, 0.25, 0.25, 0.25])
    const n = normalizeSizes([1, 3], 2)
    expect(n[0]).toBeCloseTo(0.25)
    expect(n[1]).toBeCloseTo(0.75)
  })
  it('recovers from a bad length or zero total', () => {
    expect(normalizeSizes([5], 2)).toEqual([0.5, 0.5])
    expect(normalizeSizes([0, 0], 2)).toEqual([0.5, 0.5])
  })
})

describe('queries', () => {
  it('finds the leaf holding a pane, and lists all panes', () => {
    const { root, A } = twoPane()
    expect(findTabsWithPane(root, 'a')?.id).toBe(A.id)
    expect(findTabsWithPane(root, 'nope')).toBeNull()
    expect(allPaneIds(root)).toEqual(['a', 'b'])
  })
})

describe('dockPane - center adds a tab', () => {
  it('appends the pane to the target leaf and activates it', () => {
    const { root, B } = twoPane()
    const g = counter()
    const next = dockInto(root, B.id, pane('c', 'C'), 'center', g) as DockNode
    const leaf = findTabsWithPane(next, 'c') as DockTabs
    expect(leaf.id).toBe(B.id)
    expect(leaf.panes.map((p) => p.id)).toEqual(['b', 'c'])
    expect(leaf.active).toBe(1)
  })
})

describe('dockPane - edge splits', () => {
  it('inserts a sibling in the same-direction parent (stays flat)', () => {
    const { root, A } = twoPane()
    const g = counter()
    // Dock C to the RIGHT of A: parent row matches -> [A, C, B]
    const next = dockInto(root, A.id, pane('c', 'C'), 'right', g) as DockNode
    expect(next.type).toBe('group')
    expect(allPaneIds(next)).toEqual(['a', 'c', 'b'])
  })

  it('inserts on the correct side for left/top', () => {
    const { root, A } = twoPane()
    const g = counter()
    const next = dockInto(root, A.id, pane('c', 'C'), 'left', g) as DockNode
    expect(allPaneIds(next)).toEqual(['c', 'a', 'b'])
  })

  it('wraps in a cross-direction group when the edge differs from the parent', () => {
    const { root, A } = twoPane()
    const g = counter()
    // Dock C BELOW A: parent is a row, so A must become a column [A / C].
    const next = dockInto(root, A.id, pane('c', 'C'), 'bottom', g)
    expect(next.type).toBe('group')
    const rootGroup = next as Extract<DockNode, { type: 'group' }>
    expect(rootGroup.direction).toBe('row')
    // First child is now a column group holding A and C.
    const first = rootGroup.children[0]
    expect(first?.type).toBe('group')
    expect((first as any).direction).toBe('column')
    expect(allPaneIds(next)).toEqual(['a', 'c', 'b'])
  })
})

describe('removePane + normalize', () => {
  it('removes a pane, collapses the emptied leaf and unwraps the single-child group', () => {
    const { root } = twoPane()
    const { root: next, pane: removed } = removePane(root, 'b')
    expect(removed?.id).toBe('b')
    // Only A remains -> the row group collapses to the bare leaf A.
    expect(next?.type).toBe('tabs')
    expect(allPaneIds(next!)).toEqual(['a'])
  })

  it('keeps other tabs in a multi-pane leaf and fixes the active index', () => {
    const g = counter()
    const leaf = tabs(g, [pane('a', 'A'), pane('b', 'B'), pane('c', 'C')], 2)
    const { root: next } = removePane(leaf, 'a')
    const t = next as DockTabs
    expect(t.panes.map((p) => p.id)).toEqual(['b', 'c'])
    expect(t.active).toBe(1) // was 2 (C), shifted down by the earlier removal
  })

  it('flattens nested same-direction groups', () => {
    const g = counter()
    const inner = group(g, 'row', [tabs(g, [pane('a', 'A')]), tabs(g, [pane('b', 'B')])])
    const outer = group(g, 'row', [inner, tabs(g, [pane('c', 'C')])])
    const flat = normalize(outer) as Extract<DockNode, { type: 'group' }>
    expect(flat.direction).toBe('row')
    expect(flat.children.every((c) => c.type === 'tabs')).toBe(true)
    expect(allPaneIds(flat)).toEqual(['a', 'b', 'c'])
    expect(flat.sizes).toHaveLength(3)
  })
})

describe('movePane', () => {
  it('relocates a pane from one leaf to another as a tab', () => {
    const { root, B } = twoPane()
    const g = counter()
    const next = movePane(root, 'a', B.id, 'center', g)
    // A moved into B's leaf; the old A leaf collapsed, so root is the B leaf.
    expect(next.type).toBe('tabs')
    expect(allPaneIds(next)).toEqual(['b', 'a'])
  })

  it('is a no-op when the target leaf dissolves with the moved pane', () => {
    const g = counter()
    const solo = tabs(g, [pane('a', 'A')])
    const next = movePane(solo, 'a', solo.id, 'center', g)
    expect(next).toBe(solo) // unchanged reference - nothing to dock against
  })
})

describe('setActive / setSizes', () => {
  it('updates the active tab', () => {
    const g = counter()
    const leaf = tabs(g, [pane('a', 'A'), pane('b', 'B')], 0)
    const next = setActive(leaf, leaf.id, 1) as DockTabs
    expect(next.active).toBe(1)
  })
  it('updates and normalizes group sizes', () => {
    const { root } = twoPane()
    const gid = (root as Extract<DockNode, { type: 'group' }>).id
    const next = setSizes(root, gid, [3, 1]) as Extract<DockNode, { type: 'group' }>
    expect(next.sizes[0]).toBeCloseTo(0.75)
    expect(next.sizes[1]).toBeCloseTo(0.25)
  })
})
