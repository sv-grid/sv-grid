/**
 * createTree - the HEADLESS core behind <SvTree>, in the same spirit as
 * `createSvGrid` for the grid: a runes-based state machine (expand/collapse,
 * single-select highlight, cascading tri-state checkboxes, full keyboard) with
 * **prop-getters** you spread onto YOUR OWN markup. The visible tree is
 * flattened into `rows` so roving-focus keyboard nav stays a flat index walk.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createTree } from '@svgrid/grid'
 *   let selected = $state<string | null>(null)
 *   const tree = createTree({ nodes: () => nodes, selected: () => selected, onSelect: (id) => (selected = id) })
 * </script>
 * <div {...tree.treeProps()}>
 *   {#each tree.rows as row (row.node.id)}
 *     <div {...tree.itemProps(row)}>{row.node.label}</div>
 *   {/each}
 * </div>
 * ```
 *
 * The styled <SvTree> is just one renderer over this core. The cascade math
 * (`treeDescendantIds`, `treeCheckState`) is exported as pure functions.
 */
export type TreeNode = {
  id: string
  label: string
  children?: TreeNode[]
  disabled?: boolean
}

export type CheckState = 'checked' | 'indeterminate' | 'unchecked'

/** A single visible (flattened) tree row. */
export type TreeRow = {
  node: TreeNode
  depth: number
  hasChildren: boolean
  open: boolean
  parentId: string | null
  index: number
}

/** All descendant ids of `node` (pure, depth-first). */
export function treeDescendantIds(node: TreeNode): string[] {
  const ids: string[] = []
  const walk = (n: TreeNode) => { for (const c of n.children ?? []) { ids.push(c.id); walk(c) } }
  walk(node)
  return ids
}

/** Tri-state check status of `node` given the set of checked ids (pure). */
export function treeCheckState(node: TreeNode, checked: ReadonlySet<string>): CheckState {
  if (!node.children?.length) return checked.has(node.id) ? 'checked' : 'unchecked'
  const desc = treeDescendantIds(node)
  const on = desc.filter((id) => checked.has(id)).length
  if (on === 0 && !checked.has(node.id)) return 'unchecked'
  if (on === desc.length) return 'checked'
  return 'indeterminate'
}

function findNode(list: ReadonlyArray<TreeNode>, id: string): TreeNode | null {
  for (const n of list) {
    if (n.id === id) return n
    if (n.children) { const f = findNode(n.children, id); if (f) return f }
  }
  return null
}

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type TreeConfig = {
  nodes: () => ReadonlyArray<TreeNode>
  selected?: () => string | null
  onSelect?: (id: string) => void
  /** Seed the internally-managed expanded set (read once). */
  expandedIds?: () => string[] | undefined
  onToggle?: (id: string, expanded: boolean) => void
  checkable?: () => boolean
  checked?: () => string[]
  onCheck?: (ids: string[]) => void
  ariaLabel?: () => string | undefined
}

