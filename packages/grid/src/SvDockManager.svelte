<script lang="ts">
  /**
   * SvDockManager - a full docking manager built on <SvDockLayout>. It adds the
   * three "pro" features a tiled layout alone does not have:
   *
   *   - Floating / pop-out windows: drag a tab out of the dock (or hit the float
   *     button) to pop it into a movable, resizable window; drag it back to redock.
   *   - Tab reordering: drag a tab along its own strip to reorder it.
   *   - Pinning / auto-hide: collapse a panel to an edge strip; a fly-out reveals
   *     it on hover, and "pin" docks it back.
   *
   * The docked area is an <SvDockLayout> in "manager mode" (it delegates every
   * gesture here); floating windows are each a small <SvDockLayout> too. The
   * whole workspace is the serializable `DockManagerState` from `dock-manager-model`.
   *
   * Build the initial workspace with the base `dockGroup`/`dockTabs`/`dockPane`
   * helpers:
   *
   *   let workspace = $state({
   *     main: dockGroup('row', [dockTabs([dockPane('a','A')]), dockTabs([dockPane('b','B')])]),
   *     floating: [], autoHide: [],
   *   })
   *   <SvDockManager bind:workspace>{#snippet pane(p)} ... {/snippet}</SvDockManager>
   */
  import { onDestroy, type Snippet } from 'svelte'
  import { fly } from 'svelte/transition'
  import SvDockLayout from './SvDockLayout.svelte'
  import type { DockPane, DockTabs, DockZone } from './dock-model'
  import {
    reorderTab,
    setManagerActive,
    resizeGroup,
    closePane,
    dockPaneOnto,
    floatPane,
    dockPaneToEmptyMain,
    addPaneToMain,
    dockWindowOnto,
    moveWindow,
    resizeWindow,
    bringToFront,
    setWindowMinimized,
    toggleWindowMaximized,
    closeWindow,
    autoHideWindow,
    autoHideLeaf,
    autoHidePaneToSide,
    pinAutoHidden,
    setAutoHideSize,
    toggleMaximizeLeaf,
    findLeafById,
    allManagerIds,
    type DockManagerState,
    type DockSide,
    type AutoHideEntry,
  } from './dock-manager-model'
  import { openPopout, type Popout } from './dock-popout'

  /** Imperative handle exposed via `onReady`. */
  export type DockManagerApi = {
    getState: () => DockManagerState
    setState: (s: DockManagerState) => void
    float: (paneId: string) => void
    popout: (paneId: string) => void
    autoHide: (paneId: string) => void
    maximize: (tabsId: string) => void
    close: (paneId: string) => void
    focus: (paneId: string) => void
  }

  /** Granular lifecycle events (in addition to `onChange`). */
  export type DockEvent =
    | { type: 'activePane'; paneId: string; tabsId: string }
    | { type: 'close'; paneId: string }
    | { type: 'float'; paneId: string }
    | { type: 'popout'; paneId: string }
    | { type: 'autoHide'; paneId: string; side: DockSide }
    | { type: 'pin'; paneId: string }
    | { type: 'maximize'; tabsId: string; maximized: boolean }
    | { type: 'window'; windowId: string; action: 'minimize' | 'maximize' | 'close' | 'autoHide' }
    | { type: 'focus'; paneId: string }

  type Props = {
    /** The whole workspace: tiled `main` + `floating` windows + `autoHide` edges. Bindable. */
    workspace: DockManagerState
    /** Renders each pane's content, keyed off the `DockPane`. */
    pane: Snippet<[DockPane]>
    /** Notified after any change. */
    onChange?: (workspace: DockManagerState) => void
    /** Granular lifecycle events (activePane / close / float / popout / ...). */
    onEvent?: (event: DockEvent) => void
    /** Minimum pane size in px along a split. Default 80. */
    minSize?: number
    /** Allow dragging tabs to reorder them within a strip. Default `true`. */
    reorderEnabled?: boolean
    /** Which side of each panel its tab strip sits on. Default `'top'`. */
    headerPosition?: 'top' | 'bottom' | 'left' | 'right'
    /** Keep inactive tabs mounted (hidden) so their content state persists.
     *  Default `false` (only the active tab renders). */
    keepAlive?: boolean
    /** Hide the tab button on a single-pane leaf (no redundant title bar; the panel
     *  actions still show). Applies to the docked area, floating windows, and fly-outs. */
    hideSingleTab?: boolean
    /** Offer the "pop out to a new browser window" panel action. Default `false` -
     *  most apps only need in-app floating windows, so the OS pop-out stays hidden
     *  unless you opt in. The `popout()` API still works regardless. */
    allowPopout?: boolean
    /** Locked / split mode: a fixed set of resizable panes. Tabs can't be dragged
     *  (no reorder / float / dock) and the panel action buttons are hidden - only
     *  splitter resize + tab switching remain. Turns the manager into a plain
     *  split-view workspace. Default `false`. */
    locked?: boolean
    /** Receive the imperative API once, on mount. */
    onReady?: (api: DockManagerApi) => void
  }

  let {
    workspace = $bindable(),
    pane,
    onChange,
    onEvent,
    minSize = 80,
    reorderEnabled = true,
    headerPosition = 'top',
    keepAlive = false,
    hideSingleTab = false,
    allowPopout = false,
    locked = false,
    onReady,
  }: Props = $props()
  const emit = (e: DockEvent) => onEvent?.(e)

  let rootEl = $state<HTMLElement | null>(null)
  // Runtime-only: OS window handles for popped-out panes (not serializable).
  const popouts = new Map<string, Popout>()
  let nextId = mgrBase()
  // Never mint an id that already lives in the workspace. The base counter is
  // module-scoped and resets on reload, so a workspace restored from storage can
  // already hold the `dm-N` we're about to generate - skip past any collision so
  // keyed lists never see a duplicate.
  const genId = (): string => {
    const used = new Set(allManagerIds(workspace))
    let id = `dm-${nextId++}`
    while (used.has(id)) id = `dm-${nextId++}`
    return id
  }
  function commit(next: DockManagerState) { workspace = next; onChange?.(next) }

  // Focus tracking (which pane the user last engaged) for the active-panel ring.
  let focusedPaneId = $state<string | null>(null)
  function setFocus(paneId: string | null) {
    if (paneId === focusedPaneId) return
    focusedPaneId = paneId
    if (paneId) emit({ type: 'focus', paneId })
  }
  const focusedLeafId = $derived.by(() => {
    if (!focusedPaneId) return null
    const scan = (n: any): string | null => {
      if (n.type === 'tabs') return n.panes.some((p: DockPane) => p.id === focusedPaneId) ? n.id : null
      for (const c of n.children) { const id = scan(c); if (id) return id }
      return null
    }
    if (workspace.main) { const id = scan(workspace.main); if (id) return id }
    const w = workspace.floating.find((f) => f.leaf.panes.some((p) => p.id === focusedPaneId))
    return w ? w.leaf.id : null
  })

  // Controlled handlers each SvDockLayout routes back to the manager.
  const onActivate = (tabsId: string, i: number) => {
    const paneId = findLeafById(workspace, tabsId)?.panes[i]?.id
    commit(setManagerActive(workspace, tabsId, i))
    if (paneId) { setFocus(paneId); emit({ type: 'activePane', tabsId, paneId }) }
  }
  // Reveal an auto-hidden leaf's flyout on a specific pane (clicked from the
  // edge rail). Toggles closed when the already-open pane is clicked again.
  function revealAutoHidePane(e: AutoHideEntry, pi: number) {
    if (revealed === e.id && e.leaf.active === pi) { revealed = null; return }
    if (e.leaf.active !== pi) onActivate(e.leaf.id, pi)
    revealed = e.id
  }
  const onClose = (paneId: string) => { commit(closePane(workspace, paneId)); emit({ type: 'close', paneId }) }
  const onResize = (groupId: string, sizes: number[]) => commit(resizeGroup(workspace, groupId, sizes))

  function paneTitle(paneId: string): string {
    const inNode = (n: any): string | null => {
      if (n.type === 'tabs') return n.panes.find((p: DockPane) => p.id === paneId)?.title ?? null
      for (const c of n.children) { const t = inNode(c); if (t) return t }
      return null
    }
    if (workspace.main) { const t = inNode(workspace.main); if (t) return t }
    for (const w of workspace.floating) { const p = w.leaf.panes.find((p) => p.id === paneId); if (p) return p.title }
    for (const e of workspace.autoHide) { const p = e.leaf.panes.find((p) => p.id === paneId); if (p) return p.title }
    return ''
  }

  // ------------------------------------------------------------------ tab drag
  type Target =
    | { kind: 'reorder'; tabsId: string; index: number }
    | { kind: 'dock'; surface: string; tabsId: string; zone: DockZone }
    | { kind: 'autohide'; side: DockSide }
    | { kind: 'empty-main' }
    | { kind: 'float' }
  let ghost = $state<{ title: string; x: number; y: number } | null>(null)
  let target = $state<Target | null>(null)
  let src: { paneId: string; sourceTabsId: string; sx: number; sy: number } | null = null
  let draggingWindow = $state<string | null>(null)
  // The leaf under the pointer while dragging, for the dock guide. `zone` is the
  // guide chip the pointer is on (drop docks there) or null (off the guide -> the
  // drop floats). Shown whether or not a chip is hit so the user can aim.
  let hoverLeaf = $state<{ tabsId: string; surface: string; zone: DockZone | null } | null>(null)

  // Drop indicators handed to every surface's SvDockLayout (ids are unique, so
  // only the matching leaf paints it).
  const guideGlobal = $derived.by(() =>
    hoverLeaf ? { tabsId: hoverLeaf.tabsId, zone: hoverLeaf.zone, centerOnly: hoverLeaf.surface !== 'main' } : null,
  )
  const reorderTargetGlobal = $derived.by(() =>
    target && target.kind === 'reorder' ? { tabsId: target.tabsId, index: target.index } : null,
  )
  const autohideSide = $derived.by(() => (target && target.kind === 'autohide' ? target.side : null))

  /** Which guide chip the pointer is over on a leaf, or null (-> float). The
   *  geometry mirrors the guide layout in DockNodeView (26px chips, 30px apart). */
  function zoneFromGuide(r: DOMRect, x: number, y: number, edges: boolean): DockZone | null {
    const dx = x - (r.left + r.right) / 2
    const dy = y - (r.top + r.bottom) / 2
    const H = 15, O = 30
    const box = (bx: number, by: number) => Math.abs(dx - bx) <= H && Math.abs(dy - by) <= H
    if (box(0, 0)) return 'center'
    if (!edges) return null
    if (box(-O, 0)) return 'left'
    if (box(O, 0)) return 'right'
    if (box(0, -O)) return 'top'
    if (box(0, O)) return 'bottom'
    return null
  }

  function beginTabDrag(e: PointerEvent, paneId: string, tabsId: string) {
    setFocus(paneId)
    src = { paneId, sourceTabsId: tabsId, sx: e.clientX, sy: e.clientY }
    window.addEventListener('pointermove', onTabMove)
    window.addEventListener('pointerup', onTabUp)
  }

  const verticalHeader = $derived(headerPosition === 'left' || headerPosition === 'right')

  function insertIndex(strip: Element, x: number, y: number): number {
    const tabsEls = Array.from(strip.querySelectorAll('[data-dock-tab]')) as HTMLElement[]
    for (let i = 0; i < tabsEls.length; i++) {
      const r = tabsEls[i]!.getBoundingClientRect()
      const before = verticalHeader ? y < r.top + r.height / 2 : x < r.left + r.width / 2
      if (before) return i
    }
    return tabsEls.length
  }

  const EDGE_BAND = 22

  /** Compute the drop action AND set `hoverLeaf` (which drives the dock guide). */
  function computeTarget(x: number, y: number): Target {
    hoverLeaf = null
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    if (!el || !rootEl?.contains(el)) {
      // Outside the manager entirely -> float.
      return { kind: 'float' }
    }
    const leafEl = el.closest('[data-dock-tabs]') as HTMLElement | null
    const strip = el.closest('.sv-dock__tabstrip')
    // Reorder wins over everything when over the source leaf's own strip.
    if (reorderEnabled && leafEl && strip && leafEl.dataset.dockTabs === src!.sourceTabsId) {
      return { kind: 'reorder', tabsId: src!.sourceTabsId, index: insertIndex(strip, x, y) }
    }
    // Near the manager's outer border -> auto-hide to that side. Checked AFTER
    // the source-strip reorder (above) so reordering still wins, but before the
    // guide - so all four edges work, including the top where tab strips live.
    {
      const rr = rootEl.getBoundingClientRect()
      const dl = x - rr.left, dr = rr.right - x, dt = y - rr.top, db = rr.bottom - y
      const mn = Math.min(dl, dr, dt, db)
      if (mn >= 0 && mn <= EDGE_BAND) {
        return { kind: 'autohide', side: mn === dl ? 'left' : mn === dr ? 'right' : mn === dt ? 'top' : 'bottom' }
      }
    }
    if (leafEl) {
      const surface = (leafEl.closest('[data-dock-surface]') as HTMLElement | null)?.dataset.dockSurface ?? 'main'
      const edges = surface === 'main'
      const zone = zoneFromGuide(leafEl.getBoundingClientRect(), x, y, edges)
      // Always show the guide on the hovered leaf; only a chip hit docks.
      hoverLeaf = { tabsId: leafEl.dataset.dockTabs!, surface, zone }
      return zone
        ? { kind: 'dock', surface, tabsId: leafEl.dataset.dockTabs!, zone }
        : { kind: 'float' } // over the leaf but off the guide -> float
    }
    if (el.closest('[data-dock-empty]')) return { kind: 'empty-main' }
    return { kind: 'float' }
  }

  function onTabMove(e: PointerEvent) {
    if (!src) return
    if (!ghost) {
      if (Math.hypot(e.clientX - src.sx, e.clientY - src.sy) < 5) return
      ghost = { title: paneTitle(src.paneId), x: e.clientX, y: e.clientY }
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'grabbing'
    }
    ghost = { ...ghost, x: e.clientX, y: e.clientY }
    target = computeTarget(e.clientX, e.clientY)
  }

  function onTabUp(e: PointerEvent) {
    window.removeEventListener('pointermove', onTabMove)
    window.removeEventListener('pointerup', onTabUp)
    if (src && ghost && target) {
      const { paneId } = src
      if (target.kind === 'reorder') {
        const from = tabIndexOf(target.tabsId, paneId)
        if (from >= 0) commit(reorderTab(workspace, target.tabsId, from, target.index > from ? target.index - 1 : target.index))
      } else if (target.kind === 'dock') {
        commit(dockPaneOnto(workspace, paneId, target.tabsId, target.zone, genId))
      } else if (target.kind === 'autohide') {
        commit(autoHidePaneToSide(workspace, paneId, target.side, genId))
      } else if (target.kind === 'empty-main') {
        commit(dockPaneToEmptyMain(workspace, paneId, genId))
      } else {
        // Float at the drop point, sized from the manager rect.
        const r = rootEl?.getBoundingClientRect()
        const x = (e.clientX - (r?.left ?? 0)) - 40
        const y = (e.clientY - (r?.top ?? 0)) - 12
        commit(floatPane(workspace, paneId, { x: Math.max(0, x), y: Math.max(0, y), width: 340, height: 240 }, genId))
      }
    }
    src = null; ghost = null; target = null; hoverLeaf = null
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }

  function tabIndexOf(tabsId: string, paneId: string): number {
    const find = (n: any): number => {
      if (n.type === 'tabs') return n.id === tabsId ? n.panes.findIndex((p: DockPane) => p.id === paneId) : -1
      for (const c of n.children) { const i = find(c); if (i >= 0) return i }
      return -1
    }
    if (workspace.main) { const i = find(workspace.main); if (i >= 0) return i }
    const w = workspace.floating.find((w) => w.leaf.id === tabsId)
    return w ? w.leaf.panes.findIndex((p) => p.id === paneId) : -1
  }

  // -------------------------------------------------- floating window move/resize
  function windowDragStart(e: PointerEvent, windowId: string) {
    if (e.button !== 0) return
    commit(bringToFront(workspace, windowId))
    const w = workspace.floating.find((w) => w.id === windowId)
    if (!w) return
    const ox = e.clientX - w.x
    const oy = e.clientY - w.y
    // Make the dragged window transparent to hit-testing so elementFromPoint
    // sees the main leaf underneath (for redock), not the window itself.
    draggingWindow = windowId
    let redock: { tabsId: string; zone: DockZone } | null = null
    const move = (ev: PointerEvent) => {
      commit(moveWindow(workspace, windowId, ev.clientX - ox, ev.clientY - oy))
      // Over a main leaf's guide chip -> arm a redock (else the window floats).
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const leafEl = el?.closest('[data-dock-tabs]') as HTMLElement | null
      const surface = leafEl ? (leafEl.closest('[data-dock-surface]') as HTMLElement | null)?.dataset.dockSurface : undefined
      if (leafEl && surface === 'main') {
        const zone = zoneFromGuide(leafEl.getBoundingClientRect(), ev.clientX, ev.clientY, true)
        hoverLeaf = { tabsId: leafEl.dataset.dockTabs!, surface: 'main', zone }
        redock = zone ? { tabsId: leafEl.dataset.dockTabs!, zone } : null
      } else {
        hoverLeaf = null
        redock = null
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (redock) commit(dockWindowOnto(workspace, windowId, redock.tabsId, redock.zone, genId))
      draggingWindow = null
      target = null
      hoverLeaf = null
      document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function windowResizeStart(e: PointerEvent, windowId: string) {
    if (e.button !== 0) return
    e.stopPropagation()
    const w = workspace.floating.find((w) => w.id === windowId)
    if (!w) return
    const sx = e.clientX, sy = e.clientY, sw = w.width, sh = w.height
    const move = (ev: PointerEvent) => commit(resizeWindow(workspace, windowId, sw + (ev.clientX - sx), sh + (ev.clientY - sy)))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.userSelect = '' }
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // ------------------------------------------------------------- auto-hide fly-out
  let revealed = $state<string | null>(null) // entry id currently flown out
  const flyoutStyle = (e: { side: DockSide; size: number }) =>
    (e.side === 'left' || e.side === 'right' ? 'width' : 'height') + `: ${e.size}px`

  // Dismiss an open fly-out on an outside click or Escape (click a strip button
  // to toggle; the fly-out stays put while you interact inside it).
  $effect(() => {
    if (!revealed) return
    const onDown = (ev: PointerEvent) => {
      const el = ev.target as HTMLElement | null
      if (el?.closest('.sv-dockmgr__flyout') || el?.closest('.sv-dockmgr__strip')) return
      revealed = null
    }
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') revealed = null }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  })

  // Inset the tiled area so edge strips sit beside content, not over it. Must
  // match the fixed strip thickness in CSS (.sv-dockmgr__strip--*).
  const STRIP = 34
  const mainPad = $derived({
    left: workspace.autoHide.some((e) => e.side === 'left') ? STRIP : 0,
    right: workspace.autoHide.some((e) => e.side === 'right') ? STRIP : 0,
    top: workspace.autoHide.some((e) => e.side === 'top') ? STRIP : 0,
    bottom: workspace.autoHide.some((e) => e.side === 'bottom') ? STRIP : 0,
  })
  // The maximized tiled leaf (shown alone), or null. Guarded so a stale id noops.
  const maxLeaf = $derived(workspace.maximizedLeaf ? findLeafById(workspace, workspace.maximizedLeaf) : null)

  // -------------------------------------------------------- tab-action helpers
  function floatOne(paneId: string) {
    const r = rootEl?.getBoundingClientRect()
    commit(floatPane(workspace, paneId, { x: (r ? r.width : 400) * 0.3, y: 60, width: 340, height: 240 }, genId))
    emit({ type: 'float', paneId })
  }

  function findPaneObject(paneId: string): DockPane | null {
    const scan = (n: any): DockPane | null => {
      if (n.type === 'tabs') return n.panes.find((p: DockPane) => p.id === paneId) ?? null
      for (const c of n.children) { const hit = scan(c); if (hit) return hit }
      return null
    }
    if (workspace.main) { const m = scan(workspace.main); if (m) return m }
    for (const w of workspace.floating) { const p = w.leaf.panes.find((x) => x.id === paneId); if (p) return p }
    for (const e of workspace.autoHide) { const p = e.leaf.panes.find((x) => x.id === paneId); if (p) return p }
    return null
  }

  /** Pop a pane out into a REAL browser window. Falls back to a floating window
   *  if the browser blocks the pop-up. */
  function popoutPane(paneId: string) {
    if (popouts.has(paneId) || !rootEl) return
    const paneObj = findPaneObject(paneId)
    if (!paneObj) return
    const removed = closePane(workspace, paneId) // pull it out of the layout
    const handle = openPopout({
      pane: paneObj,
      paneSnippet: pane,
      themeSource: rootEl,
      onClose: (id) => popInPane(id),
    })
    if (!handle) { floatOne(paneId); return } // blocked -> float instead
    popouts.set(paneId, handle)
    commit(removed)
    emit({ type: 'popout', paneId })
  }

  /** Dock a popped-out pane back into the layout (window closed / API call). */
  function popInPane(paneId: string) {
    const handle = popouts.get(paneId)
    if (!handle) return
    popouts.delete(paneId)
    handle.destroy()
    commit(addPaneToMain(workspace, handle.pane, genId))
  }
  function leafIdOfPane(paneId: string): string | null {
    const findLeaf = (n: any): string | null => {
      if (n.type === 'tabs') return n.panes.some((p: DockPane) => p.id === paneId) ? n.id : null
      for (const c of n.children) { const id = findLeaf(c); if (id) return id }
      return null
    }
    return workspace.main ? findLeaf(workspace.main) : null
  }
  const mainRect = () => (rootEl?.querySelector('.sv-dockmgr__main') as HTMLElement | null)?.getBoundingClientRect()
  const leafRect = (tabsId: string) =>
    (rootEl?.querySelector(`[data-dock-tabs="${CSS.escape(tabsId)}"]`) as HTMLElement | null)?.getBoundingClientRect()

  /** Which edge a tiled leaf is nearest to - so the auto-hide button sends it to
   *  the side it already lives on. */
  function nearestSide(tabsId: string): DockSide {
    const lr = leafRect(tabsId), mr = mainRect()
    if (!lr || !mr || mr.width <= 0 || mr.height <= 0) return 'left'
    const cx = (lr.left + lr.right) / 2, cy = (lr.top + lr.bottom) / 2
    const dl = (cx - mr.left) / mr.width, dr = (mr.right - cx) / mr.width
    const dt = (cy - mr.top) / mr.height, db = (mr.bottom - cy) / mr.height
    const m = Math.min(dl, dr, dt, db)
    return m === dl ? 'left' : m === dr ? 'right' : m === dt ? 'top' : 'bottom'
  }

  function autoHidePane(paneId: string) {
    const tabsId = leafIdOfPane(paneId)
    if (!tabsId) return
    const side = nearestSide(tabsId)
    const lr = leafRect(tabsId)
    const size = lr ? Math.round(side === 'left' || side === 'right' ? lr.width : lr.height) : 260
    commit(autoHideLeaf(workspace, tabsId, side, size))
    emit({ type: 'autoHide', paneId, side })
  }
  function pinPane(paneId: string) {
    const entry = workspace.autoHide.find((e) => e.leaf.panes.some((p) => p.id === paneId))
    if (!entry) return
    const mr = mainRect()
    const dim = mr ? (entry.side === 'left' || entry.side === 'right' ? mr.width : mr.height) : 1000
    const frac = Math.min(0.5, Math.max(0.12, entry.size / (dim || 1000)))
    commit(pinAutoHidden(workspace, entry.id, genId, frac))
    emit({ type: 'pin', paneId })
  }

  /** Auto-hide a floating window to the manager edge nearest its position. */
  function autoHideWin(windowId: string) {
    const w = workspace.floating.find((f) => f.id === windowId)
    const mr = mainRect()
    if (!w || !mr) return
    const cx = w.x + w.width / 2, cy = w.y + w.height / 2
    const dl = cx, dr = mr.width - cx, dt = cy, db = mr.height - cy
    const m = Math.min(dl, dr, dt, db)
    const side: DockSide = m === dl ? 'left' : m === dr ? 'right' : m === dt ? 'top' : 'bottom'
    const size = side === 'left' || side === 'right' ? w.width : w.height
    commit(autoHideWindow(workspace, windowId, side, genId, Math.round(size)))
  }

  // Slide-in params for a fly-out, by which edge it lives on.
  const flyIn = (side: DockSide) => ({
    duration: 160,
    x: side === 'left' ? -20 : side === 'right' ? 20 : 0,
    y: side === 'top' ? -20 : side === 'bottom' ? 20 : 0,
  })

  // Drag the fly-out's inner edge to resize it; size is stored on the entry.
  function flyoutResizeStart(e: PointerEvent, entry: AutoHideEntry) {
    if (e.button !== 0) return
    e.preventDefault(); e.stopPropagation()
    const start = entry.size
    const sx = e.clientX, sy = e.clientY
    const move = (ev: PointerEvent) => {
      const d =
        entry.side === 'left' ? ev.clientX - sx
        : entry.side === 'right' ? sx - ev.clientX
        : entry.side === 'top' ? ev.clientY - sy
        : sy - ev.clientY
      commit(setAutoHideSize(workspace, entry.id, start + d))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // Imperative API, handed to the consumer once.
  onReady?.({
    getState: () => workspace,
    setState: (s) => commit(s),
    float: (id) => floatOne(id),
    popout: (id) => popoutPane(id),
    autoHide: (id) => autoHidePane(id),
    maximize: (tabsId) => { if (findLeafById(workspace, tabsId)) commit(toggleMaximizeLeaf(workspace, tabsId)) },
    close: (id) => commit(closePane(workspace, id)),
    focus: (id) => setFocus(id),
  })

  // Close every pop-out window when the manager itself is torn down.
  onDestroy(() => { for (const h of popouts.values()) h.destroy(); popouts.clear() })
</script>

<div class="sv-dockmgr" bind:this={rootEl}>
  <!-- Auto-hide edge strips. Vertical strips inset past the horizontal ones so
       the corners belong to top/bottom and nothing overlaps. -->
  {#each (['left', 'right', 'top', 'bottom'] as DockSide[]) as side (side)}
    {@const entries = workspace.autoHide.filter((e) => e.side === side)}
    {#if entries.length}
      <div
        class="sv-dockmgr__strip sv-dockmgr__strip--{side}"
        style:top={side === 'left' || side === 'right' ? `${mainPad.top}px` : undefined}
        style:bottom={side === 'left' || side === 'right' ? `${mainPad.bottom}px` : undefined}
      >
        {#each entries as e (e.id)}
          <!-- Auto-hide applies to the whole leaf, so surface one edge tab per
               pane (not one per entry). Clicking a pane's tab reveals the flyout
               with that pane active. -->
          {#each e.leaf.panes as p, pi (p.id)}
            <button
              type="button"
              class="sv-dockmgr__stab"
              class:is-open={revealed === e.id && e.leaf.active === pi}
              title={p.title}
              onclick={() => revealAutoHidePane(e, pi)}
            >{p.title}</button>
          {/each}
        {/each}
      </div>
    {/if}
  {/each}

  <!-- Docked (tiled) area. When a leaf is maximized, only that leaf is shown. -->
  <div
    class="sv-dockmgr__main"
    style:padding={`${mainPad.top}px ${mainPad.right}px ${mainPad.bottom}px ${mainPad.left}px`}
  >
    {#if maxLeaf}
      <SvDockLayout
        layout={maxLeaf}
        {pane}
        {minSize}
        {headerPosition}
        focusedLeaf={focusedLeafId}
        {keepAlive}
        {hideSingleTab}
        {locked}
        surface="main"
        onBeginDrag={beginTabDrag}
        externalDrop={guideGlobal}
        externalReorder={reorderTargetGlobal}
        {onActivate}
        {onClose}
        {onResize}
        leafActions={mainLeafActions}
      />
    {:else if workspace.main}
      <SvDockLayout
        layout={workspace.main}
        {pane}
        {minSize}
        {headerPosition}
        focusedLeaf={focusedLeafId}
        {keepAlive}
        {hideSingleTab}
        {locked}
        surface="main"
        onBeginDrag={beginTabDrag}
        externalDrop={guideGlobal}
        externalReorder={reorderTargetGlobal}
        {onActivate}
        {onClose}
        {onResize}
        leafActions={mainLeafActions}
      />
    {:else}
      <div class="sv-dockmgr__empty" data-dock-empty>Drag a panel here</div>
    {/if}
  </div>

  <!-- Auto-hide fly-out -->
  {#each workspace.autoHide as e (e.id)}
    {#if revealed === e.id}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="sv-dockmgr__flyout sv-dockmgr__flyout--{e.side}"
        style={flyoutStyle(e)}
        transition:fly={flyIn(e.side)}
      >
        <SvDockLayout
          layout={e.leaf}
          {pane}
          {minSize}
        {headerPosition}
        focusedLeaf={focusedLeafId}
        {keepAlive}
          hideSingleTab
          surface={e.id}
          onBeginDrag={beginTabDrag}
          externalDrop={guideGlobal}
          externalReorder={reorderTargetGlobal}
          {onActivate}
          {onClose}
          {onResize}
          leafActions={flyoutLeafActions}
        />
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="sv-dockmgr__flyresize sv-dockmgr__flyresize--{e.side}"
          onpointerdown={(ev) => flyoutResizeStart(ev, e)}
        ></div>
      </div>
    {/if}
  {/each}

  <!-- Floating windows -->
  {#each workspace.floating as w (w.id)}
    <div
      class="sv-dockmgr__window"
      class:is-minimized={w.minimized}
      class:is-maximized={w.maximized}
      style:left={w.maximized ? undefined : `${w.x}px`}
      style:top={w.maximized ? undefined : `${w.y}px`}
      style:width={w.maximized ? undefined : `${w.width}px`}
      style:height={w.maximized || w.minimized ? undefined : `${w.height}px`}
      style:z-index={100 + w.z}
      style:pointer-events={draggingWindow === w.id ? 'none' : undefined}
      onpointerdown={() => commit(bringToFront(workspace, w.id))}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="sv-dockmgr__winbar"
        ondblclick={() => commit(toggleWindowMaximized(workspace, w.id))}
        onpointerdown={(e) => { if (!w.maximized) windowDragStart(e, w.id) }}
      >
        <span class="sv-dockmgr__wintitle">{w.leaf.panes[w.leaf.active]?.title ?? 'Window'}</span>
        <div class="sv-dockmgr__winctl">
          <button type="button" title="Auto-hide" aria-label="Auto-hide window"
            onpointerdown={(e) => e.stopPropagation()} onclick={(e) => { e.stopPropagation(); autoHideWin(w.id); emit({ type: 'window', windowId: w.id, action: 'autoHide' }) }}>&#9663;</button>
          <button type="button" title={w.minimized ? 'Restore' : 'Minimize'} aria-label="Minimize window"
            onpointerdown={(e) => e.stopPropagation()} onclick={(e) => { e.stopPropagation(); commit(setWindowMinimized(workspace, w.id, !w.minimized)); emit({ type: 'window', windowId: w.id, action: 'minimize' }) }}>&#8211;</button>
          <button type="button" title={w.maximized ? 'Restore' : 'Maximize'} aria-label="Maximize window"
            onpointerdown={(e) => e.stopPropagation()} onclick={(e) => { e.stopPropagation(); commit(toggleWindowMaximized(workspace, w.id)); emit({ type: 'window', windowId: w.id, action: 'maximize' }) }}>{w.maximized ? '❐' : '□'}</button>
          <button type="button" class="sv-dockmgr__winclose" title="Close" aria-label="Close window"
            onpointerdown={(e) => e.stopPropagation()} onclick={(e) => { e.stopPropagation(); commit(closeWindow(workspace, w.id)); emit({ type: 'window', windowId: w.id, action: 'close' }) }}>&times;</button>
        </div>
      </div>
      {#if !w.minimized}
        <div class="sv-dockmgr__winbody">
          <SvDockLayout
            layout={w.leaf}
            {pane}
            {minSize}
        {headerPosition}
        focusedLeaf={focusedLeafId}
        {keepAlive}
            {hideSingleTab}
            surface={w.id}
            onBeginDrag={beginTabDrag}
            externalDrop={guideGlobal}
            externalReorder={reorderTargetGlobal}
            {onActivate}
            {onClose}
            {onResize}
          />
        </div>
        {#if !w.maximized}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="sv-dockmgr__winresize" onpointerdown={(e) => windowResizeStart(e, w.id)}></div>
        {/if}
      {/if}
    </div>
  {/each}

  <!-- Auto-hide edge drop indicator (drag a tab to the manager border). -->
  {#if autohideSide}
    <div class="sv-dockmgr__edgehint sv-dockmgr__edgehint--{autohideSide}" aria-hidden="true"></div>
  {/if}

  {#if ghost}
    <div class="sv-dockmgr__ghost" style:left={`${ghost.x + 12}px`} style:top={`${ghost.y + 12}px`}>{ghost.title}</div>
  {/if}
</div>

{#snippet mainLeafActions(leaf: DockTabs)}
  {@const active = leaf.panes[leaf.active] ?? leaf.panes[0]}
  <button type="button" class="sv-dockmgr__pact" title={workspace.maximizedLeaf === leaf.id ? 'Restore' : 'Maximize'} aria-label="Maximize panel"
    onpointerdown={(e) => e.stopPropagation()} onclick={(e) => { e.stopPropagation(); const on = workspace.maximizedLeaf !== leaf.id; commit(toggleMaximizeLeaf(workspace, leaf.id)); emit({ type: 'maximize', tabsId: leaf.id, maximized: on }) }}>{workspace.maximizedLeaf === leaf.id ? '❐' : '⤢'}</button>
  <button type="button" class="sv-dockmgr__pact" title="Auto-hide" aria-label="Auto-hide panel"
    onpointerdown={(e) => e.stopPropagation()} onclick={(e) => { e.stopPropagation(); if (active) autoHidePane(active.id) }}>&#9663;</button>
  {#if active}
    <button type="button" class="sv-dockmgr__pact" title="Float" aria-label="Float {active.title}"
      onpointerdown={(e) => e.stopPropagation()} onclick={(e) => { e.stopPropagation(); floatOne(active.id) }}>&#9634;</button>
    {#if allowPopout}
      <button type="button" class="sv-dockmgr__pact" title="Pop out to a new window" aria-label="Pop out {active.title}"
        onpointerdown={(e) => e.stopPropagation()} onclick={(e) => { e.stopPropagation(); popoutPane(active.id) }}>&#10697;</button>
    {/if}
  {/if}
{/snippet}

{#snippet flyoutLeafActions(leaf: DockTabs)}
  {@const active = leaf.panes[leaf.active] ?? leaf.panes[0]}
  {#if active}
    <button type="button" class="sv-dockmgr__pact" title="Pin" aria-label="Pin {active.title}"
      onpointerdown={(e) => e.stopPropagation()} onclick={(e) => { e.stopPropagation(); pinPane(active.id) }}>&#128204;</button>
  {/if}
{/snippet}

<script lang="ts" module>
  let MGR = 0
  function mgrBase(): number { MGR += 1; return MGR * 1_000_000 }
</script>

<style>
  .sv-dockmgr { position: relative; width: 100%; height: 100%; min-width: 0; min-height: 0; display: flex; }
  .sv-dockmgr__main { position: relative; flex: 1; min-width: 0; min-height: 0; display: flex; }
  .sv-dockmgr__main > :global(*) { flex: 1; min-width: 0; min-height: 0; }
  .sv-dockmgr__empty {
    flex: 1; display: flex; align-items: center; justify-content: center;
    color: var(--sg-muted, #94a3b8); font-size: 13px; border: 2px dashed var(--sg-border, #e2e8f0);
    border-radius: 10px; margin: 8px;
  }

  /* Auto-hide edge strips. Fixed 34px thickness == the main-area inset, so a
     strip sits BESIDE the tiled content instead of overlapping it. */
  .sv-dockmgr__strip {
    position: absolute; z-index: 40; display: flex; gap: 4px; padding: 4px;
    background: var(--sg-header-bg, #f6f7f9); box-sizing: border-box;
  }
  .sv-dockmgr__strip--left { left: 0; top: 0; bottom: 0; width: 34px; flex-direction: column; align-items: center; border-right: 1px solid var(--sg-border, #e2e8f0); }
  .sv-dockmgr__strip--right { right: 0; top: 0; bottom: 0; width: 34px; flex-direction: column; align-items: center; border-left: 1px solid var(--sg-border, #e2e8f0); }
  .sv-dockmgr__strip--top { top: 0; left: 0; right: 0; height: 34px; align-items: center; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-dockmgr__strip--bottom { bottom: 0; left: 0; right: 0; height: 34px; align-items: center; border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-dockmgr__stab {
    font: inherit; font-size: 12px; font-weight: 600; padding: 3px 8px; cursor: pointer;
    color: var(--sg-muted, #64748b); background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 6px; white-space: nowrap;
    display: inline-flex; align-items: center; max-width: 100%;
  }
  .sv-dockmgr__strip--left .sv-dockmgr__stab, .sv-dockmgr__strip--right .sv-dockmgr__stab { writing-mode: vertical-rl; padding: 8px 3px; max-height: 60%; overflow: hidden; }
  .sv-dockmgr__strip--top .sv-dockmgr__stab, .sv-dockmgr__strip--bottom .sv-dockmgr__stab { max-width: 40%; overflow: hidden; text-overflow: ellipsis; }
  .sv-dockmgr__stab:hover, .sv-dockmgr__stab.is-open { color: var(--sg-accent, #2563eb); border-color: var(--sg-accent, #2563eb); }

  /* Auto-hide fly-out. Capped so revealing never covers the whole workspace. */
  .sv-dockmgr__flyout {
    position: absolute; z-index: 60; display: flex;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px; box-shadow: 0 12px 40px -8px rgba(15,23,42,0.45); overflow: hidden;
  }
  .sv-dockmgr__flyout > :global(*) { flex: 1; }
  .sv-dockmgr__flyout--left { left: 35px; top: 4px; bottom: 4px; max-width: 62%; }
  .sv-dockmgr__flyout--right { right: 35px; top: 4px; bottom: 4px; max-width: 62%; }
  .sv-dockmgr__flyout--top { top: 35px; left: 4px; right: 4px; max-height: 62%; }
  .sv-dockmgr__flyout--bottom { bottom: 35px; left: 4px; right: 4px; max-height: 62%; }

  /* Fly-out resize handle on the panel's inner edge. */
  .sv-dockmgr__flyresize { position: absolute; z-index: 2; touch-action: none; }
  .sv-dockmgr__flyresize--left { top: 0; bottom: 0; right: -3px; width: 7px; cursor: ew-resize; }
  .sv-dockmgr__flyresize--right { top: 0; bottom: 0; left: -3px; width: 7px; cursor: ew-resize; }
  .sv-dockmgr__flyresize--top { left: 0; right: 0; bottom: -3px; height: 7px; cursor: ns-resize; }
  .sv-dockmgr__flyresize--bottom { left: 0; right: 0; top: -3px; height: 7px; cursor: ns-resize; }
  .sv-dockmgr__flyresize:hover { background: color-mix(in srgb, var(--sg-accent, #2563eb) 40%, transparent); }

  /* Floating windows */
  .sv-dockmgr__window {
    position: absolute; display: flex; flex-direction: column; min-width: 140px; min-height: 90px;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px;
    box-shadow: 0 18px 50px -12px rgba(15,23,42,0.5); overflow: hidden;
  }
  .sv-dockmgr__window.is-maximized { inset: 4px; width: auto; height: auto; border-radius: 8px; }
  .sv-dockmgr__window.is-minimized { min-height: 0; height: auto; width: 220px; }
  .sv-dockmgr__winbar {
    flex: none; height: 28px; display: flex; align-items: center; gap: 8px; padding: 0 4px 0 10px; cursor: grab;
    background: var(--sg-header-bg, #f6f7f9); border-bottom: 1px solid var(--sg-border, #e2e8f0);
    user-select: none; touch-action: none;
  }
  .sv-dockmgr__window.is-maximized .sv-dockmgr__winbar { cursor: default; }
  .sv-dockmgr__wintitle { flex: 1; min-width: 0; font-size: 12px; font-weight: 700; color: var(--sg-fg, #0f172a); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-dockmgr__winctl { flex: none; display: flex; align-items: center; gap: 1px; }
  .sv-dockmgr__winctl button {
    display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 20px;
    padding: 0; font-size: 13px; line-height: 1; color: var(--sg-muted, #64748b); cursor: pointer;
    background: none; border: none; border-radius: 5px;
  }
  .sv-dockmgr__winctl button:hover { background: color-mix(in srgb, var(--sg-fg, #0f172a) 8%, transparent); color: var(--sg-fg, #0f172a); }
  .sv-dockmgr__winclose:hover { background: var(--sg-danger, #dc2626) !important; color: #fff !important; }
  .sv-dockmgr__winbody { flex: 1; min-height: 0; display: flex; }
  .sv-dockmgr__winbody > :global(*) { flex: 1; min-width: 0; min-height: 0; }
  .sv-dockmgr__winresize {
    position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; touch-action: none;
    background: linear-gradient(135deg, transparent 50%, var(--sg-border, #cbd5e1) 50%);
  }

  .sv-dockmgr__pact {
    display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px;
    padding: 0; font-size: 11px; line-height: 1; color: var(--sg-muted, #94a3b8); cursor: pointer;
    background: none; border: none; border-radius: 4px;
  }
  .sv-dockmgr__pact:hover { background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-accent, #2563eb); }

  /* Auto-hide edge drop indicator: a bar along the manager border. */
  .sv-dockmgr__edgehint {
    position: absolute; z-index: 70; pointer-events: none;
    background: color-mix(in srgb, var(--sg-accent, #2563eb) 30%, transparent);
    border: 2px solid var(--sg-accent, #2563eb); border-radius: 6px;
  }
  .sv-dockmgr__edgehint--left { left: 2px; top: 2px; bottom: 2px; width: 46px; }
  .sv-dockmgr__edgehint--right { right: 2px; top: 2px; bottom: 2px; width: 46px; }
  .sv-dockmgr__edgehint--top { top: 2px; left: 2px; right: 2px; height: 40px; }
  .sv-dockmgr__edgehint--bottom { bottom: 2px; left: 2px; right: 2px; height: 40px; }

  .sv-dockmgr__ghost {
    position: fixed; z-index: 2147483646; pointer-events: none; padding: 5px 10px; font-size: 12.5px;
    font-weight: 600; color: var(--sg-on-accent, #fff); background: var(--sg-accent, #2563eb);
    border-radius: 6px; box-shadow: 0 8px 24px -6px rgba(15,23,42,0.5);
  }
</style>
