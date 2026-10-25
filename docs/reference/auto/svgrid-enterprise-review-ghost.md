# `@svgrid/enterprise` · `review/ghost.ts`

Auto-generated. Source: `packages\enterprise\src\review\ghost.ts`.

### `function canGhost`

Whether wrapping this column's `cell` keeps the rest of its cells as they
were. `columns` is every leaf column, which a field type's fill may read.

```ts
export function canGhost(raw: any, sample?: unknown, columns: ReadonlyArray<any> = []): boolean
```
