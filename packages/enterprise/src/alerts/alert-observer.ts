/**
 * alert-observer - the observation layer that turns data movement into engine
 * passes WITHOUT ever blocking the grid's render frame, and in O(changed) rather
 * than O(all rows).
 *
 * Two ways to feed it, both funnelling through the same coalescing scheduler so
 * at most one evaluation runs per frame, post-paint:
 *
 *  - PUSH  (`pushChanged`) - the consumer already knows which rows changed (a
 *    streaming feed, a transaction, the flagship demo's own tick loop). We
 *    evaluate ONLY those rows. Cost is O(rows that changed) at any dataset size.
 *
 *  - SCAN  (`scan`) - the zero-effort fallback for a plain `data = ...` where no
 *    change signal exists. We index-diff the new array against the previous one
 *    (Svelte 5 replaces changed rows immutably, so unchanged rows keep their
 *    reference) and evaluate only the mismatches. Still O(all rows) to FIND the
 *    changes, but deferred to after paint so it never lengthens the grid's frame.
 *
 * Cloning of previous row values is gated on `engine.needsPrev()`: for a rule set
 * that is purely `dataChange`/aggregate (the common case), we keep NO prev
 * snapshots at all - the biggest GC saver on large live feeds. Full-set passes
 * (aggregate scope, or a row-count change) run on the same deferred path.
 *
 * Pure TypeScript - no Svelte, no DOM. The `<SvGridAlerts>` overlay wires an
 * instance to a scheduler and an `onEvents` sink; `attachAlertEngine` wraps it
 * for non-Svelte hosts.
 */
import type { AlertEngine } from './alert-engine'
import type { AlertEvent, AlertRule } from './alert-types'
import { createAlertScheduler, type AlertScheduler, type AlertSchedulerMode } from './alert-scheduler'

export type AlertObserverOptions<TData> = {
  engine: AlertEngine<TData>
  getRowId: (row: TData) => string
  /** Fired events to route to side effects (toast/log/formats). Batched per run. */
  onEvents: (events: AlertEvent[]) => void
  /** Scheduling strategy (default `raf`), or a custom scheduler for tests. */
  schedule?: AlertSchedulerMode | AlertScheduler
}

export type AlertObserver<TData> = {
  /** Silent full seed - arms edges from the current set so pre-existing matches
   *  do not fire. Call on mount and after a rule change (in push mode). */
  seed(rows: ReadonlyArray<TData>): void
  /** Queue changed rows for a deferred, O(changed) evaluation (push mode). */
  pushChanged(rows: ReadonlyArray<TData>): void
  /** Schedule a deferred index-diff scan of the latest full row set (watch mode). */
  scan(getRows: () => ReadonlyArray<TData>): void
  /** Swap the rule set; edge memory is reset and a fresh seed is required. */
  setRules(rules: AlertRule[]): void
  /** Run any pending evaluation immediately (e.g. before a snapshot/test). */
  flush(): void
  /** Stop: cancel pending work and release retained snapshots. */
  detach(): void
}

const clone = <TData>(r: TData): TData =>
  r && typeof r === 'object' ? ({ ...(r as Record<string, unknown>) } as TData) : r

