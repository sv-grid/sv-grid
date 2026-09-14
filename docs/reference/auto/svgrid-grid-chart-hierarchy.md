# `@svgrid/grid` · `chart-hierarchy.ts`

Auto-generated. Source: `packages\grid\src\chart-hierarchy.ts`.

### `function drillTree`

The subtree at `path` (a list of node names from the root's children down),
or the tree itself for an empty path. What a drilldown shows after each
click: the clicked node becomes the root. Null when the path does not exist.

```ts
export function drillTree(tree: TreeNode, path: ReadonlyArray<string>): TreeNode | null {
  let node: TreeNode | undefined = tree
  for (const name of path) {
    node = node?.children?.find((c) => c.name === name)
    if (!node) return null
  }
  return node ?? null
}
```

### `function pathTo`

The path (node names from the root's children) to the first node called
`name`, depth first, or null. What a click on a leaf's label needs.

```ts
export function pathTo(tree: TreeNode, name: string): string[] | null {
  const walk = (n: TreeNode, acc: string[]): string[] | null => {
    for (const c of n.children ?? []) {
      const next = [...acc, c.name]
      if (c.name === name) return next
      const deeper = walk(c, next)
      if (deeper) return deeper
    }
    return null
  }
  return walk(tree, [])
}
```
