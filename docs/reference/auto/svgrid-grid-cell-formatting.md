# `@svgrid/grid` · `cell-formatting.ts`

Auto-generated. Source: `packages\grid\src\cell-formatting.ts`.

### `function resolveDatePattern`

Map shortcut date patterns to Intl options (merged with caller `options`).

```ts
export function resolveDatePattern(
  pattern: string | undefined,
  kind: 'date' | 'datetime',
): Intl.DateTimeFormatOptions | undefined
```

### `function getNumberFormatter`

A cached `Intl.NumberFormat` for the locale and options given. Cached because
constructing one is among the most expensive calls in the platform, and both
callers do it per rendered value: once per cell while scrolling a number
column, and once per axis tick, data label and tooltip while drawing a chart.

```ts
export function getNumberFormatter(
  locales: string | readonly string[] | undefined,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat
```

### `function parseDateValue`

A cell value as a Date, or null when it is not one. Accepts a Date, epoch ms,
or a parseable string.

A bare calendar date ('2026-06-27') is read as LOCAL midnight of that day.
`new Date('2026-06-27')` reads it as UTC midnight, which every zone west of
UTC formats as the 26th. The day in the string is the day the user meant.

```ts
export function parseDateValue(value: unknown): Date | null
```

### `function getDateFormatter`

A cached `Intl.DateTimeFormat` for the locale and options given. Cached because
 constructing one per cell is the dominant cost when formatting a date column.

```ts
export function getDateFormatter(
  locales: string | readonly string[] | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat
```

### `function formatNumericWithConfig`

Format a numeric value for number / currency / percent column formats.

```ts
export function formatNumericWithConfig(value: unknown, config: NumericFormatInput): string
```
