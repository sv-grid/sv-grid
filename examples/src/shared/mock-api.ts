/**
 * Mock API helper used by the server-side / streaming / analytics demos.
 *
 * What it gives you, beyond `await fetch(...)`:
 *
 *   1. **Debouncing.** Typed input (search, in-grid filter) calls `query()`
 *      on every keystroke; only the last one inside the debounce window
 *      actually fires. Click-driven input (page click, sort header) passes
 *      `{ immediate: true }` to skip the wait.
 *
 *   2. **Cancellation.** Each call gets its own `AbortController`. A new
 *      call cancels the previous one - race-safe by construction, so a
 *      slow earlier request can't paint stale data over a fresh one.
 *
 *   3. **Simulated latency.** Optional fixed or range delay, so the demo
 *      can show a "Loading…" indicator without doing real network I/O.
 *
 *   4. **Stats.** Request count, last latency, rolling average latency,
 *      currently in-flight flag. The demos surface these in a small
 *      dev-tools-style panel so the buyer can see the round-trip story.
 *
 * Replace `handler` with a real `fetch(...)` and the same shape ports to
 * production: every wire-side behaviour the demo demonstrates is
 * preserved.
 */

export type MockApiHandler<TQuery, TResult> = (
  query: TQuery,
  signal: AbortSignal,
) => Promise<TResult>

export type MockApiStats = {
  /** Total number of completed (non-aborted) requests. */
  requests: number
  /** Number of requests cancelled mid-flight by a newer request. */
  cancelled: number
  /** Last completed request's wall time, in ms. */
  lastLatencyMs: number
  /** Average wall time across all completed requests, in ms. */
  avgLatencyMs: number
  /** True while a request is in-flight (incl. debounce wait). */
  inFlight: boolean
}

export type MockApiOptions = {
  /**
   * Wait this many ms before firing a queued call. A new call inside the
   * window resets the timer. Click-driven calls can override per-call via
   * `query(q, { immediate: true })`. Default: 0 (no debounce).
   */
  debounceMs?: number
  /**
   * Inject a fake latency before the handler runs. Number = fixed, range
   * = uniform between min and max. Default: 0.
   */
  latencyMs?: number | { min: number; max: number }
  /**
   * Probability (0..1) of throwing a fake error to simulate a flaky
   * endpoint. The demo can use this to show retry/backoff UX. Default: 0.
   */
  errorRate?: number
}

export type MockApi<TQuery, TResult> = {
  /**
   * Fire a query. If a previous call is still in-flight (or queued in
   * the debounce window), it is cancelled first. Returns a promise
   * that resolves with the handler's result, or rejects with an
   * `AbortError` if a newer call superseded this one. Pass
   * `{ immediate: true }` to bypass the debounce.
   */
  query: (q: TQuery, options?: { immediate?: boolean }) => Promise<TResult>
  /** Cancel any in-flight or queued call without starting a new one. */
  cancel: () => void
  /** Live stats - read inside a Svelte `$derived` to drive UI. */
  readonly stats: MockApiStats
}

export function createMockApi<TQuery, TResult>(
  handler: MockApiHandler<TQuery, TResult>,
  options: MockApiOptions = {},
): MockApi<TQuery, TResult> {
  const debounceMs = options.debounceMs ?? 0
  const latency = options.latencyMs ?? 0
  const errorRate = options.errorRate ?? 0

  let controller: AbortController | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const stats: MockApiStats = {
    requests: 0,
    cancelled: 0,
    lastLatencyMs: 0,
    avgLatencyMs: 0,
    inFlight: false,
  }
  let latencySum = 0

  function pickLatency(): number {
    if (typeof latency === 'number') return latency
    return latency.min + Math.random() * (latency.max - latency.min)
  }

  function cancel() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (controller) {
      controller.abort()
      controller = null
      stats.cancelled += 1
    }
    stats.inFlight = false
  }

  function query(q: TQuery, opts: { immediate?: boolean } = {}): Promise<TResult> {
    cancel()
    stats.inFlight = true
    return new Promise<TResult>((resolve, reject) => {
      const delay = opts.immediate ? 0 : debounceMs
      const start = performance.now()

      const fire = async () => {
        debounceTimer = null
        const ctrl = new AbortController()
        controller = ctrl
        const signal = ctrl.signal

        try {
          // Faked network latency. Honors abort so a cancelled call
          // doesn't keep sleeping in the background.
          const wait = pickLatency()
          if (wait > 0) {
            await new Promise<void>((res, rej) => {
              const t = setTimeout(res, wait)
              signal.addEventListener('abort', () => {
                clearTimeout(t)
                rej(new DOMException('aborted', 'AbortError'))
              })
            })
          }

          // Probabilistic failure for "flaky endpoint" demos.
          if (errorRate > 0 && Math.random() < errorRate) {
            throw new Error('Simulated network error')
          }

          const result = await handler(q, signal)
          if (signal.aborted) {
            reject(new DOMException('aborted', 'AbortError'))
            return
          }
          const elapsed = performance.now() - start
          stats.requests += 1
          stats.lastLatencyMs = Math.round(elapsed)
          latencySum += elapsed
          stats.avgLatencyMs = Math.round(latencySum / stats.requests)
          stats.inFlight = false
          controller = null
          resolve(result)
        } catch (err) {
          if ((err as Error).name === 'AbortError') {
            reject(err)
            return
          }
          stats.inFlight = false
          controller = null
          reject(err)
        }
      }

      if (delay > 0) {
        debounceTimer = setTimeout(fire, delay)
      } else {
        void fire()
      }
    })
  }

  return {
    query,
    cancel,
    get stats() {
      return stats
    },
  }
}

/** Deterministic seedable PRNG used by demo data generators. */
export function createPrng(seed = 0xC0FFEE15) {
  let s = seed >>> 0
  return {
    next(): number {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 0xFFFFFFFF
    },
    int(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min
    },
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(this.next() * arr.length)]!
    },
  }
}
