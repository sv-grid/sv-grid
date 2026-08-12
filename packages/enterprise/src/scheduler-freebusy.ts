/**
 * scheduler-freebusy - the pure core behind Scheduler Pro's *free/busy* and
 * *cross-attendee find-a-time*. No Svelte, no DOM. Merges each attendee's busy
 * intervals and finds the windows when EVERYONE is free (long enough for a meeting).
 * Deterministic - the caller supplies all dates. Reuses the interval algebra from
 * scheduler-slots (`mergeIntervals` / `subtractIntervals`).
 */
import { mergeIntervals, subtractIntervals, type Interval } from './scheduler-slots'

export type { Interval }

const MS_MIN = 60_000

/** Union of a set of busy intervals into a sorted, disjoint list (an alias of the
 *  slots merge, named for the free/busy domain). */
export function mergeBusy(intervals: ReadonlyArray<Interval>): Interval[] {
  return mergeIntervals(intervals)
}

/**
 * The windows within `[dayStart, dayEnd]` when EVERY attendee is free, each at
 * least `durationMin` long. `busyByPerson` is one busy list per attendee; a person
 * with no entry is treated as fully free. The result is the complement of the union
 * of all busy time, filtered to windows that can fit the meeting.
 */
export function commonFree(
  busyByPerson: ReadonlyArray<ReadonlyArray<Interval>>,
  dayStart: Date,
  dayEnd: Date,
  durationMin: number,
): Interval[] {
  const allBusy = mergeIntervals(busyByPerson.flat())
  const free = subtractIntervals({ start: dayStart, end: dayEnd }, allBusy)
  const minMs = Math.max(0, durationMin) * MS_MIN
  return free.filter((f) => f.end.getTime() - f.start.getTime() >= minMs)
}
