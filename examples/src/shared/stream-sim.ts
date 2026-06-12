/**
 * Stream simulator used by the real-time / streaming demos.
 *
 * Plays the role of a WebSocket connection without actually opening one
 * - useful for offline-running demos and reproducible buyer walkthroughs.
 *
 * Features the demos rely on:
 *
 *   - **Push events** at a configurable rate (events / second).
 *   - **Pause / resume.** Pausing stops applying events to the subscriber
 *     but keeps them buffered, so resume can drain a backlog (the
 *     "behind by N events" UX in the real-time demo).
 *   - **Simulated disconnects.** Mid-stream connection drops are common
 *     in production; `disconnect(durationMs)` drops the stream for that
 *     long, then reconnects with the same subscriber attached.
 *   - **Throughput control.** `setRate()` re-paces the interval without
 *     resetting the subscription. Used by the throughput slider in the
 *     demo.
 *   - **Sequence numbers + rowVersion.** Every event is stamped, so the
 *     consumer can detect out-of-order delivery and ignore stale updates
 *     - the standard enterprise streaming-merge guarantee.
 *
 * Swap `start()` for `new WebSocket(url)` and the demo's subscription
 * shape (`{ type, data }` messages) ports straight to production.
 */

export type StreamStatus = 'connecting' | 'open' | 'paused' | 'closed' | 'reconnecting'

export type StreamMessage<TData> =
  | { kind: 'status'; status: StreamStatus; at: number }
  | { kind: 'event'; seq: number; data: TData; at: number }

export type StreamSimOptions<TData> = {
  /** Produce the next event payload. Called on every tick. */
  generate: () => TData
  /** Initial events per second. Can change at runtime via `setRate()`. */
  rate: number
  /**
   * Variability in the inter-event delay, 0..1. 0 = perfectly periodic,
   * 1 = delay can vary from 0 to 2x the base. Default 0.4.
   */
  jitter?: number
}

export type StreamSimStats = {
  /** Events emitted to subscribers since start. */
  emitted: number
  /** Events held in the buffer while paused (drained on resume). */
  buffered: number
  /** Reconnect cycles since start. */
  reconnects: number
  /** Synthetic latency reported on the last event, ms. */
  lastLagMs: number
  /** Rolling average synthetic latency, ms. */
  avgLagMs: number
}

export type StreamSim<TData> = {
  start(): void
  stop(): void
  pause(): void
  resume(): void
  setRate(rate: number): void
  /** Drop the connection for `durationMs`, then reconnect. */
  disconnect(durationMs?: number): void
  subscribe(cb: (msg: StreamMessage<TData>) => void): () => void
  readonly status: StreamStatus
  readonly rate: number
  readonly stats: StreamSimStats
}

export function createStreamSim<TData>(options: StreamSimOptions<TData>): StreamSim<TData> {
  let rate = Math.max(0.1, options.rate)
  const jitter = Math.max(0, Math.min(1, options.jitter ?? 0.4))
  let status: StreamStatus = 'closed'
  let timer: ReturnType<typeof setTimeout> | null = null
  let seq = 0
  let buffer: Array<StreamMessage<TData>> = []
  const subscribers = new Set<(msg: StreamMessage<TData>) => void>()
  const stats: StreamSimStats = {
    emitted: 0,
    buffered: 0,
    reconnects: 0,
    lastLagMs: 0,
    avgLagMs: 0,
  }
  let lagSum = 0

  function setStatus(next: StreamStatus): void {
    status = next
    broadcast({ kind: 'status', status: next, at: Date.now() })
  }

  function broadcast(msg: StreamMessage<TData>): void {
    if (status === 'paused' && msg.kind === 'event') {
      buffer.push(msg)
      stats.buffered = buffer.length
      return
    }
    for (const sub of subscribers) sub(msg)
    if (msg.kind === 'event') {
      stats.emitted += 1
      const lag = Math.round(8 + Math.random() * 80)
      stats.lastLagMs = lag
      lagSum += lag
      stats.avgLagMs = Math.round(lagSum / stats.emitted)
    }
  }

  function nextDelay(): number {
    const base = 1000 / rate
    return base * (1 + (Math.random() * 2 - 1) * jitter)
  }

  function scheduleNext(): void {
    if (status !== 'open' && status !== 'paused') return
    timer = setTimeout(emit, nextDelay())
  }

  function emit(): void {
    timer = null
    if (status !== 'open' && status !== 'paused') return
    seq += 1
    broadcast({ kind: 'event', seq, data: options.generate(), at: Date.now() })
    scheduleNext()
  }

  return {
    start() {
      if (status === 'open' || status === 'paused') return
      // Defer ALL status broadcasts to a microtask. Calling
      // `setStatus('connecting')` synchronously inside `start()` would
      // run the subscriber's writes (e.g. `connectionStatus = …`)
      // INSIDE whatever Svelte $effect called `start()` - Svelte 5
      // tracks those writes as effect deps and re-runs the effect,
      // which re-subscribes, which re-broadcasts, until the depth
      // guard trips. Deferring breaks the synchronous chain so the
      // setup effect can complete cleanly first.
      queueMicrotask(() => {
        if (status !== 'closed') return
        setStatus('connecting')
        // Tiny artificial handshake delay so the demo can show the
        // "connecting…" pill briefly. Real WS does the same.
        setTimeout(() => {
          if (status === 'closed') return
          setStatus('open')
          scheduleNext()
        }, 120)
      })
    },
    stop() {
      if (timer) clearTimeout(timer)
      timer = null
      buffer = []
      stats.buffered = 0
      setStatus('closed')
    },
    pause() {
      if (status !== 'open') return
      setStatus('paused')
    },
    resume() {
      if (status !== 'paused') return
      // Drain the buffer through normal channels so subscribers see
      // every event they missed (in order).
      const queued = buffer
      buffer = []
      stats.buffered = 0
      setStatus('open')
      for (const msg of queued) broadcast(msg)
      scheduleNext()
    },
    setRate(next) {
      rate = Math.max(0.1, next)
      // Re-pace: cancel the pending tick and schedule a new one off
      // the new delay so the new rate takes hold immediately.
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      scheduleNext()
    },
    disconnect(durationMs = 4000) {
      if (status === 'closed') return
      if (timer) clearTimeout(timer)
      timer = null
      stats.reconnects += 1
      setStatus('reconnecting')
      setTimeout(() => {
        if (status === 'closed') return
        setStatus('open')
        scheduleNext()
      }, durationMs)
    },
    subscribe(cb) {
      subscribers.add(cb)
      return () => {
        subscribers.delete(cb)
      }
    },
    get status() {
      return status
    },
    get rate() {
      return rate
    },
    get stats() {
      return stats
    },
  }
}
