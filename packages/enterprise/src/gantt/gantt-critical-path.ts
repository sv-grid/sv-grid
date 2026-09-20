/**
 * gantt-critical-path - the critical path method (CPM) over a Gantt's tasks and
 * their dependency links. Pure and framework-free, like every model in this
 * package: a map of task times in, slack and the critical set out.
 *
 * Two passes over the dependency graph in topological order:
 *
 *   - **Forward** gives each task its EARLIEST start and finish: the later of
 *     its own start and whatever its predecessors allow.
 *   - **Backward** gives each task its LATEST start and finish: the earliest of
 *     the project finish and whatever its successors need.
 *
 * `slack` is the gap between the two. A task with none cannot slip by a day
 * without moving the project's finish, and the chain of those tasks is the
 * critical path.
 *
 * Two rules worth stating, because both are judgement calls rather than
 * arithmetic:
 *
 *  1. **An unlinked task is never critical.** A task in no dependency at all
 *     is not on any path, so calling it critical would point at something the
 *     schedule does not actually depend on. It still gets a slack figure - the
 *     room it has before the project finish - for a Slack column to show.
 *  2. **Cyclic links are ignored**, exactly as `cascade` ignores them: a cycle
 *     has no legal schedule, so there is no earliest or latest to compute
 *     through it.
 *
 * With a {@link WorkingCalendar} the passes run in WORKING time: a task's
 * length is its working days, a latest start is counted back over working
 * days, and slack is the working days a task could slip. Without one they
 * run in calendar time, which is what a plan with no weekends is. The
 * difference is not cosmetic: a five-day task ending Friday whose successor
 * starts Monday has two calendar days of slack and none at all in working
 * time - it is critical, and only the working-time pass says so.
 *
 * Nothing here reads the clock.
 */
import {
  buildDependencyGraph,
  requiredStart,
  topoOrder,
  type EventTimes,
  type SchedulerDependency,
} from '../scheduler-dependencies'
import {
  moveWorkingSpan,
  snapToWorkingDay,
  startForWorkingDays,
  workingDays,
  type WorkingCalendar,
} from './gantt-model'

const MS_MIN = 60_000
const MS_DAY = 86_400_000
/** Below this, a slack is rounding noise rather than real room. */
const CRITICAL_EPS_MS = MS_MIN

export type CpmResult = {
  /** Keys with no slack, and at least one link. See rule 1 in the header. */
  critical: Set<string>
  /** Room each task has before it would move the project finish, in calendar ms. */
  slackMs: Map<string, number>
  /**
   * The same room in whole days: WORKING days when the pass was given a
   * calendar, calendar days otherwise. The number a Slack column shows.
   */
  slackDays: Map<string, number>
  earliest: Map<string, EventTimes>
  latest: Map<string, EventTimes>
  /** The earliest the whole project can finish. */
  finish: Date
}

/**
 * The arithmetic one pass runs on: how long a task is, what a link requires
 * of its successor's start and allows of its predecessor's finish, and how a
 * start and an end trade for each other. Calendar time or working time.
 */
type Arith = {
  reqStart: (pred: EventTimes, dep: SchedulerDependency, self: EventTimes) => Date
  capFinish: (succ: EventTimes, dep: SchedulerDependency, self: EventTimes) => Date
  endOf: (start: Date, self: EventTimes) => Date
  startOf: (end: Date, self: EventTimes) => Date
  slackDays: (es: Date, ls: Date) => number
  isCritical: (es: Date, ls: Date) => boolean
}

const durMs = (t: EventTimes) => Math.max(0, t.end.getTime() - t.start.getTime())

const calendarArith: Arith = {
  reqStart: (pred, dep, self) => requiredStart(pred, dep, durMs(self)),
  capFinish: (succ, dep, self) => latestPredecessorFinish(succ, dep, durMs(self)),
  endOf: (start, self) => new Date(start.getTime() + durMs(self)),
  startOf: (end, self) => new Date(end.getTime() - durMs(self)),
  slackDays: (es, ls) => Math.trunc((ls.getTime() - es.getTime()) / MS_DAY),
  isCritical: (es, ls) => ls.getTime() - es.getTime() < CRITICAL_EPS_MS,
}

function workingArith(cal: WorkingCalendar): Arith {
  const endOf = (start: Date, self: EventTimes) => moveWorkingSpan(start, self, cal).end
  const startOf = (end: Date, self: EventTimes) => {
    const days = workingDays(self.start, self.end, cal)
    return days > 0 ? startForWorkingDays(end, days, cal) : new Date(end.getTime() - durMs(self))
  }
  const lagOf = (dep: SchedulerDependency) => (dep.lag ?? 0) * MS_MIN
  const snap = (d: Date) => snapToWorkingDay(d, 1, cal)
  return {
    // What a link asks of the successor, landed on a working day - the same
    // snap the cascade applies to a pushed task.
    reqStart: (pred, dep, self) => {
      const lag = lagOf(dep)
      switch (dep.type ?? 'FS') {
        case 'FS': return snap(new Date(pred.end.getTime() + lag))
        case 'SS': return snap(new Date(pred.start.getTime() + lag))
        case 'FF': return snap(startOf(new Date(pred.end.getTime() + lag), self))
        case 'SF': return snap(startOf(new Date(pred.start.getTime() + lag), self))
      }
    },
    // What a link allows of the predecessor's finish. An end that lands after
    // a weekend is fine as it is: counting the start back over working days
    // skips the weekend, so nothing has to be snapped here.
    capFinish: (succ, dep, self) => {
      const lag = lagOf(dep)
      switch (dep.type ?? 'FS') {
        case 'FS': return new Date(succ.start.getTime() - lag)
        case 'SS': return endOf(new Date(succ.start.getTime() - lag), self)
        case 'FF': return new Date(succ.end.getTime() - lag)
        case 'SF': return endOf(new Date(succ.end.getTime() - lag), self)
      }
    },
    endOf,
    startOf,
    slackDays: (es, ls) => (ls.getTime() > es.getTime() ? workingDays(es, ls, cal) : 0),
    // No working day between the earliest and latest start: it cannot slip.
    isCritical: (es, ls) => ls.getTime() <= es.getTime() || workingDays(es, ls, cal) === 0,
  }
}

