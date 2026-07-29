/**
 * Scheduling - client-side, cron-driven automation for grid actions.
 *
 * Two everyday jobs that normally need a backend job runner - "email me this
 * report every weekday at 17:30" and "remind the desk at 09:00 to reconcile" -
 * are, in a long-lived data app, just a timer plus an action you already have:
 * an export (`api.exportCsv` / `@svgrid/enterprise` Excel/PDF) or an alert
 * (`toast`). This module supplies the missing middle: a pure cron matcher and a
 * small runtime that fires your callback when a schedule comes due.
 *
 * Everything here is pure and injectable (`now`), so the matching logic is
 * unit-testable without wall-clock flakiness, and the render/app layer just
 * wires `onFire` to whatever action it wants.
 *
 * ```ts
 * import { createScheduler } from '@svgrid/enterprise'
 * import { toast } from '@svgrid/grid'
 *
 * const scheduler = createScheduler({
 *   schedules: [
 *     { id: 'eod', name: 'End-of-day CSV', cron: '30 17 * * 1-5' },
 *     { id: 'standup', name: 'Stand-up reminder', cron: '0 9 * * *' },
 *   ],
 *   onFire(schedule) {
 *     if (schedule.id === 'eod') api.exportCsv({ filename: 'eod' })
 *     else toast.info(`${schedule.name}`)
 *   },
 * })
 * scheduler.start()   // stop() on teardown
 * ```
 *
 * Caveat, by design: schedules run entirely in the browser tab, so the app has
 * to be open when a schedule is due. Pair with a server job for guaranteed
 * delivery; use this for the far more common "the dashboard is always up on the
 * wall" case where a backend cron is overkill.
 */

/** A field in the range [min, max] that a parsed cron sub-expression matches. */
type CronField = { min: number; max: number; match: (n: number) => boolean }

export type Schedule = {
  /** Stable id - used to dedupe fires and to key your `onFire` switch. */
  id: string
  /** Human label shown in a schedules panel / toast. */
  name?: string
  /**
   * Recurring trigger: a standard 5-field cron expression
   * `"minute hour day-of-month month day-of-week"`. Ignored when `runAt` is set.
   * Supports `*`, lists (`1,15`), ranges (`1-5`), and steps (`*​/15`, `9-17/2`).
   * Day-of-week is `0-6` with Sunday `0` (`7` also accepted for Sunday).
   */
  cron?: string
  /**
   * One-off trigger: an ISO datetime string. Fires a single time when the
   * wall clock reaches that minute, then never again. Takes precedence over
   * `cron` when both are present.
   */
  runAt?: string
  /** Set `false` to keep the definition but stop it firing. Default `true`. */
  enabled?: boolean
}

const RANGES = {
  minute: [0, 59],
  hour: [0, 23],
  dom: [1, 31],
  month: [1, 12],
  dow: [0, 6],
} as const

/** Parse one cron field (e.g. `*​/15`, `1-5`, `0,30`) into a matcher. */
function parseField(raw: string, min: number, max: number): CronField {
  const allowed = new Set<number>()
  for (const part of raw.split(',')) {
    const [rangePart, stepPart] = part.split('/')
    const step = stepPart ? parseInt(stepPart, 10) : 1
    if (!Number.isFinite(step) || step < 1) {
      throw new Error(`Invalid cron step in "${raw}"`)
    }
    let lo: number
    let hi: number
    if (rangePart === '*' || rangePart === '') {
      lo = min
      hi = max
    } else if (rangePart!.includes('-')) {
      const [a, b] = rangePart!.split('-')
      lo = parseInt(a!, 10)
      hi = parseInt(b!, 10)
    } else {
      lo = parseInt(rangePart!, 10)
      hi = lo
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      throw new Error(`Invalid cron field "${raw}"`)
    }
    for (let n = lo; n <= hi; n += step) {
      if (n >= min && n <= max) allowed.add(n)
    }
  }
  return { min, max, match: (n) => allowed.has(n) }
}

type ParsedCron = {
  minute: CronField
  hour: CronField
  dom: CronField
  month: CronField
  dow: CronField
  /** True when BOTH day-of-month and day-of-week are restricted (not `*`). */
  domAndDowRestricted: boolean
}

/**
 * Parse a 5-field cron expression. Throws on the wrong field count or an
 * unparseable field, so a bad schedule surfaces at setup, not silently at 3am.
 */
export function parseCron(expr: string): ParsedCron {
  const fields = expr.trim().split(/\s+/)
  if (fields.length !== 5) {
    throw new Error(
      `Cron needs 5 fields "min hour dom month dow", got ${fields.length}: "${expr}"`,
    )
  }
  const [min, hour, dom, month, dow] = fields
  // Day-of-week 7 is an alias for Sunday (0); normalize before parsing.
  const dowNorm = dow!.replace(/7/g, '0')
  return {
    minute: parseField(min!, ...RANGES.minute),
    hour: parseField(hour!, ...RANGES.hour),
    dom: parseField(dom!, ...RANGES.dom),
    month: parseField(month!, ...RANGES.month),
    dow: parseField(dowNorm, ...RANGES.dow),
    domAndDowRestricted: dom !== '*' && dow !== '*',
  }
}

/** Whether a parsed cron matches a specific `Date` to the minute. */
export function cronMatchesParsed(parsed: ParsedCron, date: Date): boolean {
  if (!parsed.minute.match(date.getMinutes())) return false
  if (!parsed.hour.match(date.getHours())) return false
  if (!parsed.month.match(date.getMonth() + 1)) return false
  const domOk = parsed.dom.match(date.getDate())
  const dowOk = parsed.dow.match(date.getDay())
  // Standard cron semantics: when both day fields are restricted the match is
  // the UNION (fires if either matches); otherwise plain AND.
  return parsed.domAndDowRestricted ? domOk || dowOk : domOk && dowOk
}

