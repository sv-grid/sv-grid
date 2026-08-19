import { describe, expect, it } from 'vitest'
import { createTreeRowModel, flattenTreeData } from './core'

type Node = { id: number; parent: number | null; name: string }

/** Minimal Row stand-ins - the model only reads `original`, `id` and spreads. */
function rowsFrom(data: Node[]) {
  return data.map((original, index) => ({
    id: String(original.id),
    index,
    original,
    depth: 0,
    getCanExpand: () => false,
    getIsExpanded: () => false,
    toggleExpanded: () => {},
    getIsSelected: () => false,
    toggleSelected: () => {},
    getAllCells: () => [],
    getCellValueByColumnId: (c: string) => (original as never as Record<string, unknown>)[c],
  })) as never[]
}

let expandedState: Record<string, boolean> = {}
const table = {
  getState: () => ({ expanded: expandedState }),
  setExpanded: (fn: (p: Record<string, boolean>) => Record<string, boolean>) => {
    expandedState = fn(expandedState)
  },
} as never

const run = (data: Node[], opts = { parentField: 'parent' }) =>
  createTreeRowModel<never>(opts)({ table, rows: rowsFrom(data) } as never)

const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id)

describe('createTreeRowModel', () => {
  const data: Node[] = [
    { id: 1, parent: null, name: 'root' },
    { id: 2, parent: 1, name: 'child a' },
    { id: 3, parent: 1, name: 'child b' },
    { id: 4, parent: 2, name: 'grandchild' },
    { id: 5, parent: null, name: 'other root' },
  ]

  it('nests by parent id and returns only roots', () => {
    const out = run(data)
    expect(ids(out)).toEqual(['1', '5'])
  })

  it('records depth down the chain', () => {
    const [root] = run(data) as never as Array<{ depth: number; subRows: never[] }>
    expect(root!.depth).toBe(0)
    const child = (root!.subRows as never as Array<{ id: string; depth: number; subRows: never[] }>)[0]!
    expect(child.depth).toBe(1)
    expect((child.subRows as never as Array<{ depth: number }>)[0]!.depth).toBe(2)
  })

  it('marks rows with children expandable and leaves not', () => {
    const [root, other] = run(data) as never as Array<{ getCanExpand: () => boolean }>
    expect(root!.getCanExpand()).toBe(true)
    expect(other!.getCanExpand()).toBe(false)
  })

  it('counts descendants, not just direct children', () => {
    const [root] = run(data) as never as Array<{ leafCount: number }>
    // children a + b, plus a's grandchild
    expect(root!.leafCount).toBe(3)
  })

  it('tags rows so they are not mistaken for group banners', async () => {
    const { isGroupRow } = await import('./cell-values')
    const [root] = run(data) as never as Array<never>
    expect((root as never as { __treeRow: boolean }).__treeRow).toBe(true)
    // Expandable, but must NOT render as a full-width banner.
    expect(isGroupRow(root!)).toBe(false)
  })

  it('drives expansion through the table state', () => {
    expandedState = {}
    const [root] = run(data) as never as Array<{
      getIsExpanded: () => boolean
      toggleExpanded: () => void
    }>
    expect(root!.getIsExpanded()).toBe(false)
    root!.toggleExpanded()
    expect(expandedState['1']).toBe(true)
  })

  it('promotes a row whose parent is missing rather than dropping it', () => {
    // Parent 99 does not exist - e.g. the filter removed it. The row must still
    // be reachable.
    const orphaned: Node[] = [
      { id: 1, parent: null, name: 'root' },
      { id: 2, parent: 99, name: 'orphan' },
    ]
    expect(ids(run(orphaned))).toEqual(['1', '2'])
  })

  it('survives a parent cycle', () => {
    const cyclic: Node[] = [
      { id: 1, parent: 2, name: 'a' },
      { id: 2, parent: 1, name: 'b' },
    ]
    // Neither is a root by parent link, so nothing is emitted rather than
    // recursing forever. The guard is what matters.
    expect(() => run(cyclic)).not.toThrow()
  })

  it('treats a self-parenting row as a root', () => {
    expect(ids(run([{ id: 1, parent: 1, name: 'self' }]))).toEqual(['1'])
  })

  it('passes an empty set straight through', () => {
    expect(run([])).toEqual([])
  })

  it('honours a custom idField', () => {
    const keyed = [
      { key: 10, parent: null },
      { key: 11, parent: 10 },
    ] as never as Node[]
    const out = createTreeRowModel<never>({ parentField: 'parent', idField: 'key' })({
      table,
      rows: rowsFrom(keyed),
    } as never) as never as Array<{ subRows: never[] }>
    expect(out).toHaveLength(1)
    expect(out[0]!.subRows).toHaveLength(1)
  })
})

describe('flattenTreeData', () => {
  const nested = [
    { id: 1, name: 'a', kids: [{ id: 2, name: 'a1', kids: [{ id: 3, name: 'a1a' }] }] },
    { id: 4, name: 'b' },
  ]

  it('emits children directly after their parent', () => {
    const flat = flattenTreeData(nested as never, { childrenField: 'kids' })
    expect(flat.map((r) => (r as never as { id: number }).id)).toEqual([1, 2, 3, 4])
  })

  it('stamps the parent link the tree model reads', () => {
    const flat = flattenTreeData(nested as never, { childrenField: 'kids' }) as never as Array<
      Record<string, unknown>
    >
    expect(flat[0]!.__parentId).toBeNull()
    expect(flat[1]!.__parentId).toBe(1)
    expect(flat[2]!.__parentId).toBe(2)
  })

  it('round-trips into createTreeRowModel', () => {
    const flat = flattenTreeData(nested as never, { childrenField: 'kids' })
    const out = createTreeRowModel<never>({ parentField: '__parentId' })({
      table,
      rows: rowsFrom(flat as never as Node[]),
    } as never) as never as Array<{ id: string; subRows: never[] }>
    expect(out.map((r) => r.id)).toEqual(['1', '4'])
    expect(out[0]!.subRows).toHaveLength(1)
  })

  it('accepts a custom parent field name', () => {
    const flat = flattenTreeData(nested as never, {
      childrenField: 'kids',
      parentField: 'pid',
    }) as never as Array<Record<string, unknown>>
    expect(flat[1]!.pid).toBe(1)
  })
})