/**
 * The LATEST finish a predecessor may have, given what its successor's latest
 * times allow. The mirror of {@link requiredStart}, which answers the same
 * question forwards.
 */
function latestPredecessorFinish(
  succLatest: EventTimes,
  dep: SchedulerDependency,
  predDurationMs: number,
): Date {
  const lagMs = (dep.lag ?? 0) * MS_MIN
  switch (dep.type ?? 'FS') {
    // succ.start >= pred.end + lag  ->  pred.end <= succ.start - lag
    case 'FS':
      return new Date(succLatest.start.getTime() - lagMs)
    // succ.start >= pred.start + lag  ->  pred.start <= succ.start - lag
    case 'SS':
      return new Date(succLatest.start.getTime() - lagMs + predDurationMs)
    // succ.end >= pred.end + lag  ->  pred.end <= succ.end - lag
    case 'FF':
      return new Date(succLatest.end.getTime() - lagMs)
    // succ.end >= pred.start + lag  ->  pred.start <= succ.end - lag
    case 'SF':
      return new Date(succLatest.end.getTime() - lagMs + predDurationMs)
  }
}

/**
 * Run the two passes. `times` is every task the plan draws, keyed by row key -
 * for a parent, pass the span its summary bar shows, so a link to a phase means
 * "after the whole phase" without any special case here. Give `cal` for a
 * working-time pass (see the header); omit it for calendar time.
 */
export function criticalPath(
  times: ReadonlyMap<string, EventTimes>,
  deps: ReadonlyArray<SchedulerDependency>,
  cal?: WorkingCalendar,
): CpmResult {
  const arith = cal ? workingArith(cal) : calendarArith
  const graph = buildDependencyGraph(deps)
  const { order, cyclicIds } = topoOrder(graph)
  const live = graph.deps.filter((d) => !cyclicIds.has(d.id))
  /** Keys that take part in at least one usable link. */
  const linked = new Set<string>()
  for (const d of live) {
    if (times.has(d.from) && times.has(d.to)) {
      linked.add(d.from)
      linked.add(d.to)
    }
  }

  // --- forward: earliest start / finish ------------------------------------
  const earliest = new Map<string, EventTimes>()
  for (const [k, t] of times) earliest.set(k, { start: t.start, end: t.end })
  // Only the graph's nodes need relaxing, and only in topological order; a key
  // outside the graph keeps its own dates.
  for (const key of order) {
    const self = times.get(key)
    if (!self) continue
    let es = self.start
    for (const dep of graph.pred.get(key) ?? []) {
      if (cyclicIds.has(dep.id)) continue
      const pred = earliest.get(dep.from)
      if (!pred) continue
      const req = arith.reqStart(pred, dep, self)
      if (req.getTime() > es.getTime()) es = req
    }
    earliest.set(key, { start: es, end: arith.endOf(es, self) })
  }

  // The project finishes when its last task does.
  let finishMs = -Infinity
  for (const t of earliest.values()) finishMs = Math.max(finishMs, t.end.getTime())
  if (!Number.isFinite(finishMs)) finishMs = 0
  const finish = new Date(finishMs)

  // --- backward: latest start / finish --------------------------------------
  const latest = new Map<string, EventTimes>()
  for (const [k, self] of times) {
    latest.set(k, { start: arith.startOf(finish, self), end: finish })
  }
  for (let i = order.length - 1; i >= 0; i--) {
    const key = order[i]!
    const self = times.get(key)
    if (!self) continue
    let lf = finish
    for (const dep of graph.succ.get(key) ?? []) {
      if (cyclicIds.has(dep.id)) continue
      const succ = latest.get(dep.to)
      if (!succ) continue
      const cap = arith.capFinish(succ, dep, self)
      if (cap.getTime() < lf.getTime()) lf = cap
    }
    latest.set(key, { start: arith.startOf(lf, self), end: lf })
  }

  // --- slack ----------------------------------------------------------------
  const slackMs = new Map<string, number>()
  const slackDaysOf = new Map<string, number>()
  const critical = new Set<string>()
  for (const [k] of times) {
    const e = earliest.get(k)!
    const l = latest.get(k)!
    slackMs.set(k, l.start.getTime() - e.start.getTime())
    slackDaysOf.set(k, arith.slackDays(e.start, l.start))
    if (linked.has(k) && arith.isCritical(e.start, l.start)) critical.add(k)
  }
  return { critical, slackMs, slackDays: slackDaysOf, earliest, latest, finish }
}

/**
 * A task's slack in whole days, for a table column: working days when the
 * pass ran with a calendar, calendar days otherwise. Rounds toward zero, so
 * "2" means two full days of room rather than anything up to three.
 */
export function slackDays(result: CpmResult, key: string): number {
  return result.slackDays.get(key) ?? 0
}