export function createTree(config: TreeConfig) {
  const nodes = () => config.nodes()
  const checkable = () => config.checkable?.() ?? false
  const selected = () => config.selected?.() ?? null

  // Internal expanded set, seeded from the prop once (then self-managed).
  let expanded = $state<Set<string>>(new Set())
  let seeded = false
  $effect(() => {
    if (!seeded) { seeded = true; const ids = config.expandedIds?.(); if (ids) expanded = new Set(ids) }
  })

  const rows = $derived.by<TreeRow[]>(() => {
    const out: TreeRow[] = []
    const walk = (list: ReadonlyArray<TreeNode>, depth: number, parentId: string | null) => {
      for (const node of list) {
        const hasChildren = !!node.children?.length
        const open = expanded.has(node.id)
        out.push({ node, depth, hasChildren, open, parentId, index: out.length })
        if (hasChildren && open) walk(node.children!, depth + 1, node.id)
      }
    }
    walk(nodes(), 0, null)
    return out
  })

  let active = $state(0)
  $effect(() => { if (active >= rows.length) active = Math.max(0, rows.length - 1) })

  const checkedSet = $derived(new Set(config.checked?.() ?? []))

  // Roving focus target; `focusTick` bumps only on keyboard moves.
  let focusTick = $state(0)
  function setActive(i: number, focus = false) { active = i; if (focus) focusTick++ }

  const checkStateOf = (node: TreeNode): CheckState => treeCheckState(node, checkedSet)
  const isExpanded = (id: string) => expanded.has(id)
  const isSelected = (id: string) => id === selected()

  function toggleExpand(node: TreeNode) {
    if (!node.children?.length) return
    const next = new Set(expanded)
    const willOpen = !next.has(node.id)
    willOpen ? next.add(node.id) : next.delete(node.id)
    expanded = next
    config.onToggle?.(node.id, willOpen)
  }
  const toggle = (id: string) => { const n = findNode(nodes(), id); if (n) toggleExpand(n) }

  function select(node: TreeNode) {
    if (node.disabled) return
    config.onSelect?.(node.id)
  }
  const selectId = (id: string) => { const n = findNode(nodes(), id); if (n) select(n) }

  function toggleCheck(node: TreeNode) {
    if (node.disabled) return
    const next = new Set(checkedSet)
    const ids = [node.id, ...treeDescendantIds(node)]
    const currentlyOn = checkStateOf(node) === 'checked'
    for (const id of ids) currentlyOn ? next.delete(id) : next.add(id)
    config.onCheck?.([...next])
  }

  function onKeydown(e: KeyboardEvent) {
    const item = rows[active]
    if (!item) return
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive(Math.min(active + 1, rows.length - 1), true); break
      case 'ArrowUp': e.preventDefault(); setActive(Math.max(active - 1, 0), true); break
      case 'ArrowRight':
        e.preventDefault()
        if (item.hasChildren && !item.open) toggleExpand(item.node)
        else if (item.hasChildren && item.open) setActive(Math.min(active + 1, rows.length - 1), true)
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (item.hasChildren && item.open) toggleExpand(item.node)
        else if (item.parentId) { const pi = rows.findIndex((r) => r.node.id === item.parentId); if (pi >= 0) setActive(pi, true) }
        break
      case 'Enter': e.preventDefault(); select(item.node); break
      case ' ': e.preventDefault(); checkable() ? toggleCheck(item.node) : select(item.node); break
      case 'Home': e.preventDefault(); setActive(0, true); break
      case 'End': e.preventDefault(); setActive(rows.length - 1, true); break
    }
  }

  return {
    /** Internally-managed set of expanded node ids. */
    get expanded() { return expanded },
    /** Selected node id (single-select highlight). */
    get selected() { return selected() },
    /** Flattened list of visible rows. */
    get rows() { return rows },
    /** Roving-focus row index. */
    get activeIndex() { return active },
    /** Monotonic counter; changes only on keyboard navigation. */
    get focusTick() { return focusTick },
    isExpanded,
    isSelected,
    checkStateOf,
    toggle,
    toggleExpand,
    select: selectId,
    toggleCheck,
    setActive,
    onKeydown,
    /** Spread onto the tree container element. */
    treeProps: () => ({
      role: 'tree' as const,
      'aria-label': config.ariaLabel?.(),
      'aria-multiselectable': checkable(),
    }),
    /** Spread onto the treeitem element for a flattened `row`. */
    itemProps: (row: TreeRow) => {
      const cs = checkable() ? checkStateOf(row.node) : 'unchecked'
      return {
        role: 'treeitem' as const,
        'aria-level': row.depth + 1,
        'aria-selected': row.node.id === selected(),
        'aria-expanded': row.hasChildren ? row.open : undefined,
        'aria-checked': checkable() ? (cs === 'checked' ? 'true' : cs === 'indeterminate' ? 'mixed' : 'false') : undefined,
        'data-row': row.index,
        tabindex: row.index === active ? 0 : -1,
        onclick: () => { setActive(row.index); select(row.node) },
        onkeydown: onKeydown,
      }
    },
  }
}

export type Tree = ReturnType<typeof createTree>
