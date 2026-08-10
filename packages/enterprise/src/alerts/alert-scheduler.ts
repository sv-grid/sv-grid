/**
 * alert-scheduler - decouples WHEN alert evaluation runs from the reactive flush
 * that mutates the grid's data. The whole performance premise of the rewrite is
 * that alert work must never lengthen the frame that paints the grid: on a data
 * change we schedule one evaluation for AFTER paint (`requestAnimationFrame`) and
 * coalesce a burst of updates into a single run.
 *
 * Modes:
 *  - `raf`  (default) - run once on the next animation frame, post-paint.
 *  - `idle` - run when the browser is idle (`requestIdleCallback`), best for
 *             non-urgent watch scans; falls back to `raf` where unavailable.
 *  - `sync` - run immediately (deterministic tests, or hosts with no rAF).
 *
 * The scheduler is intentionally tiny and dependency-free: it holds at most one
 * pending callback (the latest wins), so repeated `schedule()` calls within a
 * frame collapse to a single run. The observer accumulates the changed-row queue
 * itself, so "latest wins" loses no work.
 */
export type AlertSchedulerMode = 'raf' | 'idle' | 'sync'

export type AlertScheduler = {
  /** Queue `fn` to run once on the next tick (coalesced). */
  schedule(fn: () => void): void
  /** Run any pending callback now, synchronously. No-op if nothing is pending. */
  flush(): void
  /** Drop any pending callback without running it. */
  cancel(): void
  /** Whether a callback is currently queued. */
  readonly pending: boolean
}

type RafHost = {
  requestAnimationFrame?: (cb: () => void) => number
  cancelAnimationFrame?: (handle: number) => void
  requestIdleCallback?: (cb: () => void) => number
  cancelIdleCallback?: (handle: number) => void
}

const host: RafHost = typeof globalThis !== 'undefined' ? (globalThis as RafHost) : {}

function raf(cb: () => void): () => void {
  if (typeof host.requestAnimationFrame === 'function') {
    const id = host.requestAnimationFrame(cb)
    return () => host.cancelAnimationFrame?.(id)
  }
  const id = setTimeout(cb, 16)
  return () => clearTimeout(id)
}

function idle(cb: () => void): () => void {
  if (typeof host.requestIdleCallback === 'function') {
    const id = host.requestIdleCallback(cb)
    return () => host.cancelIdleCallback?.(id)
  }
  return raf(cb)
}

export function createAlertScheduler(mode: AlertSchedulerMode = 'raf'): AlertScheduler {
  let pendingFn: (() => void) | null = null
  let cancelHandle: (() => void) | null = null

  const request = mode === 'idle' ? idle : raf

  const run = () => {
    cancelHandle = null
    const fn = pendingFn
    pendingFn = null
    fn?.()
  }

  return {
    schedule(fn) {
      if (mode === 'sync') {
        fn()
        return
      }
      // Latest wins - the observer keeps the accumulated queue, so replacing the
      // callback never drops queued rows; it just avoids double-running a frame.
      pendingFn = fn
      if (!cancelHandle) cancelHandle = request(run)
    },
    flush() {
      if (!pendingFn) return
      cancelHandle?.()
      run()
    },
    cancel() {
      cancelHandle?.()
      cancelHandle = null
      pendingFn = null
    },
    get pending() {
      return pendingFn != null
    },
  }
}
