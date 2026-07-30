/**
 * dock-manager-model - the pure state behind <SvDockManager>. It wraps the base
 * `dock-model` tree (the docked/tiled area) with the three "pro" docking
 * surfaces a real IDE has:
 *
 *   floating   panes popped out into movable/resizable windows (a single tabs
 *              leaf each - a floating panel).
 *   autoHide   leaves collapsed to an edge strip; a fly-out reveals them and
 *              "pin" re-docks them.
 *   main       the tiled dock area itself (a `DockNode` tree, or null when
 *              everything has been floated / hidden).
 *
 * As with the base model, every operation is a pure transform returning a NEW
 * state, so a whole workspace - tiled + floating + hidden - serializes to JSON
 * and restores exactly. The Svelte view owns the DOM, gestures and z-order
 * painting; all the surgery lives here and is unit-tested without a browser.
 */
import {
  tabs,
  dockInto,
  removePane as removePaneFromTree,
  removeLeaf,
  dockLeafToEdge,
  reorderPane,
  findTabsWithPane,
  allPaneIds,
  type DockNode,
  type DockTabs,
  type DockPane,
  type DockZone,
  type IdGen,
} from './dock-model'

export type DockSide = Exclude<DockZone, 'center'>

/** A floating window: one tabs leaf shown in a movable/resizable frame. */
export type FloatWindow = {
  id: string
  leaf: DockTabs
  x: number
  y: number
  width: number
  height: number
  /** Stacking order; higher is on top. */
  z: number
  /** Collapsed to just its title bar. */
  minimized?: boolean
  /** Expanded to fill the manager (its x/y/w/h are kept for restore). */
  maximized?: boolean
}

/** A leaf collapsed to an edge; a fly-out reveals it, "pin" re-docks it. */
export type AutoHideEntry = {
  id: string
  side: DockSide
  leaf: DockTabs
  /** Fly-out panel size in px along the reveal axis. */
  size: number
}

export type DockManagerState = {
  main: DockNode | null
  floating: FloatWindow[]
  autoHide: AutoHideEntry[]
  /** A tiled leaf shown maximized (filling the docked area), or null. */
  maximizedLeaf?: string | null
}

// ---- queries --------------------------------------------------------------

/** Where a pane currently lives. */
export type PaneLocation =
  | { kind: 'main' }
  | { kind: 'floating'; windowId: string }
  | { kind: 'autoHide'; entryId: string }

export function locatePane(state: DockManagerState, paneId: string): PaneLocation | null {
  if (state.main && findTabsWithPane(state.main, paneId)) return { kind: 'main' }
  for (const w of state.floating) {
    if (w.leaf.panes.some((p) => p.id === paneId)) return { kind: 'floating', windowId: w.id }
  }
  for (const e of state.autoHide) {
    if (e.leaf.panes.some((p) => p.id === paneId)) return { kind: 'autoHide', entryId: e.id }
  }
  return null
}

/** Which surface holds a tabs leaf: 'main', a window id, or null. */
export function surfaceOfTabs(state: DockManagerState, tabsId: string): 'main' | string | null {
  if (state.main && containsTabs(state.main, tabsId)) return 'main'
  const w = state.floating.find((f) => f.leaf.id === tabsId)
  return w ? w.id : null
}

function containsTabs(node: DockNode, tabsId: string): boolean {
  if (node.type === 'tabs') return node.id === tabsId
  return node.children.some((c) => containsTabs(c, tabsId))
}

function findPaneObject(state: DockManagerState, paneId: string): DockPane | null {
  const scan = (node: DockNode): DockPane | null => {
    if (node.type === 'tabs') return node.panes.find((p) => p.id === paneId) ?? null
    for (const c of node.children) { const hit = scan(c); if (hit) return hit }
    return null
  }
  if (state.main) { const m = scan(state.main); if (m) return m }
  for (const w of state.floating) { const f = w.leaf.panes.find((p) => p.id === paneId); if (f) return f }
  for (const e of state.autoHide) { const a = e.leaf.panes.find((p) => p.id === paneId); if (a) return a }
  return null
}

