import { describe, expect, it } from 'vitest'
import { pane, tabs, group, allPaneIds, type DockNode, type DockTabs } from './dock-model'
import {
  floatPane,
  dockPaneOnto,
  dockWindowOnto,
  reorderTab,
  autoHideLeaf,
  autoHidePaneToSide,
  pinAutoHidden,
  closePane,
  moveWindow,
  resizeWindow,
  bringToFront,
  setWindowMinimized,
  toggleWindowMaximized,
  closeWindow,
  autoHideWindow,
  toggleMaximizeLeaf,
  findLeafById,
  addPaneToMain,
  locatePane,
  surfaceOfTabs,
  allManagerPaneIds,
  allManagerIds,
  dedupeManagerNodeIds,
  setManagerActive,
  type DockManagerState,
} from './dock-manager-model'

function counter() {
  let n = 0
  return () => `m${n++}`
}
const rect = { x: 100, y: 100, width: 320, height: 240 }

/** main = [A | B], no floats, no auto-hide. Returns the SHARED id generator so
 *  follow-up ops mint ids from the same sequence (no collisions - mirrors how
 *  SvDockManager uses a single genId). */
function base(): { state: DockManagerState; A: DockTabs; B: DockTabs; g: () => string } {
  const g = counter()
  const A = tabs(g, [pane('a', 'A')])
  const B = tabs(g, [pane('b', 'B')])
  return { state: { main: group(g, 'row', [A, B]) as DockNode, floating: [], autoHide: [] }, A, B, g }
}

describe('floatPane', () => {
  it('pops a pane into a floating window and collapses its old leaf', () => {
    const { state, g } = base()
    const next = floatPane(state, 'a', rect, g)
    expect(next.floating).toHaveLength(1)
    expect(next.floating[0]!.leaf.panes.map((p) => p.id)).toEqual(['a'])
    // main collapsed to the bare B leaf.
    expect(next.main?.type).toBe('tabs')
    expect(allPaneIds(next.main!)).toEqual(['b'])
    expect(locatePane(next, 'a')).toEqual({ kind: 'floating', windowId: next.floating[0]!.id })
  })

  it('is a no-op for a pane already alone in its float', () => {
    const { state, g } = base()
    const once = floatPane(state, 'a', rect, g)
    const twice = floatPane(once, 'a', rect, g)
    expect(twice).toBe(once)
  })
})

