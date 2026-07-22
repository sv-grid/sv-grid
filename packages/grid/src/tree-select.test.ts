import { describe, expect, it } from 'vitest'
import { flattenVisible, findNodePath, branchValues } from './tree-select'
import type { TreeSelectNode } from './ui-app.types'

const tree: TreeSelectNode[] = [
  { value: 'asia', label: 'Asia', children: [
    { value: 'jp', label: 'Japan', children: [{ value: 'tokyo', label: 'Tokyo' }] },
    { value: 'cn', label: 'China' },
  ] },
  { value: 'eu', label: 'Europe', children: [{ value: 'fr', label: 'France' }] },
]

describe('flattenVisible', () => {
  it('shows only roots when nothing is expanded', () => {
    const rows = flattenVisible(tree, new Set())
    expect(rows.map((r) => r.node.value)).toEqual(['asia', 'eu'])
    expect(rows.every((r) => r.depth === 0)).toBe(true)
    expect(rows[0]!.hasChildren).toBe(true)
  })

  it('reveals children of expanded nodes with increasing depth', () => {
    const rows = flattenVisible(tree, new Set(['asia']))
    expect(rows.map((r) => r.node.value)).toEqual(['asia', 'jp', 'cn', 'eu'])
    expect(rows.find((r) => r.node.value === 'jp')!.depth).toBe(1)
  })

  it('nests deeply when a branch chain is expanded', () => {
    const rows = flattenVisible(tree, new Set(['asia', 'jp']))
    expect(rows.map((r) => r.node.value)).toEqual(['asia', 'jp', 'tokyo', 'cn', 'eu'])
    expect(rows.find((r) => r.node.value === 'tokyo')!.depth).toBe(2)
  })
})

describe('findNodePath', () => {
  it('returns the root-to-node path', () => {
    expect(findNodePath(tree, 'tokyo')!.map((n) => n.value)).toEqual(['asia', 'jp', 'tokyo'])
    expect(findNodePath(tree, 'eu')!.map((n) => n.value)).toEqual(['eu'])
  })
  it('returns null for unknown values', () => {
    expect(findNodePath(tree, 'nope')).toBeNull()
  })
})

describe('branchValues', () => {
  it('lists every node that has children', () => {
    expect(branchValues(tree).sort()).toEqual(['asia', 'eu', 'jp'])
  })
})