function maxZ(state: DockManagerState): number {
  return state.floating.reduce((m, w) => Math.max(m, w.z), 0)
}

// ---- internal: remove a pane from wherever it is --------------------------

/** Remove a pane from every surface, dropping windows/entries it empties. */
function stripPane(state: DockManagerState, paneId: string): DockManagerState {
  let main = state.main
  if (main && findTabsWithPane(main, paneId)) {
    main = removePaneFromTree(main, paneId).root
  }
  const floating = state.floating
    .map((w) => {
      if (!w.leaf.panes.some((p) => p.id === paneId)) return w
      const panes = w.leaf.panes.filter((p) => p.id !== paneId)
      if (panes.length === 0) return null
      const active = Math.max(0, Math.min(w.leaf.active, panes.length - 1))
      return { ...w, leaf: { ...w.leaf, panes, active } }
    })
    .filter((w): w is FloatWindow => w !== null)
  const autoHide = state.autoHide
    .map((e) => {
      if (!e.leaf.panes.some((p) => p.id === paneId)) return e
      const panes = e.leaf.panes.filter((p) => p.id !== paneId)
      if (panes.length === 0) return null
      const active = Math.max(0, Math.min(e.leaf.active, panes.length - 1))
      return { ...e, leaf: { ...e.leaf, panes, active } }
    })
    .filter((e): e is AutoHideEntry => e !== null)
  return { main, floating, autoHide }
}

// ---- mutations ------------------------------------------------------------

/** Reorder a tab within its leaf, wherever that leaf lives (main or a float). */
export function reorderTab(state: DockManagerState, tabsId: string, from: number, to: number): DockManagerState {
  if (state.main && containsTabs(state.main, tabsId)) {
    return { ...state, main: reorderPane(state.main, tabsId, from, to) }
  }
  return {
    ...state,
    floating: state.floating.map((w) => {
      if (w.leaf.id !== tabsId) return w
      const reordered = reorderPane(w.leaf, tabsId, from, to)
      return reordered.type === 'tabs' ? { ...w, leaf: reordered } : w
    }),
  }
}

/** Resize a group's children (splitter drag). Groups only exist in `main`
 *  (floating windows are single leaves), so this targets the main tree. */
export function resizeGroup(state: DockManagerState, groupId: string, sizes: number[]): DockManagerState {
  if (!state.main) return state
  return { ...state, main: setSizesInTree(state.main, groupId, sizes) }
}

function setSizesInTree(node: DockNode, groupId: string, sizes: number[]): DockNode {
  if (node.type === 'tabs') return node
  const children = node.children.map((c) => setSizesInTree(c, groupId, sizes))
  if (node.id === groupId) return { ...node, children, sizes: normalizeManagerSizes(sizes, children.length) }
  return { ...node, children }
}

function normalizeManagerSizes(sizes: number[], count: number): number[] {
  if (count <= 0) return []
  const src = sizes.length === count ? sizes : new Array(count).fill(1)
  const total = src.reduce((a, b) => a + (b > 0 ? b : 0), 0)
  return total <= 0 ? new Array(count).fill(1 / count) : src.map((s) => (s > 0 ? s : 0) / total)
}

/** Set the active tab of a leaf in main or a floating window. */
export function setManagerActive(state: DockManagerState, tabsId: string, active: number): DockManagerState {
  const w = state.floating.find((f) => f.leaf.id === tabsId)
  if (w) {
    return {
      ...state,
      floating: state.floating.map((f) =>
        f.id === w.id ? { ...f, leaf: { ...f.leaf, active: clamp(active, f.leaf.panes.length) } } : f,
      ),
    }
  }
  return { ...state, main: state.main ? setActiveInTree(state.main, tabsId, active) : state.main }
}

/**
 * Dock a pane onto a target leaf (`center` = new tab, edge = split). Works
 * across surfaces: a floating pane can dock into main, a main pane into a float
 * (centre only), etc. Edge zones only apply when the target is in `main`.
 */
