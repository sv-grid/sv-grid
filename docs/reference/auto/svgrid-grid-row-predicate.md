# `@svgrid/grid` · `filtering/row-predicate.ts`

Auto-generated. Source: `packages\grid\src\filtering\row-predicate.ts`.

### `function applyRowPredicate`

Apply `keep` to leaf rows, dropping banners left with no surviving child.

```ts
export function applyRowPredicate<TRow>(
  rows: ReadonlyArray<TRow>,
  keep: (row: TRow) => boolean,
  isGroup: (row: TRow) => boolean,
): TRow[]
```
