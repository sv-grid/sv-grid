# `@svgrid/grid` · `datetime/timezone.ts`

Auto-generated. Source: `packages\grid\src\datetime\timezone.ts`.

### `type ZoneParts`

A wall-clock time broken into fields, as it reads in a specific time zone.

```ts
export type ZoneParts = {
  year: number
  month: number // 1-12
  day: number
  hour: number // 0-23
  minute: number
  second: number
}
```

### `function zoneParts`

The wall-clock parts of `instant` in `timeZone` (browser-local if undefined).

```ts
export function zoneParts(instant: Date, timeZone?: string): ZoneParts
```

### `function zoneOffsetMs`

Milliseconds `timeZone` is ahead of UTC at `instant` (DST-aware; negative west of UTC).

```ts
export function zoneOffsetMs(instant: Date, timeZone?: string): number
```

### `function toZonedLocal`

An instant -> a Date whose LOCAL fields equal its wall-clock in `timeZone`.

```ts
export function toZonedLocal(instant: Date, timeZone?: string): Date
```

### `function instantFromWallClock`

The instant whose wall-clock in `timeZone` is the given Y-M-D H:M:S.

```ts
export function instantFromWallClock(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  second = 0,
  timeZone?: string,
  ms = 0,
): Date
```

### `function fromZonedLocal`

Inverse of {@link toZonedLocal}: a pseudo-local Date -> the real instant.

```ts
export function fromZonedLocal(pseudo: Date, timeZone?: string): Date
```

### `function zoneAbbr`

Short zone name at `instant`, e.g. "EDT" / "GMT+5:30" - for a ruler header.

```ts
export function zoneAbbr(instant: Date, timeZone?: string): string
```

### `function normalizeTimeZone`

Validate an IANA zone id; returns it if usable, else undefined (falls back to local).

```ts
export function normalizeTimeZone(timeZone?: string): string | undefined
```
