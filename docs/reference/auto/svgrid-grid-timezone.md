# `@svgrid/grid` · `datetime/timezone.ts`

Auto-generated. Source: `packages\grid\src\datetime\timezone.ts`.

### `type ZoneParts`

A wall-clock time broken into fields, as it reads in a specific time zone. */

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

The wall-clock parts of `instant` in `timeZone` (browser-local if undefined). */

```ts
export function zoneParts(instant: Date, timeZone?: string): ZoneParts {
  if (!timeZone) {
    return {
      year: instant.getFullYear(),
      month: instant.getMonth() + 1,
      day: instant.getDate(),
      hour: instant.getHours(),
      minute: instant.getMinutes(),
      second: instant.getSeconds(),
    }
  }
  const map: Record<string, number> = {}
  for (const p of partsFormat(timeZone).formatToParts(instant)) {
    if (p.type !== 'literal') map[p.type] = Number(p.value)
  }
  let hour = map.hour ?? 0
  if (hour === 24) hour = 0 // some engines emit '24' for midnight under h23
  return { year: map.year!, month: map.month!, day: map.day!, hour, minute: map.minute ?? 0, second: map.second ?? 0 }
}
```

### `function zoneOffsetMs`

Milliseconds `timeZone` is ahead of UTC at `instant` (DST-aware; negative west of UTC). */

```ts
export function zoneOffsetMs(instant: Date, timeZone?: string): number {
  if (!timeZone) return -instant.getTimezoneOffset() * 60_000
  const p = zoneParts(instant, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  // `asUtc` reads the wall-clock as if it were UTC; its distance from the real
  // instant (truncated to whole seconds, matching the parts' resolution) is the offset.
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}
```

### `function toZonedLocal`

An instant -> a Date whose LOCAL fields equal its wall-clock in `timeZone`. */

```ts
export function toZonedLocal(instant: Date, timeZone?: string): Date {
  if (!timeZone) return instant
  const p = zoneParts(instant, timeZone)
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, instant.getMilliseconds())
}
```

### `function instantFromWallClock`

The instant whose wall-clock in `timeZone` is the given Y-M-D H:M:S. */

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
): Date {
  if (!timeZone) return new Date(year, month - 1, day, hour, minute, second, ms)
  const wallUtc = Date.UTC(year, month - 1, day, hour, minute, second, ms)
  // Assume the wall-clock is UTC, subtract the offset there, then correct once
  // in case the candidate instant lands on the other side of a DST transition.
  const off1 = zoneOffsetMs(new Date(wallUtc), timeZone)
  let inst = new Date(wallUtc - off1)
  const off2 = zoneOffsetMs(inst, timeZone)
  if (off2 !== off1) inst = new Date(wallUtc - off2)
  return inst
}
```

### `function fromZonedLocal`

Inverse of {@link toZonedLocal}: a pseudo-local Date -> the real instant. */

```ts
export function fromZonedLocal(pseudo: Date, timeZone?: string): Date {
  if (!timeZone) return pseudo
  return instantFromWallClock(
    pseudo.getFullYear(),
    pseudo.getMonth() + 1,
    pseudo.getDate(),
    pseudo.getHours(),
    pseudo.getMinutes(),
    pseudo.getSeconds(),
    timeZone,
    pseudo.getMilliseconds(),
  )
}
```

### `function zoneAbbr`

Short zone name at `instant`, e.g. "EDT" / "GMT+5:30" - for a ruler header. */

```ts
export function zoneAbbr(instant: Date, timeZone?: string): string {
  if (!timeZone) return ''
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', timeZoneName: 'short' }).formatToParts(instant)
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
}
```

### `function normalizeTimeZone`

Validate an IANA zone id; returns it if usable, else undefined (falls back to local). */

```ts
export function normalizeTimeZone(timeZone?: string): string | undefined {
  if (!timeZone) return undefined
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return timeZone
  } catch {
    return undefined
  }
}
```