export function createAlertObserver<TData = Record<string, unknown>>(
  opts: AlertObserverOptions<TData>,
): AlertObserver<TData> {
  const { engine, getRowId, onEvents } = opts
  const scheduler: AlertScheduler =
    opts.schedule && typeof opts.schedule === 'object'
      ? opts.schedule
      : createAlertScheduler(opts.schedule ?? 'raf')

  // Carry-over between runs. Only populated when a rule actually needs it.
  let seeded = false
  let prevRows: ReadonlyArray<TData> = [] // last array seen by scan (reference diff)
  let prevSnapById = new Map<string, TData>() // cloned prev VALUES (only if needsPrev)
  let fullById: Map<string, TData> | null = null // full current set (only if needsFullSet)

  // Pending work, accumulated between scheduler runs.
  const pushQueue = new Map<string, TData>()
  let scanSource: (() => ReadonlyArray<TData>) | null = null

  function snapshotAll(rows: ReadonlyArray<TData>) {
    prevSnapById = new Map()
    for (const row of rows) prevSnapById.set(getRowId(row), clone(row))
  }

  function rebuildFullIndex(rows: ReadonlyArray<TData>) {
    fullById = new Map()
    for (const row of rows) fullById.set(getRowId(row), row)
  }

  function seedNow(rows: ReadonlyArray<TData>) {
    engine.reset()
    engine.evaluate(rows) // arm dataChange/aggregate edges; discard the events
    seeded = true
    prevRows = rows
    if (engine.needsPrev()) snapshotAll(rows)
    else prevSnapById = new Map()
    if (engine.needsFullSet()) rebuildFullIndex(rows)
    else fullById = null
  }

  function emit(events: AlertEvent[]) {
    if (events.length) onEvents(events)
  }

  /** PUSH run: evaluate exactly the queued rows (or the full set for aggregates). */
  function runPush() {
    const next = [...pushQueue.values()]
    pushQueue.clear()
    if (next.length === 0) return
    const needsPrev = engine.needsPrev()

    if (engine.needsFullSet()) {
      // Aggregates need every row; evaluate over the maintained full index.
      const rows = fullById ? [...fullById.values()] : next
      const prev = needsPrev ? [...prevSnapById.values()] : []
      const events = engine.evaluateTransition(prev, rows)
      if (needsPrev) snapshotAll(rows)
      emit(events)
      return
    }

    const prev = needsPrev ? next.map((r) => prevSnapById.get(getRowId(r)) ?? r) : []
    if (needsPrev) for (const r of next) prevSnapById.set(getRowId(r), clone(r))
    emit(engine.evaluateTransition(prev, next))
  }

  /** SCAN run: index-diff the latest full array and evaluate the mismatches. */
  function runScan(rows: ReadonlyArray<TData>) {
    if (!seeded) {
      seedNow(rows)
      return
    }
    const needsPrev = engine.needsPrev()
    const needsFull = engine.needsFullSet() || rows.length !== prevRows.length

    if (needsFull) {
      const prev = needsPrev ? [...prevSnapById.values()] : []
      const events = engine.evaluateTransition(prev, rows)
      prevRows = rows
      if (needsPrev) snapshotAll(rows)
      if (engine.needsFullSet()) rebuildFullIndex(rows)
      emit(events)
      return
    }

    // Fast path: index-aligned reference diff (unchanged rows keep their ref).
    const changedNext: TData[] = []
    const changedPrev: TData[] = []
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] !== prevRows[i]) {
        const row = rows[i] as TData
        changedNext.push(row)
        if (needsPrev) changedPrev.push(prevSnapById.get(getRowId(row)) ?? row)
      }
    }
    prevRows = rows
    if (changedNext.length === 0) return
    if (needsPrev) for (const r of changedNext) prevSnapById.set(getRowId(r), clone(r))
    emit(engine.evaluateTransition(changedPrev, changedNext))
  }

  function run() {
    // A consumer drives one mode at a time; be defensive and honour whichever
    // has pending work (scan takes precedence as it carries the full set).
    if (scanSource) {
      const src = scanSource
      scanSource = null
      runScan(src())
    }
    if (pushQueue.size) runPush()
  }

  return {
    seed(rows) {
      // Seeding is a one-off; do it synchronously so edges are armed before the
      // first data event, then let subsequent evaluations defer.
      seedNow(rows)
    },
    pushChanged(rows) {
      if (fullById) for (const r of rows) fullById.set(getRowId(r), r)
      for (const r of rows) pushQueue.set(getRowId(r), r)
      if (!seeded) seeded = true // push implies the consumer is driving; edges arm lazily
      scheduler.schedule(run)
    },
    scan(getRows) {
      scanSource = getRows
      scheduler.schedule(run)
    },
    setRules(rules) {
      engine.setRules(rules)
      engine.reset()
      // Force a fresh silent seed before anything fires under the new rules.
      seeded = false
      prevSnapById = new Map()
      fullById = null
      pushQueue.clear()
    },
    flush() {
      scheduler.flush()
    },
    detach() {
      scheduler.cancel()
      prevSnapById = new Map()
      fullById = null
      pushQueue.clear()
      scanSource = null
    },
  }
}
