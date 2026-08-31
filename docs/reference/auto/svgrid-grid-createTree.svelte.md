# `@svgrid/grid` · `createTree.svelte.ts`

Auto-generated. Source: `packages\grid\src\createTree.svelte.ts`.

### `type TreeNode`

createTree - the HEADLESS core behind <SvTree>, in the same spirit as
`createSvGrid` for the grid: a runes-based state machine (expand/collapse,
single-select highlight, cascading tri-state checkboxes, full keyboard) with
**prop-getters** you spread onto YOUR OWN markup. The visible tree is
flattened into `rows` so roving-focus keyboard nav stays a flat index walk.

```svelte
<script lang="ts">
  import { createTree } from '@svgrid/grid'
  let selected = $state<string | null>(null)
  const tree = createTree({ nodes: () => nodes, selected: () => selected, onSelect: (id) => (selected = id) })
</script>
<div {...tree.treeProps()}>
  {#each tree.rows as row (row.node.id)}
    <div {...tree.itemProps(row)}>{row.node.label}</div>
  {/each}
</div>
```

The styled <SvTree> is just one renderer over this core. The cascade math
(`treeDescendantIds`, `treeCheckState`) is exported as pure functions.

```ts
export type TreeNode = {
  id: string
  label: string
  children?: TreeNode[]
  disabled?: boolean
  /** Marks a node whose children are loaded on demand (shows an expand arrow
   *  even with no children yet; the renderer loads them on first expand). */
  lazy?: boolean
}
```

### `type CheckState`

A node's checkbox state. `'indeterminate'` means some but not all descendants are checked. */

```ts
export type CheckState = 'checked' | 'indeterminate' | 'unchecked'
```

### `type TreeRow`

A single visible (flattened) tree row. */

```ts
export type TreeRow = {
  node: TreeNode
  depth: number
  hasChildren: boolean
  open: boolean
  parentId: string | null
  index: number
}
```

### `function treeDescendantIds`

All descendant ids of `node` (pure, depth-first). */

```ts
export function treeDescendantIds(node: TreeNode): string[] {
  const ids: string[] = []
  const walk = (n: TreeNode) => { for (const c of n.children ?? []) { ids.push(c.id); walk(c) } }
  walk(node)
  return ids
}
```

### `function treeCheckState`

Tri-state check status of `node` given the set of checked ids (pure). */

```ts
export function treeCheckState(node: TreeNode, checked: ReadonlySet<string>): CheckState {
  if (!node.children?.length) return checked.has(node.id) ? 'checked' : 'unchecked'
  const desc = treeDescendantIds(node)
  const on = desc.filter((id) => checked.has(id)).length
  if (on === 0 && !checked.has(node.id)) return 'unchecked'
  if (on === desc.length) return 'checked'
  return 'indeterminate'
}
```

### `type TreeDropPosition`

Where a dragged node lands relative to the drop target. */

```ts
export type TreeDropPosition = 'before' | 'after' | 'inside'
```

### `function treeContains`

True if `id` is inside `node`'s subtree (used to block invalid drops). */

```ts
export function treeContains(node: TreeNode, id: string): boolean {
  return node.children?.some((c) => c.id === id || treeContains(c, id)) ?? false
}
```

### `function moveTreeNode`

Return a NEW node tree with `dragId` moved before/after/inside `targetId`
(pure - the caller sets it back as the controlled `nodes`). No-ops on invalid
moves (self, or into own descendant).

```ts
export function moveTreeNode(
  nodes: ReadonlyArray<TreeNode>,
  dragId: string,
  targetId: string,
  position: TreeDropPosition,
): TreeNode[] {
  if (dragId === targetId) return [...nodes]
  const dragged = findNode(nodes, dragId)
  if (!dragged) return [...nodes]
  if (dragId === targetId || treeContains(dragged, targetId)) return [...nodes]

  const without = (list: ReadonlyArray<TreeNode>): TreeNode[] => {
    const out: TreeNode[] = []
    for (const n of list) {
      if (n.id === dragId) continue
      out.push(n.children ? { ...n, children: without(n.children) } : n)
    }
    return out
  }
  const insert = (list: ReadonlyArray<TreeNode>): TreeNode[] => {
    const out: TreeNode[] = []
    for (const n of list) {
      if (n.id === targetId) {
        if (position === 'before') { out.push(dragged, n) }
        else if (position === 'after') { out.push(n, dragged) }
        else out.push({ ...n, children: [...(n.children ?? []), dragged] })
      } else if (n.children) {
        out.push({ ...n, children: insert(n.children) })
      } else out.push(n)
    }
    return out
  }
  return insert(without(nodes))
}
```

### `function sortTreeNodes`

Sort siblings (recursively) by a comparator (pure). */

