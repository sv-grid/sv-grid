/**
 * scheduler-booking - pure booking-rule helpers for Scheduler Pro: buffers /
 * travel time between bookings, minimum lead time, and duration bounds. No Svelte,
 * no DOM; the renderer folds these into its `bookingBlocked` guard. Callers supply
 * "now" (never `Date.now()` here) so the rules stay deterministic + unit-testable.
 */

const MS_MIN = 60_000

/** A booked interval on a resource, keyed for exclusion, carrying optional data
 *  (e.g. a location) so a per-neighbour gap function can read it. */
export type BusyEvent<T = unknown> = { start: Date; end: Date; key: string; data?: T }

/** Minutes of gap required before/after, either a flat number or a function of the
 *  neighbouring booking (used for travel time between locations). */
export type GapMin<T = unknown> = number | ((neighbour: BusyEvent<T>) => number)

const gapOf = <T>(g: GapMin<T>, ev: BusyEvent<T>): number => (typeof g === 'function' ? g(ev) : g)

/**
 * True when placing `[start, end]` keeps at least the required gap from every other
 * booking in `events` (same resource): `gapBefore` minutes clear of the previous
 * booking's end and `gapAfter` minutes clear of the next booking's start. A direct
 * overlap always fails. `gapBefore` / `gapAfter` may be functions of the neighbour
 * for travel time. `excludeKey` skips the booking being moved.
 */
export function respectsBuffer<T = unknown>(
  start: Date,
  end: Date,
  events: ReadonlyArray<BusyEvent<T>>,
  gapBefore: GapMin<T>,
  gapAfter: GapMin<T>,
  excludeKey?: string,
): boolean {
  const s = start.getTime()
  const e = end.getTime()
  for (const ev of events) {
    if (ev.key === excludeKey) continue
    const es = ev.start.getTime()
    const ee = ev.end.getTime()
    if (s < ee && e > es) return false // direct overlap
    if (ee <= s) {
      if (s - ee < gapOf(gapBefore, ev) * MS_MIN) return false
    } else if (es >= e) {
      if (es - e < gapOf(gapAfter, ev) * MS_MIN) return false
    }
  }
  return true
}

/** True when the booking's duration is within `[minMin, maxMin]` (either bound may
 *  be undefined = unbounded). */
export function withinDurationBounds(start: Date, end: Date, minMin?: number, maxMin?: number): boolean {
  const dur = (end.getTime() - start.getTime()) / MS_MIN
  if (minMin != null && dur < minMin - 1e-9) return false
  if (maxMin != null && dur > maxMin + 1e-9) return false
  return true
}

/** True when the booking starts at least `leadMin` minutes after `now` (min notice). */
export function afterLead(start: Date, now: Date, leadMin: number): boolean {
  return start.getTime() >= now.getTime() + leadMin * MS_MIN
}