describe('dockPaneOnto - cross surface', () => {
  it('docks a floating pane back into a main leaf as a tab', () => {
    const { state, B, g } = base()
    const floated = floatPane(state, 'a', rect, g)
    const docked = dockPaneOnto(floated, 'a', B.id, 'center', g)
    expect(docked.floating).toHaveLength(0)
    const leaf = docked.main as DockTabs
    expect(leaf.panes.map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('edge-docks within main', () => {
    const { state, A, g } = base()
    const floated = floatPane(state, 'a', rect, g) // main is now just B
    // Re-dock A to the LEFT of B (A's old leaf id is gone; target B).
    const bId = surfaceOfTabs(floated, (floated.main as DockTabs).id) === 'main' ? (floated.main as DockTabs).id : ''
    const docked = dockPaneOnto(floated, 'a', bId, 'left', g)
    expect(allPaneIds(docked.main!)).toEqual(['a', 'b'])
    void A
  })
})

describe('reorderTab', () => {
  it('reorders tabs inside a leaf (main)', () => {
    const g = counter()
    const leaf = tabs(g, [pane('a', 'A'), pane('b', 'B'), pane('c', 'C')], 0)
    const state: DockManagerState = { main: leaf, floating: [], autoHide: [] }
    const next = reorderTab(state, leaf.id, 0, 2)
    expect((next.main as DockTabs).panes.map((p) => p.id)).toEqual(['b', 'c', 'a'])
    // active followed pane A.
    expect((next.main as DockTabs).active).toBe(2)
  })

  it('reorders tabs inside a floating window', () => {
    const { state, g } = base()
    let s = floatPane(state, 'a', rect, g)
    s = dockPaneOnto(s, 'b', s.floating[0]!.leaf.id, 'center', g) // float now [a, b]
    const wid = s.floating[0]!.leaf.id
    const next = reorderTab(s, wid, 0, 1)
    expect(next.floating[0]!.leaf.panes.map((p) => p.id)).toEqual(['b', 'a'])
  })
})

describe('auto-hide + pin', () => {
  it('collapses a main leaf to an edge, then pins it back', () => {
    const { state, B, g } = base()
    const hidden = autoHideLeaf(state, B.id, 'right')
    expect(hidden.autoHide).toHaveLength(1)
    expect(hidden.autoHide[0]!.side).toBe('right')
    expect(allPaneIds(hidden.main!)).toEqual(['a']) // only A left tiled
    expect(allManagerPaneIds(hidden)).toEqual(['a', 'b']) // B still exists, hidden

    const pinned = pinAutoHidden(hidden, hidden.autoHide[0]!.id, g)
    expect(pinned.autoHide).toHaveLength(0)
    expect(pinned.main?.type).toBe('group')
    expect(allPaneIds(pinned.main!)).toEqual(['a', 'b']) // B re-docked on the right
  })
})

describe('auto-hide to any of the 4 sides', () => {
  it.each(['left', 'right', 'top', 'bottom'] as const)('collapses + pins back on the %s edge', (side) => {
    const { state, B, g } = base()
    const hidden = autoHideLeaf(state, B.id, side)
    expect(hidden.autoHide[0]!.side).toBe(side)
    const pinned = pinAutoHidden(hidden, hidden.autoHide[0]!.id, g)
    const root = pinned.main as Extract<DockNode, { type: 'group' }>
    expect(root.type).toBe('group')
    // Row for left/right, column for top/bottom.
    expect(root.direction).toBe(side === 'left' || side === 'right' ? 'row' : 'column')
    expect(allPaneIds(pinned.main!).sort()).toEqual(['a', 'b'])
  })

  it('pins back with the requested size fraction (not 50/50)', () => {
    const { state, B, g } = base()
    const hidden = autoHideLeaf(state, B.id, 'right')
    const pinned = pinAutoHidden(hidden, hidden.autoHide[0]!.id, g, 0.2)
    const root = pinned.main as Extract<DockNode, { type: 'group' }>
    // Right side => [content, pinnedLeaf]; the pinned leaf takes ~0.2.
    expect(root.sizes[1]).toBeCloseTo(0.2, 1)
    expect(root.sizes[0]).toBeCloseTo(0.8, 1)
  })
})

describe('autoHidePaneToSide (drag a tab to an edge)', () => {
  it('pulls a single pane out to an edge as its own entry', () => {
    const g = counter()
    const leaf = tabs(g, [pane('a', 'A'), pane('b', 'B')])
    const s: DockManagerState = { main: leaf, floating: [], autoHide: [] }
    const next = autoHidePaneToSide(s, 'a', 'bottom', g)
    expect(next.autoHide).toHaveLength(1)
    expect(next.autoHide[0]!.side).toBe('bottom')
    expect(next.autoHide[0]!.leaf.panes.map((p) => p.id)).toEqual(['a'])
    // 'b' stays in the tiled leaf.
    expect(allPaneIds(next.main!)).toEqual(['b'])
  })
})

describe('dockWindowOnto', () => {
  it('docks a whole window edge-wise into main', () => {
    const { state, A, g } = base()
    const floated = floatPane(state, 'b', rect, g) // main = A, float = [B]
    const wid = floated.floating[0]!.id
    const next = dockWindowOnto(floated, wid, A.id, 'right', g)
    expect(next.floating).toHaveLength(0)
    expect(allPaneIds(next.main!)).toEqual(['a', 'b'])
  })
})

describe('maximize a tiled leaf + addPaneToMain', () => {
  it('toggles maximizedLeaf and finds a leaf by id', () => {
    const { state, A } = base()
    expect(findLeafById(state, A.id)?.id).toBe(A.id)
    const on = toggleMaximizeLeaf(state, A.id)
    expect(on.maximizedLeaf).toBe(A.id)
    expect(toggleMaximizeLeaf(on, A.id).maximizedLeaf).toBeNull()
  })

  it('adds a pane into the first main leaf (or as main when empty)', () => {
    const { state } = base()
    const next = addPaneToMain(state, pane('z', 'Z'), counter())
    expect(allManagerPaneIds(next)).toContain('z')
    const empty: DockManagerState = { main: null, floating: [], autoHide: [] }
    const filled = addPaneToMain(empty, pane('z', 'Z'), counter())
    expect(filled.main?.type).toBe('tabs')
    expect(allManagerPaneIds(filled)).toEqual(['z'])
  })
})

describe('window controls', () => {
  it('minimizes, maximizes (toggle), closes, and auto-hides a window', () => {
    const { state, g } = base()
    let s = floatPane(state, 'a', rect, g)
    const wid = s.floating[0]!.id
    s = setWindowMinimized(s, wid, true)
    expect(s.floating[0]!.minimized).toBe(true)
    s = toggleWindowMaximized(s, wid)
    expect(s.floating[0]!.maximized).toBe(true)
    expect(s.floating[0]!.minimized).toBe(false) // max clears min
    s = toggleWindowMaximized(s, wid)
    expect(s.floating[0]!.maximized).toBe(false)
    // auto-hide the window to the left edge
    s = autoHideWindow(s, wid, 'left', g)
    expect(s.floating).toHaveLength(0)
    expect(s.autoHide[0]!.side).toBe('left')
    expect(s.autoHide[0]!.leaf.panes.map((p) => p.id)).toEqual(['a'])
  })

  it('closeWindow drops the window and its panes', () => {
    const { state, g } = base()
    const s = floatPane(state, 'a', rect, g)
    const next = closeWindow(s, s.floating[0]!.id)
    expect(next.floating).toHaveLength(0)
    expect(allManagerPaneIds(next)).toEqual(['b'])
  })
})

describe('window ops + close', () => {
  it('moves, resizes, and restacks windows; closes a pane anywhere', () => {
    const { state, g } = base()
    let s = floatPane(state, 'a', rect, g)
    const wid = s.floating[0]!.id
    s = moveWindow(s, wid, 40, 60)
    s = resizeWindow(s, wid, 500, 400)
    expect(s.floating[0]).toMatchObject({ x: 40, y: 60, width: 500, height: 400 })
    const z0 = s.floating[0]!.z
    s = bringToFront(s, wid)
    expect(s.floating[0]!.z).toBeGreaterThan(z0)
    s = closePane(s, 'a')
    expect(s.floating).toHaveLength(0)
    expect(allManagerPaneIds(s)).toEqual(['b'])
  })
})

describe('setManagerActive', () => {
  it('sets active in a main leaf and in a float', () => {
    const g = counter()
    const leaf = tabs(g, [pane('a', 'A'), pane('b', 'B')], 0)
    const s: DockManagerState = { main: leaf, floating: [], autoHide: [] }
    expect((setManagerActive(s, leaf.id, 1).main as DockTabs).active).toBe(1)
  })
})

describe('dedupeManagerNodeIds', () => {
  it('reassigns duplicate node ids so keyed sibling lists never collide', () => {
    // A restored workspace where two sibling leaves share a generated id (the id
    // counter had reset across reloads) - the shape that threw each_key_duplicate.
    const dup: DockManagerState = {
      main: {
        type: 'group', id: 'dm-1000000', direction: 'row', sizes: [0.5, 0.5],
        children: [
          { type: 'tabs', id: 'dm-1000000', panes: [pane('rail', 'Pages')], active: 0 },
          { type: 'tabs', id: 'dm-1000000', panes: [pane('main', 'Canvas')], active: 0 },
        ],
      } as DockNode,
      floating: [], autoHide: [],
    }
    const fixed = dedupeManagerNodeIds(dup)
    const ids = allManagerIds(fixed)
    // Every node id is now unique...
    const nodeIds = ids.filter((i) => i.startsWith('dm-'))
    expect(new Set(nodeIds).size).toBe(nodeIds.length)
    // ...while pane ids (which key content) are preserved.
    expect(allManagerPaneIds(fixed).sort()).toEqual(['main', 'rail'])
  })

  it('is value-equal on an already-unique workspace', () => {
    const { state } = base()
    expect(dedupeManagerNodeIds(state)).toBe(state)
  })
})
