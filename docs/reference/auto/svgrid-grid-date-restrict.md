# `@svgrid/grid` · `datetime/date-restrict.ts`

Auto-generated. Source: `packages\grid\src\datetime\date-restrict.ts`.

### `type RestrictOptions`

Which dates a picker allows: bounds, an explicit disabled set, and disabled weekdays. */

```ts
export type RestrictOptions = {
  min?: DateLike | null
  max?: DateLike | null
  /** Individual dates (or predicate) that cannot be selected. */
  restrictedDates?: ReadonlyArray<DateLike> | ((d: Date) => boolean) | null
}
```

### `function isOutOfRange`

True when `d` is outside the inclusive [min, max] day range. */

```ts
export function isOutOfRange(d: Date, min?: DateLike | null, max?: DateLike | null): boolean {
  const lo = toDate(min ?? null)
  const hi = toDate(max ?? null)
  if (lo && compareDay(d, lo) < 0) return true
  if (hi && compareDay(d, hi) > 0) return true
  return false
}
```

### `function isRestricted`

True when `d` is explicitly restricted (by list membership or predicate). */

```ts
export function isRestricted(
  d: Date,
  restrictedDates?: ReadonlyArray<DateLike> | ((day: Date) => boolean) | null,
): boolean {
  if (!restrictedDates) return false
  if (typeof restrictedDates === 'function') return restrictedDates(d)
  return normalizeList(restrictedDates).some((r) => isSameDay(r, d))
}
```

### `function isDisabledDay`

True when `d` cannot be selected: out of [min, max] OR restricted. This is
the single predicate the calendar/pickers use to disable a day.

```ts
export function isDisabledDay(d: Date, opts: RestrictOptions): boolean {
  return isOutOfRange(d, opts.min, opts.max) || isRestricted(d, opts.restrictedDates)
}
```

### `function isImportant`

True when `d` is flagged important (highlighted). Never affects selectability. */

```ts
export function isImportant(
  d: Date,
  importantDates?: ReadonlyArray<DateLike> | ((day: Date) => boolean) | null,
): boolean {
  if (!importantDates) return false
  if (typeof importantDates === 'function') return importantDates(d)
  return normalizeList(importantDates).some((r) => isSameDay(r, d))
}
```
