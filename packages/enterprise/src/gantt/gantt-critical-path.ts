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
 * Nothing here reads the clock.
 */
import {
  buildDependencyGraph,
  requiredStart,
  topoOrder,
  type EventTimes,
  type SchedulerDependency,
} from '../scheduler-dependencies'

const MS_MIN = 60_000
/** Below this, a slack is rounding noise rather than real room. */
const CRITICAL_EPS_MS = MS_MIN

export type CpmResult = {
  /** Keys with no slack, and at least one link. See rule 1 in the header. */
  critical: Set<string>
  /** Room each task has before it would move the project finish, in ms. */
  slackMs: Map<string, number>
  earliest: Map<string, EventTimes>
  latest: Map<string, EventTimes>
  /** The earliest the whole project can finish. */
  finish: Date
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
 * "after the whole phase" without any special case here.
 */
export function criticalPath(
  times: ReadonlyMap<string, EventTimes>,
  deps: ReadonlyArray<SchedulerDependency>,
): CpmResult {
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

  const durationOf = (k: string) => {
    const t = times.get(k)
    return t ? Math.max(0, t.end.getTime() - t.start.getTime()) : 0
  }

  // --- forward: earliest start / finish ------------------------------------
  const earliest = new Map<string, EventTimes>()
  for (const [k, t] of times) earliest.set(k, { start: t.start, end: t.end })
  // Only the graph's nodes need relaxing, and only in topological order; a key
  // outside the graph keeps its own dates.
  for (const key of order) {
    if (!times.has(key)) continue
    const self = earliest.get(key)!
    const dur = durationOf(key)
    let es = self.start.getTime()
    for (const dep of graph.pred.get(key) ?? []) {
      if (cyclicIds.has(dep.id)) continue
      const pred = earliest.get(dep.from)
      if (!pred) continue
      const req = requiredStart(pred, dep, dur).getTime()
      if (req > es) es = req
    }
    earliest.set(key, { start: new Date(es), end: new Date(es + dur) })
  }

  // The project finishes when its last task does.
  let finishMs = -Infinity
  for (const t of earliest.values()) finishMs = Math.max(finishMs, t.end.getTime())
  if (!Number.isFinite(finishMs)) finishMs = 0
  const finish = new Date(finishMs)

  // --- backward: latest start / finish --------------------------------------
  const latest = new Map<string, EventTimes>()
  for (const [k] of times) {
    const dur = durationOf(k)
    latest.set(k, { start: new Date(finishMs - dur), end: finish })
  }
  for (let i = order.length - 1; i >= 0; i--) {
    const key = order[i]!
    if (!times.has(key)) continue
    const dur = durationOf(key)
    let lf = finishMs
    for (const dep of graph.succ.get(key) ?? []) {
      if (cyclicIds.has(dep.id)) continue
      const succ = latest.get(dep.to)
      if (!succ) continue
      const cap = latestPredecessorFinish(succ, dep, dur).getTime()
      if (cap < lf) lf = cap
    }
    latest.set(key, { start: new Date(lf - dur), end: new Date(lf) })
  }

  // --- slack ----------------------------------------------------------------
  const slackMs = new Map<string, number>()
  const critical = new Set<string>()
  for (const [k] of times) {
    const e = earliest.get(k)!
    const l = latest.get(k)!
    const slack = l.start.getTime() - e.start.getTime()
    slackMs.set(k, slack)
    if (linked.has(k) && slack < CRITICAL_EPS_MS) critical.add(k)
  }
  return { critical, slackMs, earliest, latest, finish }
}

/**
 * A task's slack in whole days, for a table column. Rounds toward zero, so
 * "2" means two full days of room rather than anything up to three.
 */
export function slackDays(result: CpmResult, key: string): number {
  const ms = result.slackMs.get(key)
  if (ms == null) return 0
  return Math.trunc(ms / 86_400_000)
}
