# `@svgrid/enterprise` · `review/equal.ts`

Auto-generated. Source: `packages\enterprise\src\review\equal.ts`.

### `const isBlank`

Whether a cell value is blank: null, undefined or the empty string.

```ts
export const isBlank = (v: unknown): boolean => ...
```

### `function sameValue`

Whether two cell values are the same for a review: `Object.is`, Dates by
time, arrays and plain objects by structure, and any two blanks.

```ts
export function sameValue(a: unknown, b: unknown): boolean
```
