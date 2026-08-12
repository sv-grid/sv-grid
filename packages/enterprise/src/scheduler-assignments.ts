/**
 * scheduler-assignments - the pure core behind Scheduler Pro *multi-assignment*
 * (one event assigned to several resources) and the *resource utilization
 * histogram*. No Svelte, no DOM. Generic over the event shape via accessor
 * callbacks so it needs no dependency on the grid's ResolvedEvent.
 */

/** A many-to-many event <-> resource link, with an optional allocation (0..1). */
export type SchedulerAssignment = {
  id: string
  eventId: string
  resourceId: string
  /** Allocation fraction, default 1 (full). Summed for histogram / overallocation. */
  units?: number
}

/** One event placed on one resource (the flattened render unit). */
export type Allocation<E = unknown> = {
  event: E
  key: string
  resourceId: string
  units: number
  start: Date
  end: Date
}

export type ExpandOptions<E> = {
  keyOf: (e: E) => string
  startOf: (e: E) => Date
  endOf: (e: E) => Date
  /** Single-resource fallback when an event has no assignment. */
  resourceOf?: (e: E) => string | undefined
}

const MS_MIN = 60_000

/**
 * Flatten events into per-resource allocations. An event with assignments renders
 * once per assigned resource (deduped by eventId+resourceId, keeping the max
 * units); an event with none falls back to its single `resourceOf` (units 1), or
 * is dropped when it has neither. The result drives the resource-column bucketing.
 */
export function expandAssignments<E>(
  events: ReadonlyArray<E>,
  assignments: ReadonlyArray<SchedulerAssignment>,
  opts: ExpandOptions<E>,
): Allocation<E>[] {
  // Group assignments by eventId, collapsing duplicate resources to the max units.
  const byEvent = new Map<string, Map<string, number>>()
  for (const a of assignments) {
    if (!a || !a.eventId || !a.resourceId) continue
    let m = byEvent.get(a.eventId)
    if (!m) byEvent.set(a.eventId, (m = new Map()))
    const units = a.units == null ? 1 : a.units
    m.set(a.resourceId, Math.max(m.get(a.resourceId) ?? 0, units))
  }

  const out: Allocation<E>[] = []
  for (const e of events) {
    const key = opts.keyOf(e)
    const start = opts.startOf(e)
    const end = opts.endOf(e)
    const m = byEvent.get(key)
    if (m && m.size) {
      for (const [resourceId, units] of m) out.push({ event: e, key, resourceId, units, start, end })
    } else {
      const resourceId = opts.resourceOf?.(e)
      if (resourceId != null) out.push({ event: e, key, resourceId, units: 1, start, end })
    }
  }
  return out
}

/** True when `[aStart,aEnd)` overlaps `[bStart,bEnd)`. */
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime()
}

/**
 * Summed allocation units on `resourceId` overlapping the bucket
 * `[bucketStart, bucketEnd)` - the height of one histogram bar.
 */
export function resourceLoad<E>(
  allocs: ReadonlyArray<Allocation<E>>,
  resourceId: string,
  bucketStart: Date,
  bucketEnd: Date,
): number {
  let load = 0
  for (const a of allocs) {
    if (a.resourceId !== resourceId) continue
    if (overlaps(a.start, a.end, bucketStart, bucketEnd)) load += a.units
  }
  return load
}

/** One over-capacity bucket (summed load exceeds the resource capacity). */
export type Overallocation = { resourceId: string; start: Date; end: Date; load: number; capacity: number }

/**
 * Buckets where a resource's summed load exceeds its capacity. `buckets` are the
 * axis intervals to test; `capacity` is a flat number or a per-resource function
 * (default 1). Used to tint histogram bars / flag conflicts.
 */
export function overallocations<E>(
  allocs: ReadonlyArray<Allocation<E>>,
  resourceIds: ReadonlyArray<string>,
  buckets: ReadonlyArray<{ start: Date; end: Date }>,
  capacity: number | ((resourceId: string) => number) = 1,
): Overallocation[] {
  const capOf = typeof capacity === 'function' ? capacity : () => capacity
  const out: Overallocation[] = []
  for (const resourceId of resourceIds) {
    const cap = capOf(resourceId)
    for (const b of buckets) {
      const load = resourceLoad(allocs, resourceId, b.start, b.end)
      if (load > cap + 1e-9) out.push({ resourceId, start: b.start, end: b.end, load, capacity: cap })
    }
  }
  return out
}

/**
 * Total assigned minutes per resource across `allocs` (a simple utilization
 * roll-up for a legend / header, independent of buckets).
 */
export function assignedMinutes<E>(allocs: ReadonlyArray<Allocation<E>>, resourceId: string): number {
  let mins = 0
  for (const a of allocs) {
    if (a.resourceId !== resourceId) continue
    mins += ((a.end.getTime() - a.start.getTime()) / MS_MIN) * a.units
  }
  return mins
}
