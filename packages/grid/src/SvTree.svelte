<script lang="ts" module>
  export type TreeNode = {
    id: string
    label: string
    children?: TreeNode[]
    disabled?: boolean
  }
</script>

<script lang="ts">
  /**
   * SvTree - a WAI-ARIA tree view. Expand/collapse, single-select highlight, and
   * optional cascading tri-state checkboxes. Parity: Smart `smart-tree`. Keyboard:
   * up/down move, left collapse/parent, right expand/child, Enter/Space select.
   * The visible tree is flattened so roving-focus keyboard nav stays simple.
   */
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
  }: Props = $props()

  // Internal expanded set, seeded from the prop once (then self-managed unless
  // the prop identity changes).
  let expanded = $state<Set<string>>(new Set())
  let seededExp = false
  $effect(() => {
    if (!seededExp) { seededExp = true; if (expandedIds) expanded = new Set(expandedIds) }
  })

  type Flat = { node: TreeNode; depth: number; hasChildren: boolean; open: boolean; parentId: string | null }

  const flat = $derived.by<Flat[]>(() => {
    const out: Flat[] = []
    const walk = (list: ReadonlyArray<TreeNode>, depth: number, parentId: string | null) => {
      for (const node of list) {
        const hasChildren = !!node.children?.length
        const open = expanded.has(node.id)
        out.push({ node, depth, hasChildren, open, parentId })
        if (hasChildren && open) walk(node.children!, depth + 1, node.id)
      }
    }
    walk(nodes, 0, null)
    return out
  })

  let active = $state(0)
  $effect(() => { if (active >= flat.length) active = Math.max(0, flat.length - 1) })

  const checkedSet = $derived(new Set(checked))

  function descendantIds(node: TreeNode): string[] {
    const ids: string[] = []
    const walk = (n: TreeNode) => { for (const c of n.children ?? []) { ids.push(c.id); walk(c) } }
    walk(node)
    return ids
  }
  function checkState(node: TreeNode): 'checked' | 'indeterminate' | 'unchecked' {
    if (!node.children?.length) return checkedSet.has(node.id) ? 'checked' : 'unchecked'
    const desc = descendantIds(node)
    const on = desc.filter((id) => checkedSet.has(id)).length
    if (on === 0 && !checkedSet.has(node.id)) return 'unchecked'
    if (on === desc.length) return 'checked'
    return 'indeterminate'
  }

  function toggleExpand(node: TreeNode) {
    if (!node.children?.length) return
    const next = new Set(expanded)
    const willOpen = !next.has(node.id)
    willOpen ? next.add(node.id) : next.delete(node.id)
    expanded = next
    onToggle?.(node.id, willOpen)
  }
  function select(node: TreeNode) {
    if (node.disabled) return
    onSelect?.(node.id)
  }
  function toggleCheck(node: TreeNode) {
    if (node.disabled) return
    const next = new Set(checkedSet)
    const ids = [node.id, ...descendantIds(node)]
    const currentlyOn = checkState(node) === 'checked'
    for (const id of ids) currentlyOn ? next.delete(id) : next.add(id)
    onCheck?.([...next])
  }

  function onKeydown(e: KeyboardEvent) {
    const item = flat[active]
    if (!item) return
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); active = Math.min(active + 1, flat.length - 1); focusActive(); break
      case 'ArrowUp': e.preventDefault(); active = Math.max(active - 1, 0); focusActive(); break
      case 'ArrowRight':
        e.preventDefault()
        if (item.hasChildren && !item.open) toggleExpand(item.node)
        else if (item.hasChildren && item.open) { active = Math.min(active + 1, flat.length - 1); focusActive() }
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (item.hasChildren && item.open) toggleExpand(item.node)
        else if (item.parentId) { const pi = flat.findIndex((f) => f.node.id === item.parentId); if (pi >= 0) { active = pi; focusActive() } }
        break
      case 'Enter': e.preventDefault(); select(item.node); break
      case ' ': e.preventDefault(); checkable ? toggleCheck(item.node) : select(item.node); break
      case 'Home': e.preventDefault(); active = 0; focusActive(); break
      case 'End': e.preventDefault(); active = flat.length - 1; focusActive(); break
    }
  }

  let treeEl: HTMLDivElement | null = null
  function focusActive() {
    queueMicrotask(() => treeEl?.querySelector<HTMLElement>(`[data-row="${active}"]`)?.focus())
  }
</script>

<div bind:this={treeEl} class="sv-tree" role="tree" aria-label={ariaLabel} aria-multiselectable={checkable}>
  {#each flat as item, i (item.node.id)}
    {@const cs = checkable ? checkState(item.node) : 'unchecked'}
    <div
      class="sv-tree__row"
      class:is-selected={item.node.id === selected}
      class:is-disabled={item.node.disabled}
      role="treeitem"
      aria-level={item.depth + 1}
      aria-selected={item.node.id === selected}
      aria-expanded={item.hasChildren ? item.open : undefined}
      aria-checked={checkable ? cs === 'checked' ? 'true' : cs === 'indeterminate' ? 'mixed' : 'false' : undefined}
      data-row={i}
      tabindex={i === active ? 0 : -1}
      style:padding-left={`${item.depth * 18 + 6}px`}
      onclick={() => { active = i; select(item.node) }}
      onkeydown={onKeydown}
    >
      <button
        type="button"
        class="sv-tree__twist"
        class:is-open={item.open}
        class:is-leaf={!item.hasChildren}
        tabindex="-1"
        aria-hidden={!item.hasChildren}
        onclick={(e) => { e.stopPropagation(); toggleExpand(item.node) }}
      >
        {#if item.hasChildren}
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        {/if}
      </button>
      {#if checkable}
        <button type="button" class="sv-tree__check is-{cs}" tabindex="-1" aria-hidden="true" onclick={(e) => { e.stopPropagation(); toggleCheck(item.node) }}>
          {#if cs === 'checked'}<svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          {:else if cs === 'indeterminate'}<svg viewBox="0 0 16 16"><path d="M4 8h8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" /></svg>{/if}
        </button>
      {/if}
      <span class="sv-tree__label">{item.node.label}</span>
    </div>
  {/each}
</div>

<style>
  .sv-tree {
    --_accent: var(--sg-accent, #2563eb);
    width: 260px; padding: 4px; user-select: none;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px);
    font-size: 13px;
  }
  .sv-tree__row {
    display: flex; align-items: center; gap: 4px; height: 30px; padding-right: 8px;
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
  .sv-tree__twist.is-leaf { visibility: hidden; }
  .sv-tree__check {
    display: grid; place-items: center; width: 16px; height: 16px; flex: none; padding: 0;
    border: 1.5px solid var(--sg-border, #cbd5e1); border-radius: 4px; background: var(--sg-input-bg, #fff);
    color: var(--sg-on-accent, #fff); cursor: pointer;
  }
  .sv-tree__check.is-checked, .sv-tree__check.is-indeterminate { background: var(--_accent); border-color: var(--_accent); }
  .sv-tree__check svg { width: 100%; height: 100%; }
  .sv-tree__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