export function dockPaneOnto(
  state: DockManagerState,
  paneId: string,
  targetTabsId: string,
  zone: DockZone,
  genId: IdGen,
): DockManagerState {
  const moving = findPaneObject(state, paneId)
  if (!moving) return state
  const targetSurface = surfaceOfTabs(state, targetTabsId)
  if (!targetSurface) return state

  const stripped = stripPane(state, paneId)
  // The target leaf might have dissolved (it was the pane's own single leaf).
  if (surfaceOfTabs(stripped, targetTabsId) === null) return state

  if (targetSurface === 'main') {
    const base = stripped.main
    if (!base) return state
    return { ...stripped, main: dockInto(base, targetTabsId, moving, zone, genId) }
  }
  // Docking into a floating window: centre only (add as a tab).
  return {
    ...stripped,
    floating: stripped.floating.map((w) => {
      if (w.id !== targetSurface) return w
      const panes = [...w.leaf.panes, moving]
      return { ...w, leaf: { ...w.leaf, panes, active: panes.length - 1 } }
    }),
  }
}

/** Insert a NEW pane into the main area - the first leaf (as a tab), or as the
 *  whole main when empty. Used to pop a window/pop-out back into the layout. */
export function addPaneToMain(state: DockManagerState, p: DockPane, genId: IdGen): DockManagerState {
  if (!state.main) return { ...state, main: tabs(genId, [p], 0) }
  let added = false
  const walk = (n: DockNode): DockNode => {
    if (added) return n
    if (n.type === 'tabs') {
      added = true
      const panes = [...n.panes, p]
      return { ...n, panes, active: panes.length - 1 }
    }
    return { ...n, children: n.children.map(walk) }
  }
  return { ...state, main: walk(state.main) }
}

/** Dock a pane into an empty main area (main becomes a single leaf holding it). */
export function dockPaneToEmptyMain(state: DockManagerState, paneId: string, genId: IdGen): DockManagerState {
  const moving = findPaneObject(state, paneId)
  if (!moving) return state
  const stripped = stripPane(state, paneId)
  if (stripped.main) return { ...stripped, main: stripped.main } // main not empty; caller should dock onto a leaf
  return { ...stripped, main: tabs(genId, [moving], 0) }
}

/** Pop a pane out into a new floating window at the given rect. */
export function floatPane(
  state: DockManagerState,
  paneId: string,
  rect: { x: number; y: number; width: number; height: number },
  genId: IdGen,
): DockManagerState {
  const moving = findPaneObject(state, paneId)
  if (!moving) return state
  const loc = locatePane(state, paneId)
  // Already the sole pane of its own float - nothing to pop out.
  if (loc?.kind === 'floating') {
    const w = state.floating.find((f) => f.id === loc.windowId)
    if (w && w.leaf.panes.length === 1) return state
  }
  const stripped = stripPane(state, paneId)
  const win: FloatWindow = {
    id: genId(),
    leaf: tabs(genId, [moving], 0),
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    z: maxZ(state) + 1,
  }
  return { ...stripped, floating: [...stripped.floating, win] }
}

/** Dock an entire floating window's panes back into a main leaf. */
export function dockWindowOnto(
  state: DockManagerState,
  windowId: string,
  targetTabsId: string,
  zone: DockZone,
  genId: IdGen,
): DockManagerState {
  const win = state.floating.find((w) => w.id === windowId)
  if (!win) return state
  if (surfaceOfTabs(state, targetTabsId) !== 'main' || !state.main) return state
  const rest = state.floating.filter((w) => w.id !== windowId)
  if (zone === 'center') {
    return {
      ...state,
      floating: rest,
      main: state.main
        ? mergePanesInto(state.main, targetTabsId, win.leaf.panes)
        : state.main,
    }
  }
  // Edge: drop the window's whole leaf beside the target.
  const leaf = tabs(genId, win.leaf.panes, win.leaf.active)
  const dir = zone === 'left' || zone === 'right' ? 'row' : 'column'
  const before = zone === 'left' || zone === 'top'
  return {
    ...state,
    floating: rest,
    main: insertLeafBeside(state.main, targetTabsId, leaf, dir, before, genId),
  }
}

