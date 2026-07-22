/**
 * tree-select - pure tree helpers behind <SvTreeSelect>: flatten the visible
 * rows for the current expansion state (so keyboard nav is a flat index), and
 * resolve the path from root to a value (for the trigger label). Framework-free
 * + pure so they are unit-tested directly.
 */
import type { TreeSelectNode } from './ui-app.types'

export type FlatRow = {
  node: TreeSelectNode
  depth: number
  hasChildren: boolean
  expanded: boolean
}

/** The rows currently visible given the `expanded` set, in display order. */
export function flattenVisible(
  nodes: ReadonlyArray<TreeSelectNode>,
  expanded: ReadonlySet<string | number>,
  depth = 0,
): FlatRow[] {
  const rows: FlatRow[] = []
  for (const node of nodes) {
    const hasChildren = !!node.children && node.children.length > 0
    const isExpanded = expanded.has(node.value)
    rows.push({ node, depth, hasChildren, expanded: isExpanded })
    if (hasChildren && isExpanded) {
      rows.push(...flattenVisible(node.children!, expanded, depth + 1))
    }
  }
  return rows
}

/** Path of nodes from a root down to `value`, or null if not found. */
export function findNodePath(
  nodes: ReadonlyArray<TreeSelectNode>,
  value: string | number,
): TreeSelectNode[] | null {
  for (const node of nodes) {
    if (node.value === value) return [node]
    if (node.children) {
      const sub = findNodePath(node.children, value)
      if (sub) return [node, ...sub]
    }
  }
  return null
}

/** Every value that has children (useful for "expand all"). */
export function branchValues(nodes: ReadonlyArray<TreeSelectNode>): Array<string | number> {
  const out: Array<string | number> = []
  const walk = (list: ReadonlyArray<TreeSelectNode>) => {
    for (const n of list) {
      if (n.children && n.children.length) {
        out.push(n.value)
        walk(n.children)
      }
    }
  }
  walk(nodes)
  return out
}
