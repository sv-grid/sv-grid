/**
 * scheduler-slots - the pure core behind Scheduler Pro's *bookable slots /
 * find-a-time* (Calendly-style). No Svelte, no DOM. Given a resource's working
 * windows and its busy intervals, it produces the open, bookable slots of a fixed
 * duration - subtracting busy time (widened by buffers) and anything before a
 * minimum start (now + lead). Deterministic: the caller supplies all dates.
 */

export type Interval = { start: Date; end: Date }
export type Slot = { start: Date; end: Date }

const MS_MIN = 60_000

/** Merge overlapping / touching intervals into a sorted, disjoint list. */
export function mergeIntervals(intervals: ReadonlyArray<Interval>): Interval[] {
  const sorted = [...intervals]
    .filter((i) => i.end.getTime() > i.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime())
  const out: Interval[] = []
  for (const iv of sorted) {
    const last = out[out.length - 1]
    if (last && iv.start.getTime() <= last.end.getTime()) {
      if (iv.end.getTime() > last.end.getTime()) last.end = iv.end
    } else out.push({ start: iv.start, end: iv.end })
  }
  return out
}

/** The parts of `[base]` not covered by any of the (merged) `occupied` intervals. */
export function subtractIntervals(base: Interval, occupied: ReadonlyArray<Interval>): Interval[] {
  const occ = mergeIntervals(occupied)
  const out: Interval[] = []
  let cursor = base.start.getTime()
  const end = base.end.getTime()
  for (const o of occ) {
    const os = o.start.getTime()
    const oe = o.end.getTime()
    if (oe <= cursor || os >= end) continue // outside base
    if (os > cursor) out.push({ start: new Date(cursor), end: new Date(Math.min(os, end)) })
    cursor = Math.max(cursor, oe)
    if (cursor >= end) break
  }
  if (cursor < end) out.push({ start: new Date(cursor), end: new Date(end) })
  return out
}

export type SlotOptions = {
  working: ReadonlyArray<Interval>
  busy: ReadonlyArray<Interval>
  durationMin: number
  /** Slot start granularity (minutes). Default = `durationMin` (back-to-back slots). */
  stepMin?: number
  /** Clear minutes required before / after a busy booking (widens what it blocks). */
  bufferBeforeMin?: number
  bufferAfterMin?: number
  /** Earliest allowed slot start (e.g. now + lead time). Slots before it are dropped. */
  minStart?: Date
}

/**
 * The bookable slots. For each working window, subtract busy time (each busy
 * interval widened by the buffers) and anything before `minStart`, then step
 * through the remaining free space emitting `durationMin` slots every `stepMin`.
 */
export function availableSlots(opts: SlotOptions): Slot[] {
  const durMs = Math.max(1, opts.durationMin) * MS_MIN
  const stepMs = Math.max(1, opts.stepMin ?? opts.durationMin) * MS_MIN
  const bufB = (opts.bufferBeforeMin ?? 0) * MS_MIN
  const bufA = (opts.bufferAfterMin ?? 0) * MS_MIN
  const floor = opts.minStart ? opts.minStart.getTime() : -Infinity

  const occupied: Interval[] = opts.busy.map((b) => ({
    start: new Date(b.start.getTime() - bufB),
    end: new Date(b.end.getTime() + bufA),
  }))

  const out: Slot[] = []
  for (const w of mergeIntervals(opts.working)) {
    // Clip the window to `minStart` before subtracting busy.
    const wStart = Math.max(w.start.getTime(), floor)
    if (wStart >= w.end.getTime()) continue
    const free = subtractIntervals({ start: new Date(wStart), end: w.end }, occupied)
    for (const gap of free) {
      let s = gap.start.getTime()
      const gEnd = gap.end.getTime()
      let guard = 0
      while (s + durMs <= gEnd && guard++ < 5000) {
        out.push({ start: new Date(s), end: new Date(s + durMs) })
        s += stepMs
      }
    }
  }
  return out
}