```ts
export function sortTreeNodes(
  nodes: ReadonlyArray<TreeNode>,
  compare: (a: TreeNode, b: TreeNode) => number,
): TreeNode[] {
  return [...nodes]
    .sort(compare)
    .map((n) => (n.children ? { ...n, children: sortTreeNodes(n.children, compare) } : n))
}
```

### `type TreeConfig`

Reactive inputs are passed as getters so the core tracks live prop changes. */

```ts
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
  /** Text direction; under `'rtl'` the Left/Right expand/collapse keys swap. */
  dir?: () => import('./editor-contract').EditorDir | undefined
  /** Filter query: show only matching nodes + their ancestors, auto-expanded. */
  filter?: () => string | undefined
}
```

### `function createTree`

Build the headless tree model: expansion, selection and checkbox cascading, with no markup. */

```ts
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

  // When filtering, precompute which nodes to show (a match, or an ancestor of a
  // match) and which to force-open so matches are revealed.
  const filterInfo = $derived.by(() => {
    const q = config.filter?.()?.trim().toLowerCase()
    if (!q) return null
    const visible = new Set<string>()
    const forceOpen = new Set<string>()
    const walk = (node: TreeNode): boolean => {
      let childMatch = false
      for (const c of node.children ?? []) childMatch = walk(c) || childMatch
      const selfMatch = node.label.toLowerCase().includes(q)
      if (selfMatch || childMatch) { visible.add(node.id); if (childMatch) forceOpen.add(node.id) }
      return selfMatch || childMatch
    }
    for (const n of nodes()) walk(n)
    return { visible, forceOpen }
  })

  const rows = $derived.by<TreeRow[]>(() => {
    const out: TreeRow[] = []
    const fi = filterInfo
    const walk = (list: ReadonlyArray<TreeNode>, depth: number, parentId: string | null) => {
      for (const node of list) {
        if (fi && !fi.visible.has(node.id)) continue
        const hasChildren = !!node.children?.length || !!node.lazy
        const open = fi ? fi.forceOpen.has(node.id) || expanded.has(node.id) : expanded.has(node.id)
        out.push({ node, depth, hasChildren, open, parentId, index: out.length })
        if (open && node.children?.length) walk(node.children, depth + 1, node.id)
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
    // Lazy nodes have no children *yet* - they must still be expandable so the
    // toggle fires onToggle and the host can fetch children on demand.
    if (!node.children?.length && !node.lazy) return
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

  // Step from `from` towards `dir` (+1/-1), skipping disabled rows, so roving
  // focus never lands on a node with zero semantic affordance for AT users.
  // Falls back to `from` if every row in that direction is disabled.
  function stepEnabled(from: number, dir: 1 | -1): number {
    let i = from
    while (i + dir >= 0 && i + dir <= rows.length - 1) {
      i += dir
      if (!rows[i]?.node.disabled) return i
    }
    return from
  }

  function onKeydown(e: KeyboardEvent) {
    const item = rows[active]
    if (!item) return
    // "expand" opens the node or steps into the first child; "collapse" closes it
    // or jumps to the parent. Under RTL the physical Left/Right keys are swapped.
    const expand = () => {
      if (item.hasChildren && !item.open) toggleExpand(item.node)
      else if (item.hasChildren && item.open) setActive(Math.min(active + 1, rows.length - 1), true)
    }
    const collapse = () => {
      if (item.hasChildren && item.open) toggleExpand(item.node)
      else if (item.parentId) { const pi = rows.findIndex((r) => r.node.id === item.parentId); if (pi >= 0) setActive(pi, true) }
    }
    const rtl = config.dir?.() === 'rtl'
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive(stepEnabled(active, 1), true); break
      case 'ArrowUp': e.preventDefault(); setActive(stepEnabled(active, -1), true); break
      case 'ArrowRight': e.preventDefault(); (rtl ? collapse : expand)(); break
      case 'ArrowLeft': e.preventDefault(); (rtl ? expand : collapse)(); break
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
      const ariaChecked: 'true' | 'mixed' | 'false' | undefined =
        checkable() ? (cs === 'checked' ? 'true' : cs === 'indeterminate' ? 'mixed' : 'false') : undefined
      return {
        role: 'treeitem' as const,
        'aria-level': row.depth + 1,
        'aria-selected': row.node.id === selected(),
        'aria-expanded': row.hasChildren ? row.open : undefined,
        'aria-checked': ariaChecked,
        'aria-disabled': row.node.disabled || undefined,
        'data-row': row.index,
        tabindex: row.index === active ? 0 : -1,
        onclick: () => { setActive(row.index); select(row.node) },
        onkeydown: onKeydown,
      }
    },
  }
}
```

### `type Tree`

The headless tree instance returned by {@link createTree}. */

```ts
export type Tree = ReturnType<typeof createTree>
```
