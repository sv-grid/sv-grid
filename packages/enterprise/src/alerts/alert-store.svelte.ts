/**
 * alert-store - the reactive log behind the alerts badge + panel. A singleton
 * queue of fired `AlertEvent`s (newest first) with an unacknowledged count,
 * mirroring the grid's `toast-store` shape. The observer pushes events here; the
 * badge reads `activeCount`; the panel lists, acknowledges, and clears them.
 *
 * Perf: a burst of events from one evaluation is written in ONE array update via
 * `pushMany` (not one reassignment per event), and `activeCount` is a maintained
 * counter - not an O(n) reduce recomputed on every render.
 */
import type { AlertEvent } from './alert-types'

const MAX = 500

function createAlertStore() {
  let events = $state<AlertEvent[]>([])
  let active = $state(0)
  let seq = 0

  /** Recompute the unacknowledged counter after a trim/clear/ack. */
  function recount(list: ReadonlyArray<AlertEvent>): number {
    let n = 0
    for (const e of list) if (!e.acknowledged) n++
    return n
  }

  return {
    get events() {
      return events
    },
    /** Number of unacknowledged events (what the badge shows). */
    get activeCount() {
      return active
    },
    /** Append one event (kept for API compatibility; prefer `pushMany`). */
    push(event: AlertEvent) {
      this.pushMany([event])
    },
    /** Append a batch of events in a single reactive update (newest first). */
    pushMany(batch: ReadonlyArray<AlertEvent>) {
      if (batch.length === 0) return
      const tagged: AlertEvent[] = []
      let added = 0
      // Newest first: reverse so the last event in the batch ends up on top.
      for (let i = batch.length - 1; i >= 0; i--) {
        tagged.push({ ...batch[i]!, _id: ++seq } as AlertEvent & { _id: number })
        if (!batch[i]!.acknowledged) added++
      }
      let next = [...tagged, ...events]
      if (next.length > MAX) {
        next = next.slice(0, MAX)
        // A trim can drop unacknowledged events - recount to stay exact.
        active = recount(next)
      } else {
        active += added
      }
      events = next
    },
    acknowledge(index: number) {
      const next = events.slice()
      const cur = next[index]
      if (cur && !cur.acknowledged) {
        next[index] = { ...cur, acknowledged: true }
        active = Math.max(0, active - 1)
        events = next
      }
    },
    acknowledgeAll() {
      events = events.map((e) => (e.acknowledged ? e : { ...e, acknowledged: true }))
      active = 0
    },
    clear() {
      events = []
      active = 0
    },
  }
}

/** The shared alerts log. Read `.events` / `.activeCount` inside a component. */
export const alertStore = createAlertStore()
