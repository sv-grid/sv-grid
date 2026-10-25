# `@svgrid/enterprise` · `review/equal.ts`

Auto-generated. Source: `packages\enterprise\src\review\equal.ts`.

### `const isBlank`

Whether a cell value is blank: null, undefined or the empty string.

```ts
export const isBlank = (v: unknown): boolean => v == null || v === ''
```

### `function sameValue`

Whether two cell values are the same for a review: `Object.is`, Dates by
time, arrays and plain objects by structure, and any two blanks.

```ts
export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (isBlank(a) && isBlank(b)) return true
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((v, i) => sameValue(v, b[i]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a)
    if (ka.length !== Object.keys(b).length) return false
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && sameValue(a[k], b[k]))
  }
  return false
}
```