/** Move a floating window (top-left). */
export function moveWindow(state: DockManagerState, windowId: string, x: number, y: number): DockManagerState {
  return { ...state, floating: state.floating.map((w) => (w.id === windowId ? { ...w, x, y } : w)) }
}

/** Resize a floating window. */
export function resizeWindow(
  state: DockManagerState,
  windowId: string,
  width: number,
  height: number,
): DockManagerState {
  return {
    ...state,
    floating: state.floating.map((w) =>
      w.id === windowId ? { ...w, width: Math.max(140, width), height: Math.max(80, height) } : w,
    ),
  }
}

/** Raise a floating window to the top of the stack. */
export function bringToFront(state: DockManagerState, windowId: string): DockManagerState {
  const top = maxZ(state)
  return { ...state, floating: state.floating.map((w) => (w.id === windowId ? { ...w, z: top + 1 } : w)) }
}

/** Collapse a floating window to just its title bar (or restore it). */
export function setWindowMinimized(state: DockManagerState, windowId: string, minimized: boolean): DockManagerState {
  return {
    ...state,
    floating: state.floating.map((w) =>
      w.id === windowId ? { ...w, minimized, maximized: minimized ? false : w.maximized } : w,
    ),
  }
}

/** Toggle a floating window between filling the manager and its own rect. */
export function toggleWindowMaximized(state: DockManagerState, windowId: string): DockManagerState {
  return {
    ...state,
    floating: state.floating.map((w) =>
      w.id === windowId ? { ...w, maximized: !w.maximized, minimized: false } : w,
    ),
  }
}

/** Close a floating window and all its panes. */
export function closeWindow(state: DockManagerState, windowId: string): DockManagerState {
  return { ...state, floating: state.floating.filter((w) => w.id !== windowId) }
}

/** Find a tabs leaf anywhere (main or a floating window) by id. */
export function findLeafById(state: DockManagerState, tabsId: string): DockTabs | null {
  const scan = (n: DockNode): DockTabs | null => {
    if (n.type === 'tabs') return n.id === tabsId ? n : null
    for (const c of n.children) { const hit = scan(c); if (hit) return hit }
    return null
  }
  if (state.main) { const m = scan(state.main); if (m) return m }
  const w = state.floating.find((f) => f.leaf.id === tabsId)
  return w ? w.leaf : null
}

/** Toggle a tiled leaf maximized (filling the docked area). Clears if it is gone. */
export function toggleMaximizeLeaf(state: DockManagerState, tabsId: string): DockManagerState {
  const on = state.maximizedLeaf === tabsId
  return { ...state, maximizedLeaf: on ? null : tabsId }
}

/** Send a floating window's panel to an edge as an auto-hidden entry. */
export function autoHideWindow(
  state: DockManagerState,
  windowId: string,
  side: DockSide,
  genId: IdGen,
  size = 260,
): DockManagerState {
  const w = state.floating.find((f) => f.id === windowId)
  if (!w) return state
  const entry: AutoHideEntry = { id: genId(), side, leaf: tabs(genId, w.leaf.panes, w.leaf.active), size }
  return { ...state, floating: state.floating.filter((f) => f.id !== windowId), autoHide: [...state.autoHide, entry] }
}

/** Collapse a MAIN leaf to an edge strip (auto-hide) on the given side. */
export function autoHideLeaf(
  state: DockManagerState,
  tabsId: string,
  side: DockSide,
  size = 260,
): DockManagerState {
  if (!state.main) return state
  const { root, leaf } = removeLeaf(state.main, tabsId)
  if (!leaf) return state
  const entry: AutoHideEntry = { id: `ah-${tabsId}`, side, leaf, size }
  return { ...state, main: root, autoHide: [...state.autoHide, entry] }
}

