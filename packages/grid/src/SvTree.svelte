<script lang="ts" module>
  export type { TreeNode } from './createTree.svelte'
</script>

<script lang="ts">
  /**
   * SvTree - a WAI-ARIA tree view. Expand/collapse, single-select highlight,
   * cascading tri-state checkboxes, keyboard, and - for large or remote data -
   * fixed-row `virtual` windowing (scales to tens of thousands of nodes) and
   * `loadChildren` lazy-loading. Parity: Smart `smart-tree`.
   *
   * The behavior (flattening, cascade math, keyboard, ARIA) lives in the headless
   * `createTree` core; this component renders it, and owns the DOM concerns
   * (windowing, focus, and merging lazily-loaded children into the node tree).
   */
  import { tick, flushSync } from 'svelte'
  import { type EditorDir } from './editor-contract'
  import { virtualRange, scrollToIndex } from './virtual'
  import { createTree, sortTreeNodes, type TreeNode, type TreeDropPosition } from './createTree.svelte'

  type Props = {
    nodes: ReadonlyArray<TreeNode>
    /** Selected node id (single-select highlight). */
    selected?: string | null
    onSelect?: (id: string) => void
    /** Initially/controlled expanded ids. */
    expandedIds?: string[]
    onToggle?: (id: string, expanded: boolean) => void
    /** Show cascading checkboxes; `checked` is the set of checked ids. */
    checkable?: boolean
    checked?: string[]
    onCheck?: (ids: string[]) => void
    ariaLabel?: string
    /** Text direction (rtl mirrors indentation + flips Left/Right keys). */
    dir?: EditorDir
    /** Window rows (render only visible) - for large trees. Needs `height`. */
    virtual?: boolean
    /** Fixed row height in px (must match the CSS). Default 30. */
    rowHeight?: number
    /** Scroll-viewport height in px. Enables scrolling (required for `virtual`). */
    height?: number
    /** Load a lazy node's children on first expand (node has `lazy: true`). */
    loadChildren?: (node: TreeNode) => Promise<TreeNode[]>
    /** Filter query - show only matching nodes + ancestors, auto-expanded. */
    filter?: string
    /** Render a built-in search box that drives the filter. */
    searchable?: boolean
    searchPlaceholder?: string
    /** Sort siblings by label ('asc'/'desc') or a custom comparator. */
    sort?: 'asc' | 'desc' | ((a: TreeNode, b: TreeNode) => number)
    /** Allow inline rename (double-click or F2). Fires onRename. */
    editable?: boolean
    onRename?: (id: string, label: string) => void
    /** Allow drag-drop reordering; fires onMove(dragId, targetId, position).
     *  Apply it with the exported `moveTreeNode(nodes, ...)` helper. */
    reorderable?: boolean
    onMove?: (dragId: string, targetId: string, position: TreeDropPosition) => void
  }

  let {
    nodes,
    selected = null,
    onSelect,
    expandedIds,
    onToggle,
    checkable = false,
    checked = [],
    onCheck,
    ariaLabel,
    dir,
    virtual = false,
    rowHeight = 30,
    height,
    loadChildren,
    filter,
    searchable = false,
    searchPlaceholder = 'Search...',
    sort,
    editable = false,
    onRename,
    reorderable = false,
    onMove,
  }: Props = $props()

  const resolvedDir = $derived(dir === 'ltr' || dir === 'rtl' ? dir : undefined)
  let query = $state('')
  const effectiveFilter = $derived(filter ?? (searchable ? query : undefined))

  // Sort siblings (recursively) before anything else.
  const sortedNodes = $derived.by(() => {
    if (!sort) return nodes
    const cmp = typeof sort === 'function' ? sort : (a: TreeNode, b: TreeNode) => (sort === 'asc' ? 1 : -1) * a.label.localeCompare(b.label)
    return sortTreeNodes(nodes, cmp)
  })

  // --- Lazy loading: merge loaded children into the (controlled) node tree -----
  let loaded = $state(new Map<string, TreeNode[]>())
  let loadingIds = $state(new Set<string>())

  function inject(list: ReadonlyArray<TreeNode>): TreeNode[] {
    return list.map((n) => {
      if (n.lazy && loaded.has(n.id)) return { ...n, children: inject(loaded.get(n.id)!), lazy: false }
      if (n.children?.length) return { ...n, children: inject(n.children) }
      return n
    })
  }
  const effectiveNodes = $derived(inject(sortedNodes))

  // --- Inline rename ----------------------------------------------------------
  let editingId = $state<string | null>(null)
  let draftLabel = $state('')
  function startEdit(node: TreeNode) {
    if (!editable || node.disabled) return
    editingId = node.id
    draftLabel = node.label
    tick().then(() => treeEl?.querySelector<HTMLInputElement>('.sv-tree__edit')?.select())
  }
  function commitEdit() {
    if (editingId == null) return
    const id = editingId
    const label = draftLabel.trim()
    editingId = null
    if (label) onRename?.(id, label)
  }
  function cancelEdit() { editingId = null }

  // --- Drag-drop reorder ------------------------------------------------------
  let dragId = $state<string | null>(null)
  let dropId = $state<string | null>(null)
  let dropPos = $state<TreeDropPosition | null>(null)
  function computeDropPos(e: DragEvent, node: TreeNode): TreeDropPosition {
    const el = e.currentTarget as HTMLElement
    const r = el.getBoundingClientRect()
    const y = (e.clientY - r.top) / r.height
    const canNest = !!node.children?.length || !!node.lazy
    if (y < 0.3) return 'before'
    if (y > 0.7 || !canNest) return y > 0.5 ? 'after' : (canNest ? 'inside' : 'after')
    return 'inside'
  }
  function onRowDragStart(e: DragEvent, node: TreeNode) {
    dragId = node.id
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  }
  function onRowDragOver(e: DragEvent, node: TreeNode) {
    if (!dragId || dragId === node.id) return
    e.preventDefault()
    dropId = node.id
    dropPos = computeDropPos(e, node)
  }
  function onRowDrop(e: DragEvent, node: TreeNode) {
    e.preventDefault()
    if (dragId && dragId !== node.id && dropPos) onMove?.(dragId, node.id, dropPos)
    dragId = dropId = dropPos = null
  }
  function endDrag() { dragId = dropId = dropPos = null }

  function findNode(list: ReadonlyArray<TreeNode>, id: string): TreeNode | null {
    for (const n of list) {
      if (n.id === id) return n
      if (n.children) { const f = findNode(n.children, id); if (f) return f }
    }
    return null
  }

  async function handleToggle(id: string, expanded: boolean) {
    onToggle?.(id, expanded)
    if (!expanded || !loadChildren) return
    // Search the merged tree, not the raw prop: a nested lazy node (revealed by
    // a parent's earlier load) lives inside `loaded`, never in `nodes`.
    const node = findNode(effectiveNodes, id)
    if (!node?.lazy || loaded.has(id) || loadingIds.has(id)) return
    loadingIds = new Set(loadingIds).add(id)
    // A placeholder row shows immediately while the promise resolves.
    loaded = new Map(loaded).set(id, [{ id: `${id}__loading`, label: 'Loading...', disabled: true }])
    try {
      const kids = await loadChildren(node)
      loaded = new Map(loaded).set(id, kids)
    } catch {
      loaded = new Map(loaded).set(id, [])
    } finally {
      const next = new Set(loadingIds); next.delete(id); loadingIds = next
    }
  }

  const tree = createTree({
    nodes: () => effectiveNodes,
    selected: () => selected,
    onSelect: (id) => onSelect?.(id),
    expandedIds: () => expandedIds,
    onToggle: handleToggle,
    checkable: () => checkable,
    checked: () => checked,
    onCheck: (ids) => onCheck?.(ids),
    ariaLabel: () => ariaLabel,
    dir: () => dir,
    filter: () => effectiveFilter,
  })

  // --- Virtualization ---------------------------------------------------------
  const scrollable = $derived(virtual || height != null)
  let treeEl = $state<HTMLDivElement | null>(null)
  let scrollTop = $state(0)
  let viewportH = $state(0)
  const vr = $derived(
    virtualRange({ scrollTop, viewportHeight: viewportH, rowHeight, count: tree.rows.length, overscan: 10 }),
  )
  const visibleRows = $derived(virtual ? tree.rows.slice(vr.start, vr.end) : tree.rows)

  // Follow the core's roving focus row; scroll it into view first when windowed.
  let lastFocusTick = 0
  $effect(() => {
    if (tree.focusTick === lastFocusTick) return
    lastFocusTick = tree.focusTick
    const i = tree.activeIndex
    if (virtual && treeEl) {
      const next = scrollToIndex(i, scrollTop, treeEl.clientHeight, rowHeight)
      if (next !== scrollTop) { treeEl.scrollTop = next; scrollTop = next }
    }
    tick().then(() => treeEl?.querySelector<HTMLElement>(`[data-row="${i}"]`)?.focus())
  })
