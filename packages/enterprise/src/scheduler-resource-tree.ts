/**
 * scheduler-resource-tree - the pure core behind Scheduler Pro *grouped / tree
 * resources*. No Svelte, no DOM. Resources are flat in the base grid; this builds
 * a hierarchy of collapsible GROUP header rows (departments -> teams -> people)
 * interleaved with the resource rows, so the timeline gutter can render a tree.
 *
 * Groups nest via `parentId`; each resource is mapped to a group by a `groupOf`
 * accessor. Resources whose group is unknown / unset fall into a trailing
 * "ungrouped" section (rendered without a header). Collapsing a group drops its
 * whole subtree from the output (the header stays).
 */

/** A group node in the resource tree. `parentId` nests it under another group. */
export type SchedulerResourceGroup = {
  id: string
  title: string
  parentId?: string
  color?: string
}

/** One rendered row: a group header, or a leaf resource. */
export type ResourceRow<R = unknown> = {
  kind: 'group' | 'resource'
  id: string
  title: string
  /** Indent depth (0 = top level). */
  depth: number
  color?: string
  /** Present for `kind: 'resource'`. */
  resource?: R
  /** Present for `kind: 'group'`: whether it is collapsed. */
  collapsed?: boolean
  /** Present for `kind: 'group'`: every leaf resource id in its subtree (for roll-ups). */
  childResourceIds?: string[]
}

type MinResource = { id: string; title?: string; color?: string }

/**
 * Build the ordered tree rows. `groups` define the hierarchy; `groupOf(resource)`
 * returns the group id a resource belongs to (or undefined = ungrouped). `collapsed`
 * is the set of collapsed group ids. Order: for each group, its child groups
 * (recursively) then its direct resources; ungrouped resources trail at the end.
 */
export function buildResourceRows<R extends MinResource>(
  resources: ReadonlyArray<R>,
  groups: ReadonlyArray<SchedulerResourceGroup>,
  groupOf: (r: R) => string | undefined,
  collapsed: ReadonlySet<string> = new Set(),
): ResourceRow<R>[] {
  const groupById = new Map<string, SchedulerResourceGroup>()
  for (const g of groups) if (g && g.id) groupById.set(g.id, g)

  // parentId -> child groups (root groups keyed under '' ). A parentId that is not
  // a known group is treated as a root.
  const childGroups = new Map<string, SchedulerResourceGroup[]>()
  for (const g of groupById.values()) {
    const p = g.parentId && groupById.has(g.parentId) ? g.parentId : ''
    ;(childGroups.get(p) ?? childGroups.set(p, []).get(p)!).push(g)
  }

  // group id -> resources ('' = ungrouped / unknown group).
  const resByGroup = new Map<string, R[]>()
  for (const r of resources) {
    const gid = groupOf(r)
    const key = gid && groupById.has(gid) ? gid : ''
    ;(resByGroup.get(key) ?? resByGroup.set(key, []).get(key)!).push(r)
  }

  // Every leaf resource id under a group's subtree (recursive), for roll-ups.
  const leafSeen = new Set<string>()
  const leafIds = (gid: string): string[] => {
    if (leafSeen.has(gid)) return [] // cycle guard
    leafSeen.add(gid)
    const ids: string[] = []
    for (const r of resByGroup.get(gid) ?? []) ids.push(r.id)
    for (const cg of childGroups.get(gid) ?? []) ids.push(...leafIds(cg.id))
    leafSeen.delete(gid)
    return ids
  }

  const out: ResourceRow<R>[] = []
  const walked = new Set<string>()
  const walk = (g: SchedulerResourceGroup, depth: number): void => {
    if (walked.has(g.id)) return // cycle guard
    walked.add(g.id)
    const isCollapsed = collapsed.has(g.id)
    out.push({ kind: 'group', id: g.id, title: g.title, depth, color: g.color, collapsed: isCollapsed, childResourceIds: leafIds(g.id) })
    if (isCollapsed) return
    for (const cg of childGroups.get(g.id) ?? []) walk(cg, depth + 1)
    for (const r of resByGroup.get(g.id) ?? []) {
      out.push({ kind: 'resource', id: r.id, title: r.title ?? r.id, depth: depth + 1, color: r.color, resource: r })
    }
  }

  for (const g of childGroups.get('') ?? []) walk(g, 0)
  // Ungrouped resources trail at the end (no header).
  for (const r of resByGroup.get('') ?? []) {
    out.push({ kind: 'resource', id: r.id, title: r.title ?? r.id, depth: 0, color: r.color, resource: r })
  }
  return out
}

/** The leaf resource ids actually visible (resource rows only) in tree order. */
export function visibleResourceIds<R extends MinResource>(rows: ReadonlyArray<ResourceRow<R>>): string[] {
  return rows.filter((r) => r.kind === 'resource').map((r) => r.id)
}
