<script lang="ts">
  /**
   * SvDockLayout - a basic docking layout: nested resizable split groups and
   * tabbed leaves, with drag-to-dock. Drag a pane's tab onto another pane and
   * drop it on an edge (split) or the centre (add as a tab); drag the splitters
   * to resize; close panes. The whole layout is a plain `DockNode` tree you pass
   * in and bind - every gesture is a pure transform from `dock-model`, so state
   * is serializable and testable. Inspired by Smart's `smart-layout`.
   *
   * Usage: build a tree with `dockGroup` / `dockTabs` / `dockPane`, bind it, and
   * provide a `pane` snippet that renders each pane's content by id:
   *
   *   let layout = $state(dockGroup('row', [
   *     dockTabs([dockPane('files', 'Files')]),
   *     dockTabs([dockPane('editor', 'Editor')]),
   *   ]))
   *
   *   <SvDockLayout bind:layout>
   *     {#snippet pane(p)} ...render by p.id... {/snippet}
   *   </SvDockLayout>
   */
  import { setContext, type Snippet } from 'svelte'
  import { DOCK_CONTEXT, type DockContext } from './dock-context'
  import DockNodeView from './DockNodeView.svelte'
  import {
    setActive,
    setSizes,
    removePane,
    movePane,
    type DockNode,
    type DockPane,
    type DockZone,
  } from './dock-model'

  type Props = {
    /** The layout tree. Bindable - every dock/resize/close writes a new tree. */
    layout: DockNode
    /** Renders each pane's content, keyed off the `DockPane`. */
    pane: Snippet<[DockPane]>
    /** Notified after any structural change (dock / resize / close). */
    onLayoutChange?: (layout: DockNode) => void
    /** Minimum pane size in px along the split axis. Default 80. */
    minSize?: number
    /** Surface id stamped on the root (`data-dock-surface`) - used by
     *  SvDockManager to hit-test which layout a drag is over. Default 'main'. */
    surface?: string
    /**
     * Manager mode: when provided, SvDockLayout hands OFF tab-drag to the parent
     * (SvDockManager) instead of running its own drag-to-dock, so a drag can flow
     * across the main area, floating windows and edge strips. Return value is
     * ignored; the manager owns the gesture from here.
     */
    onBeginDrag?: (event: PointerEvent, paneId: string, tabsId: string) => void
    /** Manager mode: the externally-computed dock guide/highlight to paint. */
    externalDrop?: { tabsId: string; zone: DockZone | null; centerOnly?: boolean } | null
    /** Manager mode: the externally-computed tab-reorder insertion indicator. */
    externalReorder?: { tabsId: string; index: number } | null
    /** Stack-header controls for a leaf (maximize / float / pop-out), rendered
     *  by the manager once per leaf at the right of its tab strip. */
    leafActions?: Snippet<[import('./dock-model').DockTabs]>
    /** Manager mode: route tab activation to the parent (controlled). */
    onActivate?: (tabsId: string, index: number) => void
    /** Manager mode: route pane close to the parent (controlled). */
    onClose?: (paneId: string) => void
    /** Manager mode: route splitter resize to the parent (controlled). */
    onResize?: (groupId: string, sizes: number[]) => void
    /** Which side of each leaf the tab strip sits on. Default `'top'`. */
    headerPosition?: 'top' | 'bottom' | 'left' | 'right'
    /** Manager mode: id of the focused leaf, for the active-panel highlight. */
    focusedLeaf?: string | null
    /** Keep inactive tabs mounted (hidden) so their content state persists. */
    keepAlive?: boolean
  }

  let {
    layout = $bindable(),
    pane,
    onLayoutChange,
    minSize = 80,
    surface = 'main',
    onBeginDrag,
    externalDrop = null,
    externalReorder = null,
    leafActions,
    onActivate,
    onClose,
    onResize,
    headerPosition = 'top',
    focusedLeaf = null,
    keepAlive = false,
  }: Props = $props()

  const managed = $derived(!!onBeginDrag)

  // Ids for nodes created by docking. The per-instance base (from a module
  // counter) keeps them unique across instances and clear of caller ids.
  let nextId = instanceBase()
  const genId = () => `dk-${nextId++}`

  function commit(next: DockNode) {
    layout = next
    onLayoutChange?.(next)
  }

  const activate = (tabsId: string, index: number) =>
    onActivate ? onActivate(tabsId, index) : commit(setActive(layout, tabsId, index))
  const resize = (groupId: string, sizes: number[]) =>
    onResize ? onResize(groupId, sizes) : commit(setSizes(layout, groupId, sizes))
  const close = (paneId: string) => {
    if (onClose) { onClose(paneId); return }
    const { root } = removePane(layout, paneId)
    if (root) commit(root)
  }

  // ---- drag-to-dock ------------------------------------------------------
  type Drag = { paneId: string; sourceTabsId: string; title: string; x: number; y: number }
  let drag = $state<Drag | null>(null)
  let dropTarget = $state<{ tabsId: string; zone: DockZone } | null>(null)
  let candidate: { paneId: string; sourceTabsId: string; title: string; sx: number; sy: number } | null = null

  function paneTitle(paneId: string): string {
    const walk = (n: DockNode): string | null => {
      if (n.type === 'tabs') return n.panes.find((p) => p.id === paneId)?.title ?? null
      for (const c of n.children) { const t = walk(c); if (t) return t }
      return null
    }
    return walk(layout) ?? ''
  }

  function beginDrag(e: PointerEvent, paneId: string, tabsId: string) {
    if (e.button !== 0) return
    // Manager mode: delegate the whole gesture to the parent.
    if (onBeginDrag) { onBeginDrag(e, paneId, tabsId); return }
    candidate = { paneId, sourceTabsId: tabsId, title: paneTitle(paneId), sx: e.clientX, sy: e.clientY }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  /** Which leaf is under the pointer, and which of its 5 zones. */
  function hitTest(x: number, y: number): { tabsId: string; zone: DockZone } | null {
    const el = document.elementFromPoint(x, y)?.closest('[data-dock-tabs]') as HTMLElement | null
    if (!el) return null
    const tabsId = el.dataset.dockTabs!
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return null
    const rx = (x - r.left) / r.width
    const ry = (y - r.top) / r.height
    const edge = 0.25
    const m = Math.min(rx, 1 - rx, ry, 1 - ry)
    let zone: DockZone = 'center'
    if (m <= edge) {
      const nearest = Math.min(rx, 1 - rx, ry, 1 - ry)
      zone = nearest === rx ? 'left' : nearest === 1 - rx ? 'right' : nearest === ry ? 'top' : 'bottom'
    }
    return { tabsId, zone }
  }

  function onPointerMove(e: PointerEvent) {
    if (!candidate) return
    if (!drag) {
      // Small threshold so a click-to-activate does not start a drag.
      if (Math.hypot(e.clientX - candidate.sx, e.clientY - candidate.sy) < 5) return
      drag = { paneId: candidate.paneId, sourceTabsId: candidate.sourceTabsId, title: candidate.title, x: e.clientX, y: e.clientY }
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'grabbing'
    }
    drag = { ...drag, x: e.clientX, y: e.clientY }
    dropTarget = hitTest(e.clientX, e.clientY)
  }

  function onPointerUp() {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    if (drag && dropTarget) {
      commit(movePane(layout, drag.paneId, dropTarget.tabsId, dropTarget.zone, genId))
    }
    drag = null
    dropTarget = null
    candidate = null
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }

  setContext<DockContext>(DOCK_CONTEXT, {
    get pane() { return pane },
    get leafActions() { return leafActions },
    activate,
    close,
    beginDrag,
    resize,
    minSize: () => minSize,
    // In manager mode the highlight is driven from outside.
    dropTarget: () => (managed ? externalDrop : dropTarget),
    reorderTarget: () => (managed ? externalReorder : null),
    headerPosition: () => headerPosition,
    focusedLeaf: () => focusedLeaf,
    keepAlive: () => keepAlive,
  })
</script>

<div class="sv-dock" class:is-dragging={!!drag} data-dock-surface={surface}>
  <DockNodeView node={layout} />
</div>

{#if drag}
  <div class="sv-dock__ghost" style:left={`${drag.x + 12}px`} style:top={`${drag.y + 12}px`}>
    {drag.title}
  </div>
{/if}

<script lang="ts" module>
  // Per-instance id base so concurrent layouts never mint the same node id.
  let SEQ = 0
  function instanceBase(): number {
    SEQ += 1
    return SEQ * 1_000_000
  }
</script>

<style>
  .sv-dock { width: 100%; height: 100%; min-width: 0; min-height: 0; display: flex; }
  .sv-dock > :global(*) { flex: 1; min-width: 0; min-height: 0; }
  .sv-dock.is-dragging { cursor: grabbing; }
  .sv-dock.is-dragging :global(.sv-dock__content) { pointer-events: none; }

  .sv-dock__ghost {
    position: fixed; z-index: 2147483646; pointer-events: none;
    padding: 5px 10px; font-size: 12.5px; font-weight: 600;
    color: var(--sg-on-accent, #fff); background: var(--sg-accent, #2563eb);
    border-radius: 6px; box-shadow: 0 8px 24px -6px rgba(15,23,42,0.5); opacity: 0.95;
  }
</style>
