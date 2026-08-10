/**
 * scheduler-dependencies - the pure, framework-free core behind the Scheduler Pro
 * *event dependencies* feature (predecessor / successor links + auto-reschedule).
 * No Svelte, no DOM: just graph + date math over the native `Date`, so every rule
 * here is unit-tested directly (mirrors scheduler-model.ts in @svgrid/grid).
 *
 * A dependency links a predecessor event to a successor with one of the four
 * classic types (FS / SS / FF / SF) and an optional `lag` (minutes; negative = a
 * lead). When a predecessor moves or resizes, {@link cascade} pushes successors
 * forward just enough to keep every link legal, preserving each event's duration.
 * Cascading never pulls an event earlier - it only resolves violations forward,
 * the standard auto-schedule behaviour.
 *
 * Deliberately avoids the arg-less `new Date()` / `Date.now()` - callers pass the
 * current event times in; working-time skipping is injected as a `snapForward`
 * hook so this file needs no knowledge of shifts / business hours.
 */

/** The four dependency kinds. `FS` (finish-to-start) is the default. */
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'

/** A link from a predecessor event (`from`) to a successor (`to`). Keys are row
 *  keys (the scheduler's `getRowId`). `lag` is minutes; negative = a lead. */
export type SchedulerDependency = {
  id: string
  from: string
  to: string
  type?: DependencyType
  lag?: number
}

/** The resolved [start, end) of one event, keyed by row key in a time map. */
export type EventTimes = { start: Date; end: Date }

const MS_MIN = 60_000
/** Sub-second slack so exact-touching links (successor.start == pred.end) are legal. */
const EPS_MS = 1_000

/** Indexed view of a dependency set: successors by predecessor, predecessors by
 *  successor, and lookup by id. Built once, reused by cascade / violations. */
export type DependencyGraph = {
  deps: SchedulerDependency[]
  /** predecessor key -> outgoing links */
  succ: Map<string, SchedulerDependency[]>
  /** successor key -> incoming links */
  pred: Map<string, SchedulerDependency[]>
  byId: Map<string, SchedulerDependency>
  /** every key that appears as a `from` or `to`. */
  nodes: Set<string>
}

/** Build the adjacency indexes for `deps`. */
export function buildDependencyGraph(
  deps: ReadonlyArray<SchedulerDependency>,
): DependencyGraph {
  const succ = new Map<string, SchedulerDependency[]>()
  const pred = new Map<string, SchedulerDependency[]>()
  const byId = new Map<string, SchedulerDependency>()
  const nodes = new Set<string>()
  const list: SchedulerDependency[] = []
  for (const d of deps) {
    if (!d || !d.from || !d.to || d.from === d.to) continue // ignore malformed / self links
    list.push(d)
    byId.set(d.id, d)
    nodes.add(d.from)
    nodes.add(d.to)
    ;(succ.get(d.from) ?? succ.set(d.from, []).get(d.from)!).push(d)
    ;(pred.get(d.to) ?? pred.set(d.to, []).get(d.to)!).push(d)
  }
  return { deps: list, succ, pred, byId, nodes }
}

/**
 * Kahn topological order of the graph's nodes. Returns `{ order, cyclicIds }`:
 * `order` is a safe processing order for the acyclic part (predecessors before
 * successors); `cyclicIds` are the ids of links that could not be ordered because
 * they take part in a cycle (cascade ignores them so it can never loop).
 */
export function topoOrder(graph: DependencyGraph): { order: string[]; cyclicIds: Set<string> } {
  const indeg = new Map<string, number>()
  for (const n of graph.nodes) indeg.set(n, 0)
  for (const d of graph.deps) indeg.set(d.to, (indeg.get(d.to) ?? 0) + 1)

  const queue: string[] = []
  for (const [n, deg] of indeg) if (deg === 0) queue.push(n)
  // Stable: process in insertion order for deterministic output.
  const order: string[] = []
  const settled = new Set<string>()
  while (queue.length) {
    const n = queue.shift()!
    order.push(n)
    settled.add(n)
    for (const d of graph.succ.get(n) ?? []) {
      const deg = (indeg.get(d.to) ?? 0) - 1
      indeg.set(d.to, deg)
      if (deg === 0) queue.push(d.to)
    }
  }
  // Any node not settled sits inside (or downstream of) a cycle; links whose
  // successor never settled are the cyclic ones.
  const cyclicIds = new Set<string>()
  for (const d of graph.deps) if (!settled.has(d.to)) cyclicIds.add(d.id)
  return { order, cyclicIds }
}

