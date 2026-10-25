# `@svgrid/grid` · `datetime/date-core.ts`

Auto-generated. Source: `packages\grid\src\datetime\date-core.ts`.

### `type DateLike`

Anything the date helpers accept: a `Date`, epoch milliseconds, or a parseable string.

```ts
export type DateLike = Date | number | string
```

### `function toDate`

Coerce a Date | epoch-ms | parseable string to a Date, or null if invalid.

```ts
export function toDate(value: DateLike | null | undefined): Date | null
```

### `function startOfDay`

A new Date at local midnight of the same calendar day (time stripped).

```ts
export function startOfDay(d: Date): Date
```

### `function startOfMonth`

First day (midnight) of the month `d` falls in.

```ts
export function startOfMonth(d: Date): Date
```

### `function endOfMonth`

Last day (midnight) of the month `d` falls in.

```ts
export function endOfMonth(d: Date): Date
```

### `function daysInMonth`

Number of days in the month `d` falls in.

```ts
export function daysInMonth(d: Date): number
```

### `function startOfWeek`

Start of the week containing `d`, honoring `firstDayOfWeek` (0-6). Returns a
local-midnight Date on or before `d`.

```ts
export function startOfWeek(d: Date, firstDayOfWeek = 0): Date
```

### `function isSameDay`

True when both dates are the same local calendar day.

```ts
export function isSameDay(a: Date | null, b: Date | null): boolean
```

### `function isSameMonth`

True when both dates are in the same year+month.

```ts
export function isSameMonth(a: Date | null, b: Date | null): boolean
```

### `function compareDay`

-1 / 0 / 1 comparison by calendar day (time-of-day ignored).

```ts
export function compareDay(a: Date, b: Date): number
```

### `function addDays`

Add `n` days (can be negative), returning a new Date.

```ts
export function addDays(d: Date, n: number): Date
```

### `function addMonths`

Add `n` calendar months, clamping the day-of-month so 31 Jan + 1 month = 28/29
Feb rather than spilling into March (matches how calendars paginate).

```ts
export function addMonths(d: Date, n: number): Date
```

### `function addYears`

Add `n` years, clamping Feb-29 to Feb-28 on non-leap targets.

```ts
export function addYears(d: Date, n: number): Date
```

### `function clampDate`

Clamp `d` to the inclusive [min, max] range (either bound may be null).

```ts
export function clampDate(d: Date, min: Date | null, max: Date | null): Date
```

### `function isoWeek`

ISO 8601 week number (1-53) for `d`. Week 1 is the week containing the first
Thursday of the year; weeks start Monday. Independent of `firstDayOfWeek`,
matching Smart's `weekNumbers` column which is always ISO.

```ts
export function isoWeek(d: Date): number
```

### `function decadeRange`

The [start, end] years of the decade block that `year` belongs to, as Smart
renders it: a 12-cell page running from the decade start minus 1 to plus 10
(one leading + one trailing year for context). We expose the canonical
decade [Y0, Y0+9] and let the view pad.

```ts
export function decadeRange(year: number): { start: number; end: number }
```

### `function centuryRange`

The [start, end] years of the century block (100-year) `year` belongs to.

```ts
export function centuryRange(year: number): { start: number; end: number }
```

### `type MonthMatrixCell`

One cell of a month grid, including the leading and trailing days from adjacent months.

```ts
export type MonthMatrixCell = {
  date: Date
  /** In the displayed month (vs. leading/trailing days of adjacent months). */
  inMonth: boolean
  /** ISO week number of the row this cell sits in. */
  week: number
}
```

### `function monthMatrix`

Build a month grid of `weeks` rows x 7 columns starting at `firstDayOfWeek`,
padded with the trailing days of the previous month and leading days of the
next so every row is full. `weeks` defaults to 6 (the max any month needs),
matching Smart's fixed-height calendar.

```ts
export function monthMatrix(
  monthDate: Date,
  firstDayOfWeek = 0,
  weeks = 6,
): MonthMatrixCell[][]
```

### `function weekdayOrder`

Ordered weekday indexes (0-6) for a header row starting at `firstDayOfWeek`.
e.g. firstDayOfWeek=1 -> [1,2,3,4,5,6,0].

```ts
export function weekdayOrder(firstDayOfWeek = 0): number[]
```

### `function withTime`

Merge a calendar day with a time-of-day taken from `time`, returning a new Date.

```ts
export function withTime(day: Date, time: Date): Date
```

### `function snapMinute`

Snap a minute value to the nearest lower multiple of `interval` (>=1).

```ts
export function snapMinute(minute: number, interval: number): number
```