</script>

<div class="sv-tree-host" class:has-search={searchable} dir={resolvedDir}>
{#if searchable}
  <div class="sv-tree__search">
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
    <input class="sv-tree__search-input" type="text" placeholder={searchPlaceholder} bind:value={query} aria-label={searchPlaceholder} />
    {#if query}<button type="button" class="sv-tree__search-clear" aria-label="Clear search" onclick={() => (query = '')}>&times;</button>{/if}
  </div>
{/if}
<div
  bind:this={treeEl}
  class="sv-tree"
  class:sv-tree--scroll={scrollable}
  class:is-virtual={virtual}
  dir={resolvedDir}
  style:height={height != null ? `${height}px` : undefined}
  onscroll={scrollable ? (e) => { scrollTop = e.currentTarget.scrollTop; if (virtual) flushSync() } : undefined}
  bind:clientHeight={viewportH}
  {...tree.treeProps()}
>
  {#if virtual}<div class="sv-tree__sizer" aria-hidden="true" style:height={`${vr.totalHeight}px`}></div>{/if}
  {#each visibleRows as item (item.node.id)}
    {@render treeRow(item)}
  {/each}
</div>
</div>

{#snippet treeRow(item)}
  {@const cs = checkable ? tree.checkStateOf(item.node) : 'unchecked'}
  {@const isLoading = loadingIds.has(item.node.id)}
  <div
    class="sv-tree__row"
    class:is-selected={item.node.id === selected}
    class:is-disabled={item.node.disabled}
    class:is-dragging={dragId === item.node.id}
    class:drop-before={dropId === item.node.id && dropPos === 'before'}
    class:drop-after={dropId === item.node.id && dropPos === 'after'}
    class:drop-inside={dropId === item.node.id && dropPos === 'inside'}
    style:height={`${rowHeight}px`}
    style:padding-inline-start={`${item.depth * 18 + 6}px`}
    style:transform={virtual ? `translateY(${item.index * rowHeight}px)` : undefined}
    draggable={reorderable && editingId !== item.node.id && !item.node.disabled}
    ondragstart={reorderable ? (e) => onRowDragStart(e, item.node) : undefined}
    ondragover={reorderable ? (e) => onRowDragOver(e, item.node) : undefined}
    ondragleave={reorderable ? () => { if (dropId === item.node.id) { dropId = null; dropPos = null } } : undefined}
    ondrop={reorderable ? (e) => onRowDrop(e, item.node) : undefined}
    ondragend={reorderable ? endDrag : undefined}
    ondblclick={editable ? () => startEdit(item.node) : undefined}
    onkeydown={editable ? (e) => { if (e.key === 'F2') { e.preventDefault(); startEdit(item.node) } } : undefined}
    {...tree.itemProps(item)}
  >
    <button
      type="button"
      class="sv-tree__twist"
      class:is-open={item.open}
      class:is-leaf={!item.hasChildren}
      class:is-loading={isLoading}
      tabindex="-1"
      aria-hidden={!item.hasChildren}
      onclick={(e) => { e.stopPropagation(); tree.toggleExpand(item.node) }}
    >
      {#if isLoading}
        <svg class="sv-tree__spin" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.6" /></svg>
      {:else if item.hasChildren}
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      {/if}
    </button>
    {#if checkable}
      <button type="button" class="sv-tree__check is-{cs}" tabindex="-1" aria-hidden="true" onclick={(e) => { e.stopPropagation(); tree.toggleCheck(item.node) }}>
        {#if cs === 'checked'}<svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        {:else if cs === 'indeterminate'}<svg viewBox="0 0 16 16"><path d="M4 8h8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" /></svg>{/if}
      </button>
    {/if}
    {#if editingId === item.node.id}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        class="sv-tree__edit"
        bind:value={draftLabel}
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitEdit() } else if (e.key === 'Escape') { e.preventDefault(); cancelEdit() } }}
        onblur={commitEdit}
      />
    {:else}
      <span class="sv-tree__label">{item.node.label}</span>
    {/if}
  </div>
{/snippet}

<style>
  .sv-tree-host { display: contents; }
  .sv-tree-host.has-search { display: inline-flex; flex-direction: column; gap: 6px; }
  .sv-tree__search {
    display: flex; align-items: center; gap: 7px; width: 260px; box-sizing: border-box; padding: 0 10px; height: 32px;
    background: var(--sg-input-bg, #fff); color: var(--sg-muted, #64748b);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
  }
  .sv-tree__search:focus-within { border-color: var(--sg-accent, #2563eb); box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-accent, #2563eb) 22%, transparent); }
  .sv-tree__search-input { flex: 1; min-width: 0; border: 0; background: none; outline: none; color: var(--sg-fg, #0f172a); font: inherit; font-size: 13px; }
  .sv-tree__search-clear { background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; font-size: 16px; line-height: 1; padding: 0 2px; }
  .sv-tree {
    --_accent: var(--sg-accent, #2563eb);
    width: 260px; padding: 4px; user-select: none;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px);
    font-size: 13px;
  }
  .sv-tree--scroll { overflow-y: auto; }
  .sv-tree.is-virtual { position: relative; will-change: scroll-position; }
  .sv-tree__sizer { padding: 0; margin: 0; pointer-events: none; }
  .sv-tree.is-virtual .sv-tree__row { position: absolute; inset-inline: 4px; top: 4px; }
  .sv-tree__row {
    display: flex; align-items: center; gap: 4px; box-sizing: border-box; padding-inline-end: 8px;
    border-radius: 6px; cursor: pointer; outline: none;
  }
  .sv-tree__row:hover:not(.is-disabled) { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-tree__row.is-selected { background: color-mix(in srgb, var(--_accent) 15%, transparent); color: var(--_accent); font-weight: 600; }
  .sv-tree__row.is-disabled { opacity: 0.45; cursor: not-allowed; }
  .sv-tree__row:focus-visible { box-shadow: inset 0 0 0 2px var(--sg-focus-ring, var(--_accent)); }
  .sv-tree__twist {
    display: grid; place-items: center; width: 18px; height: 18px; flex: none;
    background: none; border: 0; color: var(--sg-muted, #64748b); cursor: pointer; transition: transform 0.12s;
  }
  .sv-tree__twist.is-open { transform: rotate(90deg); }
  .sv-tree[dir='rtl'] .sv-tree__twist:not(.is-open) svg { transform: scaleX(-1); }
  .sv-tree__twist.is-leaf { visibility: hidden; }
  .sv-tree__twist.is-loading { transform: none; }
  .sv-tree__spin { animation: sv-tree-spin 0.7s linear infinite; }
  @keyframes sv-tree-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .sv-tree__spin { animation: none; } }
  .sv-tree__check {
    display: grid; place-items: center; width: 16px; height: 16px; flex: none; padding: 0;
    border: 1.5px solid var(--sg-border, #cbd5e1); border-radius: 4px; background: var(--sg-input-bg, #fff);
    color: var(--sg-on-accent, #fff); cursor: pointer;
  }
  .sv-tree__check.is-checked, .sv-tree__check.is-indeterminate { background: var(--_accent); border-color: var(--_accent); }
  .sv-tree__check svg { width: 100%; height: 100%; }
  .sv-tree__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-tree__edit {
    flex: 1; min-width: 0; height: 22px; padding: 0 6px; margin: 0; font: inherit; font-size: 13px;
    border: 1px solid var(--_accent); border-radius: 5px; background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); outline: none;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent);
  }
  /* Drag-drop feedback */
  .sv-tree__row.is-dragging { opacity: 0.4; }
  .sv-tree__row.drop-inside { background: color-mix(in srgb, var(--_accent) 18%, transparent); box-shadow: inset 0 0 0 1px var(--_accent); }
  .sv-tree__row.drop-before, .sv-tree__row.drop-after { position: relative; }
  .sv-tree__row.drop-before::before, .sv-tree__row.drop-after::after {
    content: ''; position: absolute; inset-inline: 4px; height: 2px; background: var(--_accent); border-radius: 2px; z-index: 1;
  }
  .sv-tree__row.drop-before::before { top: -1px; }
  .sv-tree__row.drop-after::after { bottom: -1px; }
</style>