/** True when `deps` contain a cycle. */
export function hasCycle(deps: ReadonlyArray<SchedulerDependency>): boolean {
  return topoOrder(buildDependencyGraph(deps)).cyclicIds.size > 0
}

/**
 * The earliest legal start for the successor of `dep`, given the predecessor's
 * resolved times and the successor's own `durationMs` (kept constant). Encodes the
 * FS / SS / FF / SF semantics plus `lag` (minutes).
 */
export function requiredStart(
  predTimes: EventTimes,
  dep: SchedulerDependency,
  successorDurationMs: number,
): Date {
  const lagMs = (dep.lag ?? 0) * MS_MIN
  const type = dep.type ?? 'FS'
  let t: number
  switch (type) {
    case 'FS':
      t = predTimes.end.getTime() + lagMs
      break
    case 'SS':
      t = predTimes.start.getTime() + lagMs
      break
    case 'FF':
      t = predTimes.end.getTime() + lagMs - successorDurationMs
      break
    case 'SF':
      t = predTimes.start.getTime() + lagMs - successorDurationMs
      break
  }
  return new Date(t)
}

/** Options for {@link cascade}. */
export type CascadeOptions = {
  /**
   * Optional working-time snap: given a proposed start, return the next start that
   * begins inside working time (the renderer supplies this from the scheduler's
   * shifts / business hours; omit for calendar-time scheduling).
   */
  snapForward?: (start: Date) => Date
}

/**
 * Forward-cascade successors so every dependency is satisfied. `times` maps row
 * key -> current [start,end] (the just-moved predecessor already carries its NEW
 * time). Processing runs in topological order, so multi-hop chains and diamonds
 * (two paths into one successor) resolve to the latest required start in a single
 * pass. Each shifted event keeps its duration. Returns ONLY the events whose times
 * changed (never the untouched ones, never the moved predecessor itself unless a
 * link also forces it). Cyclic links are ignored.
 */
export function cascade(
  times: ReadonlyMap<string, EventTimes>,
  deps: ReadonlyArray<SchedulerDependency>,
  opts: CascadeOptions = {},
): Map<string, EventTimes> {
  const graph = buildDependencyGraph(deps)
  const { order, cyclicIds } = topoOrder(graph)
  // Working copy we mutate as we walk downstream.
  const cur = new Map<string, EventTimes>()
  for (const [k, v] of times) cur.set(k, { start: v.start, end: v.end })

  const changed = new Map<string, EventTimes>()
  for (const key of order) {
    const links = graph.pred.get(key)
    if (!links || !links.length) continue
    const self = cur.get(key)
    if (!self) continue
    const durationMs = self.end.getTime() - self.start.getTime()

    let minStartMs = self.start.getTime()
    for (const dep of links) {
      if (cyclicIds.has(dep.id)) continue
      const pred = cur.get(dep.from)
      if (!pred) continue
      const req = requiredStart(pred, dep, durationMs).getTime()
      if (req > minStartMs) minStartMs = req
    }
    if (minStartMs <= self.start.getTime()) continue // already legal - never pull earlier

    let newStart = new Date(minStartMs)
    if (opts.snapForward) newStart = opts.snapForward(newStart)
    const newEnd = new Date(newStart.getTime() + durationMs)
    const next = { start: newStart, end: newEnd }
    cur.set(key, next)
    changed.set(key, next)
  }
  return changed
}

/**
 * The dependencies currently unsatisfied by `times` (successor starts too early
 * for the link). Used to paint violation-state arrows. Cyclic links are skipped.
 */
export function violations(
  times: ReadonlyMap<string, EventTimes>,
  deps: ReadonlyArray<SchedulerDependency>,
): SchedulerDependency[] {
  const graph = buildDependencyGraph(deps)
  const { cyclicIds } = topoOrder(graph)
  const out: SchedulerDependency[] = []
  for (const dep of graph.deps) {
    if (cyclicIds.has(dep.id)) continue
    const pred = times.get(dep.from)
    const succ = times.get(dep.to)
    if (!pred || !succ) continue
    const durationMs = succ.end.getTime() - succ.start.getTime()
    const req = requiredStart(pred, dep, durationMs).getTime()
    // A link on end (FF / SF) constrains the successor's end; compare that edge.
    const type = dep.type ?? 'FS'
    const actual = type === 'FF' || type === 'SF' ? succ.end.getTime() - durationMs : succ.start.getTime()
    if (actual + EPS_MS < req) out.push(dep)
  }
  return out
}
