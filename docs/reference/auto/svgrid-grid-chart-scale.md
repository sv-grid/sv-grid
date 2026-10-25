# `@svgrid/grid` · `chart-scale.ts`

Auto-generated. Source: `packages\grid\src\chart-scale.ts`.

### `const DEFAULT_PALETTE`

Series colours used when a {@link ChartSeries} sets none, in order.

```ts
export const DEFAULT_PALETTE = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#0ea5e9',
  '#ec4899',
  '#14b8a6',
]
```

### `function sampleGradient`

Sample a hex color from an array of hex stops at fractional position t.
 Linearly interpolates between the two nearest stops in RGB space.

```ts
export function sampleGradient(stops: string[], t: number): string
```

### `function pickContrastText`

Pick a black or white text color that has the better contrast against
 the given background. Uses the WCAG relative-luminance heuristic.

```ts
export function pickContrastText(bgHex: string): string
```

### `function niceLogScale`

Pick the largest power of 10 that fits at the bottom of [min,max], and
 the smallest that covers the top, then enumerate decade boundaries. Used
 by log-scale axes (yScale: 'log').

```ts
export function niceLogScale(min: number, max: number): NiceScale
```

### `function niceScale`

Round a [min,max] domain out to nice tick boundaries.

```ts
export function niceScale(min: number, max: number, tickCount = 4): NiceScale
```

### `function axisScale`

A value-axis domain that honours an axis config on top of the data extent:
a pinned `min` / `max` (hard edges - marks past them are clipped), an exact
`tickInterval`, a `tickCount`, and `nice: false` for the raw extent with
evenly spaced ticks. With no config this is exactly {@link niceScale}.

```ts
export function axisScale(
  dataMin: number,
  dataMax: number,
  axis: { min?: number; max?: number; nice?: boolean; tickCount?: number; tickInterval?: number } = {},
): NiceScale
```

### `function ordinalDateTicks`

Tick positions for an ordinal (evenly spaced) date axis, as INDICES into
`times`.

A time axis can put a tick anywhere, because x is a function of the
timestamp. An ordinal axis cannot: x is a function of the index, so a tick
has to land on a point that exists. This picks the first point of each
calendar unit - day, week, month, year, whichever gets closest to `target`
ticks without going over - so labels sit on real sessions and a weekend or a
holiday never stretches the spacing.

```ts
export function ordinalDateTicks(times: number[], target = 6): number[]
```
