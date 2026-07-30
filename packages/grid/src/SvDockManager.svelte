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
  import type { Snippet } from 'svelte'
  import SvDockLayout from './SvDockLayout.svelte'
  import type { DockPane, DockZone } from './dock-model'
  import {
    reorderTab,
    setManagerActive,
    resizeGroup,
    closePane,
    dockPaneOnto,
    floatPane,
    dockPaneToEmptyMain,
    dockWindowOnto,
    moveWindow,
    resizeWindow,
    bringToFront,
    autoHideLeaf,
    pinAutoHidden,
    type DockManagerState,
    type DockSide,
  } from './dock-manager-model'

  type Props = {
    /** The whole workspace: tiled `main` + `floating` windows + `autoHide` edges. Bindable. */
    workspace: DockManagerState
    /** Renders each pane's content, keyed off the `DockPane`. */
    pane: Snippet<[DockPane]>
    /** Notified after any change. */
    onChange?: (workspace: DockManagerState) => void
    /** Minimum pane size in px along a split. Default 80. */
    minSize?: number
  }

  let { workspace = $bindable(), pane, onChange, minSize = 80 }: Props = $props()

  let rootEl = $state<HTMLElement | null>(null)
  let nextId = mgrBase()
  const genId = () => `dm-${nextId++}`
  function commit(next: DockManagerState) { workspace = next; onChange?.(next) }

  // Controlled handlers each SvDockLayout routes back to the manager.
  const onActivate = (tabsId: string, i: number) => commit(setManagerActive(workspace, tabsId, i))
  const onClose = (paneId: string) => commit(closePane(workspace, paneId))
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
    | { kind: 'empty-main' }
    | { kind: 'float' }
  let ghost = $state<{ title: string; x: number; y: number } | null>(null)
  let target = $state<Target | null>(null)
  let src: { paneId: string; sourceTabsId: string; sx: number; sy: number } | null = null
  let draggingWindow = $state<string | null>(null)

  function beginTabDrag(e: PointerEvent, paneId: string, tabsId: string) {
    src = { paneId, sourceTabsId: tabsId, sx: e.clientX, sy: e.clientY }
    window.addEventListener('pointermove', onTabMove)
    window.addEventListener('pointerup', onTabUp)
  }

  function insertIndex(strip: Element, x: number): number {
    const tabsEls = Array.from(strip.querySelectorAll('[data-dock-tab]')) as HTMLElement[]
    for (let i = 0; i < tabsEls.length; i++) {
      const r = tabsEls[i]!.getBoundingClientRect()
      if (x < r.left + r.width / 2) return i
    }
    return tabsEls.length
  }

  function zoneAt(leaf: HTMLElement, x: number, y: number, edges: boolean): DockZone {
    if (!edges) return 'center'
    const r = leaf.getBoundingClientRect()
    const rx = (x - r.left) / r.width
    const ry = (y - r.top) / r.height
    const m = Math.min(rx, 1 - rx, ry, 1 - ry)
    if (m > 0.25) return 'center'
    return m === rx ? 'left' : m === 1 - rx ? 'right' : m === ry ? 'top' : 'bottom'
  }

  function computeTarget(x: number, y: number): Target {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    if (!el || !rootEl?.contains(el)) {
      // Outside the manager entirely -> float (unless still over nothing inside).
      return { kind: 'float' }
    }
    const leafEl = el.closest('[data-dock-tabs]') as HTMLElement | null
    const strip = el.closest('.sv-dock__tabstrip')
    if (leafEl && strip && leafEl.dataset.dockTabs === src!.sourceTabsId) {
      return { kind: 'reorder', tabsId: src!.sourceTabsId, index: insertIndex(strip, x) }
    }
    if (leafEl) {
      const surface = (leafEl.closest('[data-dock-surface]') as HTMLElement | null)?.dataset.dockSurface ?? 'main'
      return { kind: 'dock', surface, tabsId: leafEl.dataset.dockTabs!, zone: zoneAt(leafEl, x, y, surface === 'main') }
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
    src = null; ghost = null; target = null
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

  /** The drop highlight to hand each surface's SvDockLayout. */
  function dropForSurface(surface: string): { tabsId: string; zone: DockZone } | null {
    return target && target.kind === 'dock' && target.surface === surface
      ? { tabsId: target.tabsId, zone: target.zone }
      : null
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
      // Hovering the main area edges arms a redock.
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const leafEl = el?.closest('[data-dock-tabs]') as HTMLElement | null
      const surface = leafEl ? (leafEl.closest('[data-dock-surface]') as HTMLElement | null)?.dataset.dockSurface : undefined
      redock = leafEl && surface === 'main'
        ? { tabsId: leafEl.dataset.dockTabs!, zone: zoneAt(leafEl, ev.clientX, ev.clientY, true) }
        : null
      target = redock ? { kind: 'dock', surface: 'main', tabsId: redock.tabsId, zone: redock.zone } : null
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (redock) commit(dockWindowOnto(workspace, windowId, redock.tabsId, redock.zone, genId))
      draggingWindow = null
      target = null
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

  // Inset the tiled area so edge strips sit beside content, not over it.
  const STRIP = 30
  const mainPad = $derived({
    left: workspace.autoHide.some((e) => e.side === 'left') ? STRIP : 0,
    right: workspace.autoHide.some((e) => e.side === 'right') ? STRIP : 0,
    top: workspace.autoHide.some((e) => e.side === 'top') ? STRIP : 0,
    bottom: workspace.autoHide.some((e) => e.side === 'bottom') ? STRIP : 0,
  })

  // -------------------------------------------------------- tab-action helpers
  function floatOne(paneId: string) {
    const r = rootEl?.getBoundingClientRect()
    commit(floatPane(workspace, paneId, { x: (r ? r.width : 400) * 0.3, y: 60, width: 340, height: 240 }, genId))
  }
  function autoHidePane(paneId: string) {
    // Auto-hide the whole leaf that holds this pane (nearest side = left for now).
    const findLeaf = (n: any): string | null => {
      if (n.type === 'tabs') return n.panes.some((p: DockPane) => p.id === paneId) ? n.id : null
      for (const c of n.children) { const id = findLeaf(c); if (id) return id }
      return null
    }
    const tabsId = workspace.main ? findLeaf(workspace.main) : null
    if (tabsId) commit(autoHideLeaf(workspace, tabsId, 'left'))
  }
  function pinPane(paneId: string) {
    const entry = workspace.autoHide.find((e) => e.leaf.panes.some((p) => p.id === paneId))
    if (entry) commit(pinAutoHidden(workspace, entry.id, genId))
  }
</script>

<div class="sv-dockmgr" bind:this={rootEl}>
  <!-- Auto-hide edge strips -->
  {#each (['left', 'right', 'top', 'bottom'] as DockSide[]) as side (side)}
    {@const entries = workspace.autoHide.filter((e) => e.side === side)}
    {#if entries.length}
      <div class="sv-dockmgr__strip sv-dockmgr__strip--{side}">
        {#each entries as e (e.id)}
          {#each e.leaf.panes as p (p.id)}
            <button
              type="button"
              class="sv-dockmgr__stab"
              class:is-open={revealed === e.id}
              onclick={() => (revealed = revealed === e.id ? null : e.id)}
              onpointerenter={() => (revealed = e.id)}
            >{p.title}</button>
          {/each}
        {/each}
      </div>
    {/if}
  {/each}

  <!-- Docked (tiled) area -->
  <div
    class="sv-dockmgr__main"
    style:padding={`${mainPad.top}px ${mainPad.right}px ${mainPad.bottom}px ${mainPad.left}px`}
  >
    {#if workspace.main}
      <SvDockLayout
        layout={workspace.main}
        {pane}
        {minSize}
        surface="main"
        onBeginDrag={beginTabDrag}
        externalDrop={dropForSurface('main')}
        {onActivate}
        {onClose}
        {onResize}
        paneActions={paneActions}
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
        onpointerleave={() => (revealed = null)}
      >
        <SvDockLayout
          layout={e.leaf}
          {pane}
          {minSize}
          surface={e.id}
          onBeginDrag={beginTabDrag}
          externalDrop={dropForSurface(e.id)}
          {onActivate}
          {onClose}
          {onResize}
          paneActions={flyoutActions}
        />
      </div>
    {/if}
  {/each}

  <!-- Floating windows -->
  {#each workspace.floating as w (w.id)}
    <div
      class="sv-dockmgr__window"
      style:left={`${w.x}px`}
      style:top={`${w.y}px`}
      style:width={`${w.width}px`}
      style:height={`${w.height}px`}
      style:z-index={100 + w.z}
      style:pointer-events={draggingWindow === w.id ? 'none' : undefined}
      onpointerdown={() => commit(bringToFront(workspace, w.id))}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="sv-dockmgr__winbar" onpointerdown={(e) => windowDragStart(e, w.id)}>
        <span class="sv-dockmgr__wintitle">{w.leaf.panes[w.leaf.active]?.title ?? 'Window'}</span>
      </div>
      <div class="sv-dockmgr__winbody">
        <SvDockLayout
          layout={w.leaf}
          {pane}
          {minSize}
          surface={w.id}
          onBeginDrag={beginTabDrag}
          externalDrop={dropForSurface(w.id)}
          {onActivate}
          {onClose}
          {onResize}
          paneActions={paneActions}
        />
      </div>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="sv-dockmgr__winresize" onpointerdown={(e) => windowResizeStart(e, w.id)}></div>
    </div>
  {/each}

  {#if ghost}
    <div class="sv-dockmgr__ghost" style:left={`${ghost.x + 12}px`} style:top={`${ghost.y + 12}px`}>{ghost.title}</div>
  {/if}
</div>

{#snippet paneActions(p: DockPane)}
  <button
    type="button" class="sv-dockmgr__pact" title="Auto-hide" aria-label="Auto-hide {p.title}"
    onpointerdown={(e) => e.stopPropagation()}
    onclick={(e) => { e.stopPropagation(); autoHidePane(p.id) }}
  >&#9663;</button>
  <button
    type="button" class="sv-dockmgr__pact" title="Float" aria-label="Float {p.title}"
    onpointerdown={(e) => e.stopPropagation()}
    onclick={(e) => { e.stopPropagation(); floatOne(p.id) }}
  >&#9634;</button>
{/snippet}

{#snippet flyoutActions(p: DockPane)}
  <button
    type="button" class="sv-dockmgr__pact" title="Pin" aria-label="Pin {p.title}"
    onpointerdown={(e) => e.stopPropagation()}
    onclick={(e) => { e.stopPropagation(); pinPane(p.id) }}
  >&#128204;</button>
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

  /* Auto-hide edge strips */
  .sv-dockmgr__strip { position: absolute; z-index: 40; display: flex; gap: 4px; padding: 4px; }
  .sv-dockmgr__strip--left { left: 0; top: 0; bottom: 0; flex-direction: column; border-right: 1px solid var(--sg-border, #e2e8f0); }
  .sv-dockmgr__strip--right { right: 0; top: 0; bottom: 0; flex-direction: column; border-left: 1px solid var(--sg-border, #e2e8f0); }
  .sv-dockmgr__strip--top { top: 0; left: 0; right: 0; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-dockmgr__strip--bottom { bottom: 0; left: 0; right: 0; border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-dockmgr__stab {
    font: inherit; font-size: 12px; font-weight: 600; padding: 4px 10px; cursor: pointer;
    color: var(--sg-muted, #64748b); background: var(--sg-header-bg, #f6f7f9);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 6px; white-space: nowrap;
  }
  .sv-dockmgr__strip--left .sv-dockmgr__stab, .sv-dockmgr__strip--right .sv-dockmgr__stab { writing-mode: vertical-rl; }
  .sv-dockmgr__stab:hover, .sv-dockmgr__stab.is-open { color: var(--sg-accent, #2563eb); border-color: var(--sg-accent, #2563eb); }

  /* Auto-hide fly-out */
  .sv-dockmgr__flyout { position: absolute; z-index: 60; background: var(--sg-bg, #fff); box-shadow: 0 12px 40px -8px rgba(15,23,42,0.4); display: flex; }
  .sv-dockmgr__flyout > :global(*) { flex: 1; }
  .sv-dockmgr__flyout--left { left: 30px; top: 4px; bottom: 4px; }
  .sv-dockmgr__flyout--right { right: 30px; top: 4px; bottom: 4px; }
  .sv-dockmgr__flyout--top { top: 30px; left: 4px; right: 4px; }
  .sv-dockmgr__flyout--bottom { bottom: 30px; left: 4px; right: 4px; }

  /* Floating windows */
  .sv-dockmgr__window {
    position: absolute; display: flex; flex-direction: column; min-width: 140px; min-height: 90px;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px;
    box-shadow: 0 18px 50px -12px rgba(15,23,42,0.5); overflow: hidden;
  }
  .sv-dockmgr__winbar {
    flex: none; height: 26px; display: flex; align-items: center; padding: 0 10px; cursor: grab;
    background: var(--sg-header-bg, #f6f7f9); border-bottom: 1px solid var(--sg-border, #e2e8f0);
    user-select: none; touch-action: none;
  }
  .sv-dockmgr__wintitle { font-size: 12px; font-weight: 700; color: var(--sg-fg, #0f172a); }
  .sv-dockmgr__winbody { flex: 1; min-height: 0; display: flex; }
  .sv-dockmgr__winbody > :global(*) { flex: 1; min-width: 0; min-height: 0; }
  .sv-dockmgr__winresize {
    position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize;
    background: linear-gradient(135deg, transparent 50%, var(--sg-border, #cbd5e1) 50%);
  }

  .sv-dockmgr__pact {
    display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px;
    padding: 0; font-size: 11px; line-height: 1; color: var(--sg-muted, #94a3b8); cursor: pointer;
    background: none; border: none; border-radius: 4px;
  }
  .sv-dockmgr__pact:hover { background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-accent, #2563eb); }

  .sv-dockmgr__ghost {
    position: fixed; z-index: 2147483646; pointer-events: none; padding: 5px 10px; font-size: 12.5px;
    font-weight: 600; color: var(--sg-on-accent, #fff); background: var(--sg-accent, #2563eb);
    border-radius: 6px; box-shadow: 0 8px 24px -6px rgba(15,23,42,0.5);
  }
</style>
