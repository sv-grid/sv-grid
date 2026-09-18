/**
 * gantt-resources - who is booked on what, and where that exceeds what they can
 * take. Pure and framework-free, like every model in this folder.
 *
 * The question a planner asks of a Gantt is not "what is assigned" (the table
 * already says that) but "where am I over-committed". So the output is a grid:
 * one row per resource, one cell per axis column, holding how many of that
 * resource's tasks touch the column and whether that is more than its capacity.
 *
 * One definition worth stating, because a histogram that quietly means
 * something else is worse than none: a cell's `load` is **how many of that
 * resource's tasks overlap the column**, not an average and not a
 * person-hours figure. On a day-granular axis that is exactly concurrency -
 * three bars over Tuesday reads 3. On a coarser axis (weeks, months) it counts
 * everything touching the column, which reads high rather than low: a month
 * showing 4 is a month with four jobs in it, whoever they overlap.
 */
import type { SchedulerResource } from '@svgrid/grid'

/** A task as the histogram needs it: a span and who is on it. */
export type ResourceAssignment = {
  key: string
  resource: string
  start: Date
  end: Date
}

/** One column of one resource's strip. */
export type ResourceLoadCell = {
  load: number
  /** Past what this resource can take. */
  over: boolean
}

export type ResourceLoadRow = {
  id: string
  label: string
  capacity: number
  cells: ResourceLoadCell[]
  /** The busiest column, for scaling the bars and for a "peak 4" caption. */
  peak: number
}

/**
 * Sum `assignments` into a per-resource, per-column grid.
 *
 * `resources` fixes the rows and their order; pass none and the rows are every
 * resource named by an assignment, in first-seen order, so a plan that just
 * types owner names into a field still gets a histogram.
 */
export function resourceLoad(
  assignments: ReadonlyArray<ResourceAssignment>,
  columns: ReadonlyArray<{ start: Date; end: Date }>,
  opts: {
    resources?: ReadonlyArray<SchedulerResource> | null
    /** A resource's capacity; anything above it is an over-allocation. */
    capacityOf?: (id: string) => number
  } = {},
): ResourceLoadRow[] {
  const capacityOf = opts.capacityOf ?? (() => 1)

  const order: string[] = []
  const labels = new Map<string, string>()
  if (opts.resources?.length) {
    for (const r of opts.resources) {
      const id = String(r.id)
      if (labels.has(id)) continue
      order.push(id)
      labels.set(id, r.title ?? id)
    }
  } else {
    for (const a of assignments) {
      if (labels.has(a.resource)) continue
      order.push(a.resource)
      labels.set(a.resource, a.resource)
    }
  }

  // Bucket the assignments by resource once, so the column scan below is
  // O(columns x that resource's tasks) rather than O(columns x every task).
  const byResource = new Map<string, ResourceAssignment[]>()
  for (const a of assignments) {
    if (!labels.has(a.resource)) continue
    if (a.end.getTime() <= a.start.getTime()) continue
    const list = byResource.get(a.resource)
    if (list) list.push(a)
    else byResource.set(a.resource, [a])
  }

  const rows: ResourceLoadRow[] = []
  for (const id of order) {
    const mine = byResource.get(id) ?? []
    const capacity = Math.max(1, capacityOf(id))
    const cells: ResourceLoadCell[] = []
    let peak = 0
    for (const col of columns) {
      const from = col.start.getTime()
      const to = col.end.getTime()
      let load = 0
      for (const a of mine) {
        if (a.start.getTime() < to && a.end.getTime() > from) load++
      }
      if (load > peak) peak = load
      cells.push({ load, over: load > capacity })
    }
    rows.push({ id, label: labels.get(id) ?? id, capacity, cells, peak })
  }
  return rows
}

/**
 * The resource ids that are over capacity somewhere, for a toolbar count or a
 * warning badge. Order follows {@link resourceLoad}'s rows.
 */
export function overallocations(rows: ReadonlyArray<ResourceLoadRow>): string[] {
  return rows.filter((r) => r.cells.some((c) => c.over)).map((r) => r.id)
}