/** Auto-hide a single pane to an edge (drag a tab to the manager border). The
 *  pane leaves its leaf and becomes its own collapsed entry on that side. */
export function autoHidePaneToSide(
  state: DockManagerState,
  paneId: string,
  side: DockSide,
  genId: IdGen,
  size = 260,
): DockManagerState {
  const moving = findPaneObject(state, paneId)
  if (!moving) return state
  const stripped = stripPane(state, paneId)
  const entry: AutoHideEntry = { id: genId(), side, leaf: tabs(genId, [moving], 0), size }
  return { ...stripped, autoHide: [...stripped.autoHide, entry] }
}

/**
 * Pin an auto-hidden entry back into the main dock area on its edge. `fraction`
 * is the share of the axis the re-docked panel should take (default 0.25).
 */
export function pinAutoHidden(
  state: DockManagerState,
  entryId: string,
  genId: IdGen,
  fraction = 0.25,
): DockManagerState {
  const entry = state.autoHide.find((e) => e.id === entryId)
  if (!entry) return state
  const leaf = tabs(genId, entry.leaf.panes, entry.leaf.active)
  return {
    ...state,
    autoHide: state.autoHide.filter((e) => e.id !== entryId),
    main: dockLeafToEdge(state.main, leaf, entry.side, genId, fraction),
  }
}

/** Resize an auto-hide fly-out. */
export function setAutoHideSize(state: DockManagerState, entryId: string, size: number): DockManagerState {
  return {
    ...state,
    autoHide: state.autoHide.map((e) => (e.id === entryId ? { ...e, size: Math.max(120, size) } : e)),
  }
}

/** Close a pane wherever it lives. */
export function closePane(state: DockManagerState, paneId: string): DockManagerState {
  return stripPane(state, paneId)
}

/** Every pane id across all surfaces. */
export function allManagerPaneIds(state: DockManagerState): string[] {
  const ids: string[] = []
  if (state.main) ids.push(...allPaneIds(state.main))
  for (const w of state.floating) ids.push(...w.leaf.panes.map((p) => p.id))
  for (const e of state.autoHide) ids.push(...e.leaf.panes.map((p) => p.id))
  return ids
}

// ---- small tree helpers scoped to the manager -----------------------------

function clamp(i: number, len: number): number {
  if (len <= 0) return 0
  return Math.max(0, Math.min(i, len - 1))
}

function setActiveInTree(node: DockNode, tabsId: string, active: number): DockNode {
  if (node.type === 'tabs') {
    return node.id === tabsId ? { ...node, active: clamp(active, node.panes.length) } : node
  }
  return { ...node, children: node.children.map((c) => setActiveInTree(c, tabsId, active)) }
}

function mergePanesInto(node: DockNode, tabsId: string, panes: DockPane[]): DockNode {
  if (node.type === 'tabs') {
    if (node.id !== tabsId) return node
    const merged = [...node.panes, ...panes]
    return { ...node, panes: merged, active: merged.length - 1 }
  }
  return { ...node, children: node.children.map((c) => mergePanesInto(c, tabsId, panes)) }
}

function insertLeafBeside(
  node: DockNode,
  targetTabsId: string,
  leaf: DockTabs,
  dir: 'row' | 'column',
  before: boolean,
  genId: IdGen,
): DockNode {
  // Reuse dockInto by moving the leaf's first pane, then merging the rest - but
  // simpler and exact: rebuild via dockLeafToEdge semantics locally. We wrap the
  // target subtree. Find + replace the target leaf with a group of [leaf,target].
  const replace = (n: DockNode): DockNode => {
    if (n.type === 'tabs') {
      if (n.id !== targetTabsId) return n
      const kids = before ? [leaf, n] : [n, leaf]
      return { type: 'group', id: genId(), direction: dir, children: kids, sizes: [0.5, 0.5] }
    }
    return { ...n, children: n.children.map(replace) }
  }
  return replace(node)
}
