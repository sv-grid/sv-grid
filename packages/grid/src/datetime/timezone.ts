/**
 * Pure, framework-free IANA-timezone helpers, built on `Intl` (no date library).
 *
 * The scheduler renders in a chosen `timeZone` via a "pseudo-local" trick:
 * {@link toZonedLocal} turns an absolute instant into a Date whose *local*
 * wall-clock equals the wall-clock in `timeZone`, so all the existing
 * local-based date math (startOfDay, minuteOfDay, layout) runs unchanged; then
 * {@link fromZonedLocal} converts a user edit back to a real instant. When
 * `timeZone` is undefined every function is the identity on the browser's zone.
 *
 * These functions are DST-aware and take no ambient "now" (safe for the model /
 * headless contexts that forbid `Date.now()`).
 */

/** A wall-clock time broken into fields, as it reads in a specific time zone. */
export type ZoneParts = {
  year: number
  month: number // 1-12
  day: number
  hour: number // 0-23
  minute: number
  second: number
}

const fmtCache = new Map<string, Intl.DateTimeFormat>()
function partsFormat(timeZone: string): Intl.DateTimeFormat {
  let f = fmtCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    fmtCache.set(timeZone, f)
  }
  return f
}

/** The wall-clock parts of `instant` in `timeZone` (browser-local if undefined). */
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

/** Milliseconds `timeZone` is ahead of UTC at `instant` (DST-aware; negative west of UTC). */
export function zoneOffsetMs(instant: Date, timeZone?: string): number {
  if (!timeZone) return -instant.getTimezoneOffset() * 60_000
  const p = zoneParts(instant, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  // `asUtc` reads the wall-clock as if it were UTC; its distance from the real
  // instant (truncated to whole seconds, matching the parts' resolution) is the offset.
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/** An instant -> a Date whose LOCAL fields equal its wall-clock in `timeZone`. */
export function toZonedLocal(instant: Date, timeZone?: string): Date {
  if (!timeZone) return instant
  const p = zoneParts(instant, timeZone)
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, instant.getMilliseconds())
}

/** The instant whose wall-clock in `timeZone` is the given Y-M-D H:M:S. */
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

/** Inverse of {@link toZonedLocal}: a pseudo-local Date -> the real instant. */
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

/** Short zone name at `instant`, e.g. "EDT" / "GMT+5:30" - for a ruler header. */
export function zoneAbbr(instant: Date, timeZone?: string): string {
  if (!timeZone) return ''
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', timeZoneName: 'short' }).formatToParts(instant)
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
}

/** Validate an IANA zone id; returns it if usable, else undefined (falls back to local). */
export function normalizeTimeZone(timeZone?: string): string | undefined {
  if (!timeZone) return undefined
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return timeZone
  } catch {
    return undefined
  }
}