/** Whether a cron expression matches a `Date` to the minute. */
export function cronMatches(expr: string, date: Date): boolean {
  return cronMatchesParsed(parseCron(expr), date)
}

/** Two dates fall in the same wall-clock minute. */
function sameMinute(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() &&
    a.getMinutes() === b.getMinutes()
  )
}

/** Whether a schedule is due to fire during the minute containing `date`. */
export function isScheduleDue(schedule: Schedule, date: Date): boolean {
  if (schedule.enabled === false) return false
  if (schedule.runAt) {
    const at = new Date(schedule.runAt)
    return !Number.isNaN(at.getTime()) && sameMinute(at, date)
  }
  if (schedule.cron) return cronMatches(schedule.cron, date)
  return false
}

/**
 * The next `Date` (to the minute) at or after `from` that `schedule` fires,
 * or `null` if it never will again (past one-off, or no match within a year).
 * Handy for a "next run" column in a schedules panel.
 */
export function nextRun(schedule: Schedule, from: Date): Date | null {
  if (schedule.enabled === false) return null
  if (schedule.runAt) {
    const at = new Date(schedule.runAt)
    if (Number.isNaN(at.getTime())) return null
    // Compare at minute granularity - a runAt in the current minute is "now".
    const floor = new Date(from)
    floor.setSeconds(0, 0)
    return at.getTime() >= floor.getTime() ? at : null
  }
  if (!schedule.cron) return null
  const parsed = parseCron(schedule.cron)
  const cursor = new Date(from)
  cursor.setSeconds(0, 0)
  // Scan minute-by-minute for up to ~366 days (527040 minutes).
  for (let i = 0; i < 527_040; i += 1) {
    if (cronMatchesParsed(parsed, cursor)) return new Date(cursor)
    cursor.setMinutes(cursor.getMinutes() + 1)
  }
  return null
}

export type SchedulerOptions = {
  /** The schedules to run. Read once per tick, so you may mutate the array. */
  schedules: ReadonlyArray<Schedule>
  /** Called when a schedule comes due. Receives the schedule + the fire time. */
  onFire: (schedule: Schedule, firedAt: Date) => void
  /**
   * Clock source, injectable for tests. Default `() => new Date()`.
   */
  now?: () => Date
  /**
   * How often to check, in ms. Default 30_000 (twice a minute) so a fire is
   * never more than ~30s late; per-minute dedupe keeps it firing once.
   */
  intervalMs?: number
}

export type Scheduler = {
  /** Begin ticking. No-op if already started. */
  start: () => void
  /** Stop ticking and clear the timer. */
  stop: () => void
  /**
   * Run one check against `at` (default now) and fire anything due. Exposed for
   * tests and for a "run due now" button; the internal tick calls this too.
   */
  tick: (at?: Date) => void
  /** Upcoming fire time per schedule id, from `at` (default now). */
  upcoming: (at?: Date) => Array<{ id: string; at: Date | null }>
}

/**
 * A client-side scheduler: ticks on an interval, fires `onFire` for every
 * schedule due in the current minute, and guarantees at most one fire per
 * schedule per minute (and exactly one, ever, for a one-off).
 */
export function createScheduler(options: SchedulerOptions): Scheduler {
  const now = options.now ?? (() => new Date())
  const intervalMs = options.intervalMs ?? 30_000
  // Per-schedule guard: the minute-key we last fired, so a twice-a-minute tick
  // (or a manual tick) never double-fires the same minute. One-offs are marked
  // done so they never fire again even across minutes.
  const lastFiredKey = new Map<string, string>()
  const oneOffDone = new Set<string>()
  let timer: ReturnType<typeof setInterval> | null = null

  const minuteKey = (d: Date) =>
    `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`

  function tick(at: Date = now()): void {
    const key = minuteKey(at)
    for (const schedule of options.schedules) {
      if (schedule.enabled === false) continue
      const oneOff = !!schedule.runAt
      if (oneOff && oneOffDone.has(schedule.id)) continue
      if (lastFiredKey.get(schedule.id) === key) continue
      if (!isScheduleDue(schedule, at)) continue
      lastFiredKey.set(schedule.id, key)
      if (oneOff) oneOffDone.add(schedule.id)
      options.onFire(schedule, at)
    }
  }

  return {
    start() {
      if (timer != null) return
      timer = setInterval(() => tick(), intervalMs)
    },
    stop() {
      if (timer != null) {
        clearInterval(timer)
        timer = null
      }
    },
    tick,
    upcoming(at: Date = now()) {
      return options.schedules.map((s) => ({ id: s.id, at: nextRun(s, at) }))
    },
  }
}

/** A few common cron expressions, for docs, presets, and pickers. */
export const CRON_PRESETS: ReadonlyArray<{ label: string; cron: string }> = [
  { label: 'Every minute', cron: '* * * * *' },
  { label: 'Every 15 minutes', cron: '*/15 * * * *' },
  { label: 'Hourly, on the hour', cron: '0 * * * *' },
  { label: 'Every weekday at 09:00', cron: '0 9 * * 1-5' },
  { label: 'Weekdays at 17:30', cron: '30 17 * * 1-5' },
  { label: 'Daily at midnight', cron: '0 0 * * *' },
  { label: 'Monday mornings at 08:00', cron: '0 8 * * 1' },
  { label: 'First of the month at 06:00', cron: '0 6 1 * *' },
]
