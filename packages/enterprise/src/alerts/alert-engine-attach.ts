/**
 * Headless glue between the pure engine and the running grid.
 *
 * The grid's `onCellValueChange` fires only for edits made through the grid, not
 * for streaming feeds / server pushes / a programmatic `data = ...`. Alerts must
 * react to all of those, so we observe changes by diffing snapshots (the same
 * approach the grid's `attachAutoSavedView` uses for state). `applyAlertEvents`
 * routes fired events
 * to their side effects (toast, log) and returns the visual bits (conditional
 * formats + cells to flash) for the caller to paint. The `<SvGridAlerts>`
 * overlay drives this reactively via `$effect`; `attachAlertEngine` offers the
 * same as a plain-JS interval poll for non-Svelte hosts.
 */
import type { ConditionalFormat } from '@svgrid/grid/format'
import { toast } from '@svgrid/grid'
import { alertStore } from './alert-store.svelte'
import { toConditionalFormats } from './alert-formats'
import { createAlertEngine, type AlertEngine } from './alert-engine'
import type { AlertEvent, AlertRule } from './alert-types'

export type FlashTarget = { rowId: string; columnId?: string }

export type ApplyAlertOptions = {
  /**
   * Gate which fired events actually raise a toast. Every event is still logged
   * (the badge/panel stay accurate) - this only suppresses the visible toast, so
   * a busy live feed does not become a toast storm. Return `false` to skip the
   * toast. Defaults to always-toast.
   */
  shouldToast?: (event: AlertEvent) => boolean
}

/**
 * Perform the side effects of a batch of fired events and return the visual
 * output: every event is recorded in the log (so the badge/panel stay accurate),
 * `toast` actions raise a toast (subject to `shouldToast`), and
 * `badge`/`highlight`/`cellFlash` actions yield formats + flash targets for the
 * caller to apply to the grid.
 *
 * The whole batch lands in the log in ONE reactive write (`pushMany`) so a burst
 * of firings from a single evaluation does not thrash the store.
 */
export function applyAlertEvents<TData = Record<string, unknown>>(
  events: ReadonlyArray<AlertEvent>,
  getRowId: (row: TData) => string,
  options: ApplyAlertOptions = {},
): { formats: ConditionalFormat<TData>[]; flashes: FlashTarget[] } {
  if (events.length === 0) return { formats: [], flashes: [] }
  alertStore.pushMany(events)
  const allow = options.shouldToast
  for (const event of events) {
    if (event.actions.some((a) => a.kind === 'toast') && (!allow || allow(event))) {
      toast[event.severity](event.message)
    }
  }
  const flashes: FlashTarget[] = []
  for (const event of events) {
    if (event.rowId && event.actions.some((a) => a.kind === 'cellFlash')) {
      flashes.push({ rowId: event.rowId, columnId: event.columnId })
    }
  }
  return { formats: toConditionalFormats(events, getRowId), flashes }
}

export type AttachAlertOptions<TData> = {
  rules: AlertRule[]
  getRowId: (row: TData) => string
  /** Read the grid's current rows. */
  getData: () => ReadonlyArray<TData>
  getValue?: (row: TData, columnId: string) => unknown
  locale?: string | ReadonlyArray<string>
  /** Merge alert-driven conditional formats into the grid. */
  applyFormats?: (formats: ConditionalFormat<TData>[]) => void
  /** Flash a cell (e.g. call `api.flashCells`). */
  flashCell?: (target: FlashTarget) => void
  /** Poll interval in ms (`0` disables polling - drive `tick()` yourself). */
  intervalMs?: number
}

export type AlertAttachment<TData> = {
  engine: AlertEngine<TData>
  /** Run one evaluation pass against the latest data. */
  tick(): void
  /** Push new rules into the engine (e.g. after the user edits a rule). */
  setRules(rules: AlertRule[]): void
  detach(): void
}

/**
 * Wire the engine to a data source. On the first pass it seeds edges silently
 * from the current snapshot (so pre-existing matches do not fire); thereafter
 * each pass fires newly-matching rows.
 *
 * Perf: cloning a previous snapshot is gated on `engine.needsPrev()`. For a rule
 * set that is purely `dataChange`/aggregate (the common case) NO clone is taken -
 * `engine.evaluate` re-checks the current rows and its edge memory (the `active`
 * set) fires each row exactly once when it starts matching. Only `relativeChange`
 * rules, which compare prev -> next, pay for a snapshot. This is the non-Svelte
 * poll host; for the reactive overlay, `createAlertObserver` adds a scheduler and
 * an O(changed) push path. Returns `detach()` to stop.
 */
export function attachAlertEngine<TData = Record<string, unknown>>(
  opts: AttachAlertOptions<TData>,
): AlertAttachment<TData> {
  const engine = createAlertEngine<TData>({
    rules: opts.rules,
    getRowId: opts.getRowId,
    getValue: opts.getValue,
    locale: opts.locale,
  })

  let prev: TData[] | null = null
  let seeded = false

  const snapshot = (rows: ReadonlyArray<TData>): TData[] =>
    rows.map((r) => (r && typeof r === 'object' ? ({ ...r } as TData) : r))

  const flush = (events: AlertEvent[]) => {
    if (events.length === 0) return
    const { formats, flashes } = applyAlertEvents(events, opts.getRowId)
    if (formats.length && opts.applyFormats) opts.applyFormats(formats)
    if (opts.flashCell) flashes.forEach((f) => opts.flashCell?.(f))
  }

  const tick = () => {
    const rows = opts.getData()
    const needsPrev = engine.needsPrev()
    let events: AlertEvent[]
    if (!seeded) {
      // Silent seed: arm edges from the current set, fire nothing.
      engine.evaluate(rows)
      events = []
      seeded = true
    } else if (needsPrev) {
      events = engine.evaluateTransition(prev ?? [], rows)
    } else {
      // No rule reads prev - the edge set dedups, so no clone/diff is needed.
      events = engine.evaluate(rows)
    }
    prev = needsPrev ? snapshot(rows) : null
    flush(events)
  }

  const interval = opts.intervalMs ?? 400
  let timer: ReturnType<typeof setInterval> | null = null
  if (interval > 0) {
    tick()
    timer = setInterval(tick, interval)
  }

  return {
    engine,
    tick,
    setRules(rules) {
      engine.setRules(rules)
      engine.reset()
      prev = null
      seeded = false
    },
    detach() {
      if (timer) clearInterval(timer)
      timer = null
    },
  }
}
