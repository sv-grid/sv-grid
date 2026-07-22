/**
 * Tests for the pure tree edit helpers: moveTreeNode (before/after/inside +
 * invalid-move guards) and sortTreeNodes (recursive), plus treeContains.
 */
import { describe, expect, it } from 'vitest'
import { moveTreeNode, sortTreeNodes, treeContains, type TreeNode } from './createTree.svelte'

const tree: TreeNode[] = [
  { id: 'a', label: 'A', children: [{ id: 'a1', label: 'A1' }, { id: 'a2', label: 'A2' }] },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
]
const ids = (list: TreeNode[]) => list.map((n) => n.id)

describe('moveTreeNode', () => {
  it('moves before / after a sibling', () => {
    expect(ids(moveTreeNode(tree, 'c', 'a', 'before'))).toEqual(['c', 'a', 'b'])
    expect(ids(moveTreeNode(tree, 'b', 'c', 'after'))).toEqual(['a', 'c', 'b'])
  })
  it('moves inside a folder (appends to children)', () => {
    const out = moveTreeNode(tree, 'b', 'a', 'inside')
    expect(ids(out)).toEqual(['a', 'c'])
    expect(out[0].children!.map((n) => n.id)).toEqual(['a1', 'a2', 'b'])
  })
  it('refuses to drop a node into its own descendant, or onto itself', () => {
    expect(moveTreeNode(tree, 'a', 'a1', 'inside')).toEqual(tree)
    expect(moveTreeNode(tree, 'a', 'a', 'before')).toEqual(tree)
  })
})

describe('sortTreeNodes', () => {
  it('sorts siblings recursively', () => {
    const unsorted: TreeNode[] = [
      { id: 'z', label: 'Zebra' },
      { id: 'm', label: 'Mango', children: [{ id: 'p', label: 'Pear' }, { id: 'a', label: 'Apple' }] },
      { id: 'a', label: 'Ant' },
    ]
    const asc = sortTreeNodes(unsorted, (x, y) => x.label.localeCompare(y.label))
    expect(ids(asc)).toEqual(['a', 'm', 'z'])
    expect(asc[1].children!.map((n) => n.label)).toEqual(['Apple', 'Pear'])
  })
})

describe('treeContains', () => {
  it('detects descendants', () => {
    expect(treeContains(tree[0], 'a2')).toBe(true)
    expect(treeContains(tree[0], 'b')).toBe(false)
  })
})
