/**
 * Server-side GROUP row model (SSRM grouping) - the first-class
 * companion to `createServerDataSource`. Grouping, aggregation, and lazy
 * expansion all flow through the SAME `ServerDataSource.getRows` contract:
 *
 *   - The request carries `groupBy` (the columns grouped on) and `groupKeys`
 *     (the path of the group being expanded). While `groupKeys.length <
 *     groupBy.length` the server returns GROUP rows (one per distinct key at
 *     that level, carrying the key + aggregate values); at the bottom level it
 *     returns the leaf rows under that path.
 *   - Expanding a group is just another `getRows` with `groupKeys` set to that
 *     group's path. This controller owns the group tree: expand / collapse,
 *     per-node lazy fetch + cache, race-safety, and flattening to a display
 *     list the grid renders (group rows with an expander, leaves underneath).
 *
 * Headless and framework-agnostic on purpose: render from `state.displayRows`
 * and call `toggleGroup` from the group cell's expander.
 */
import type {
  ServerAggregation,
  ServerDataSource,
  ServerDisplayRow,
  ServerFilterModel,
  ServerGroupRow,
  ServerSortModel,
} from './server-data-source'

export type ServerGroupState<TData> = {
  /** The flattened tree: top-level groups, with expanded groups' children spliced in. */
  displayRows: ServerDisplayRow<TData>[]
  groupBy: string[]
  /** True during the initial top-level fetch (before the root has ever loaded). */
  loading: boolean
  /** The rejection from the last failed top-level fetch, else null. */
  error: unknown
  sortModel: ServerSortModel
  filterModel: ServerFilterModel
  /** Ids (JSON of the path) of the currently expanded groups. */
  expandedGroups: string[]
}

export type ServerGroupControllerOptions<TData> = {
  /** Columns to group on, outer to inner. Empty in `treeData` mode. */
  groupBy?: string[]
  /** Value columns to roll up per group. */
  aggregations?: ServerAggregation[]
  /** Max children fetched per group in one request. Default 200. */
  pageSize?: number
  /**
   * Self-referential tree mode: instead of grouping flat rows by columns, each
   * row is a node whose children are fetched on expand. Requires `getRowId`
   * (the node id, which builds the `groupKeys` path) and `hasChildren` (whether
   * a node is expandable). `getRows` receives `groupKeys` = the path to the
   * node being expanded, and returns that node's direct children.
   */
  treeData?: boolean
  /** Node id, used to build the `groupKeys` path. Required in `treeData` mode. */
  getRowId?: (row: TData) => string
  /** Whether a node can be expanded. Required in `treeData` mode. */
  hasChildren?: (row: TData) => boolean
  /** Emit a subtotal "footer" row after each expanded group's children. */
  groupFooters?: boolean
  /** Placeholder rows shown while a group's first block is loading. Default 3. */
  skeletonRows?: number
  onChange: (state: ServerGroupState<TData>) => void
}

export type ServerGroupController<TData> = {
  /** (Re-)fetch the tree from the top. Call once to load the first level. */
  refresh(): void
  setSort(sortModel: ServerSortModel): void
  setFilter(filterModel: ServerFilterModel): void
  /** Change the grouping columns. Collapses everything and reloads the top level. */
  setGroupBy(groupBy: string[]): void
  /** Expand or collapse a group row (from its expander). */
  toggleGroup(row: ServerGroupRow<TData>): void
  expandGroup(path: string[]): void
  collapseGroup(path: string[]): void
  /** Fetch the next block of a group's children (intra-group paging). */
  loadMoreChildren(path: string[]): void
  isExpanded(path: string[]): boolean
  getState(): ServerGroupState<TData>
  /** Stop accepting in-flight responses. Call on unmount. */
  dispose(): void
}

/**
 * Map a `ServerGroupState.displayRows` to grid rows: each row's data spread at
 * the top level (so normal `field` columns show group subtotals on group rows
 * and cell values on leaves) plus a `__group` marker the built-in `SvGroupCell`
 * reads to draw the expander + indentation. Feed the result to `<SvGrid data>`.
 */
export type ServerGroupGridRow<TData> = TData & { __group: ServerDisplayRow<TData> }
export function serverGroupRows<TData>(
  state: ServerGroupState<TData> | undefined | null,
): ServerGroupGridRow<TData>[] {
  return (state?.displayRows ?? []).map(
    (r) => ({ ...('data' in r ? (r.data as object) : {}), __group: r }) as ServerGroupGridRow<TData>,
  )
}

/**
 * Build the `serverGroup` prop for `<SvGrid>` from a controller, so the grid's
 * built-in tree keyboard (ArrowRight / ArrowLeft expand / collapse) and treegrid
 * a11y work with no app-level key handling. Reads the `__group` marker that
 * `serverGroupRows` attaches. Usage: `<SvGrid ... serverGroup={serverGroupNav(ctl)} />`.
 */
export function serverGroupNav<TData>(ctl: ServerGroupController<TData>) {
  return {
    isGroup: (row: ServerGroupGridRow<TData>) => row.__group?.kind === 'group',
    level: (row: ServerGroupGridRow<TData>) => row.__group?.level ?? 0,
    expanded: (row: ServerGroupGridRow<TData>) =>
      row.__group?.kind === 'group' ? row.__group.expanded : false,
    onToggle: (row: ServerGroupGridRow<TData>) => {
      if (row.__group?.kind === 'group') ctl.toggleGroup(row.__group)
      else if (row.__group?.kind === 'more') ctl.loadMoreChildren(row.__group.path)
    },
  }
}

const keyOf = (path: string[]): string => JSON.stringify(path)

type ChildDescriptor<TData> =
  | { kind: 'group'; path: string[]; field: string; key: string; level: number; aggregates: Record<string, unknown>; data: TData }
  | { kind: 'leaf'; id: string; level: number; data: TData }

type GroupNode<TData> = {
  loaded: boolean
  loading: boolean
  error: unknown
  count: number
  children: ChildDescriptor<TData>[]
}

export function createServerGroupModel<TData>(
  source: ServerDataSource<TData>,
  options: ServerGroupControllerOptions<TData>,
): ServerGroupController<TData> {
  let groupBy = [...(options.groupBy ?? [])]
  const aggregations = options.aggregations ?? []
  const pageSize = options.pageSize ?? 200
  const treeData = !!options.treeData
  if (treeData && (!options.getRowId || !options.hasChildren)) {
    throw new Error('createServerGroupModel: treeData requires getRowId and hasChildren')
  }
  const getRowId = options.getRowId
  const hasChildren = options.hasChildren
  const groupFooters = !!options.groupFooters
  const skeletonRows = Math.max(0, options.skeletonRows ?? 3)

  let sortModel: ServerSortModel = []
  let filterModel: ServerFilterModel = {}
  const nodes = new Map<string, GroupNode<TData>>()
  const expanded = new Set<string>() // path keys
  // Generation guard: bumped on any tree reset so every fetch in flight for the
  // previous shape is discarded when it lands (the classic stale-response bug).
  let generation = 0
  let disposed = false

  const rootKey = keyOf([])

  function ensureNode(key: string): GroupNode<TData> {
    let node = nodes.get(key)
    if (!node) {
      node = { loaded: false, loading: false, error: null, count: 0, children: [] }
      nodes.set(key, node)
    }
    return node
  }

  // Walk the loaded tree from the root, splicing expanded groups' children in.
  function flatten(): ServerDisplayRow<TData>[] {
    const out: ServerDisplayRow<TData>[] = []
    const walk = (path: string[]): void => {
      const node = nodes.get(keyOf(path))
      if (!node?.loaded) return
      for (const child of node.children) {
        if (child.kind === 'leaf') {
          out.push({ kind: 'leaf', id: child.id, level: child.level, data: child.data })
          continue
        }
        const cid = keyOf(child.path)
        const cnode = nodes.get(cid)
        const isExp = expanded.has(cid)
        out.push({
          kind: 'group',
          id: cid,
          path: child.path,
          field: child.field,
          key: child.key,
          level: child.level,
          expanded: isExp,
          loading: !!cnode?.loading,
          aggregates: child.aggregates,
          data: child.data,
        })
        if (isExp) {
          if (cnode?.loaded) {
            walk(child.path)
            // Subtotal row after the group's children.
            if (groupFooters) {
              out.push({
                kind: 'footer',
                id: cid + 'footer',
                level: child.level + 1,
                path: child.path,
                key: child.key,
                aggregates: child.aggregates,
                data: child.data,
              })
            }
          } else if (cnode?.loading) {
            // First block in flight: placeholder skeleton rows.
            for (let i = 0; i < skeletonRows; i += 1) {
              out.push({ kind: 'skeleton', id: cid + 'sk' + i, level: child.level + 1 })
            }
          }
        }
      }
      // Intra-group paging: emit a "load more" affordance when only part of this
      // node's children have been fetched.
      if (node.children.length < node.count) {
        out.push({
          kind: 'more',
          id: keyOf([...path, 'more']),
          level: path.length,
          path,
          remaining: node.count - node.children.length,
          loading: node.loading,
        })
      }
    }
    walk([])
    return out
  }

  function emit(): void {
    if (disposed) return
    const root = nodes.get(rootKey)
    options.onChange({
      displayRows: flatten(),
      groupBy: [...groupBy],
      loading: !!root?.loading && !root?.loaded,
      error: root?.error ?? null,
      sortModel,
      filterModel,
      expandedGroups: [...expanded],
    })
  }

  // append=false loads the first block of a node's children (on expand);
  // append=true fetches the NEXT block and concatenates (intra-group paging).
  async function fetchNode(path: string[], append = false): Promise<void> {
    if (disposed) return
    const gen = generation
    const key = keyOf(path)
    const node = ensureNode(key)
    if (node.loading) return // a fetch for this node is already in flight
    node.loading = true
    node.error = null
    emit()
    const level = path.length
    const groupField = groupBy[level]
    const startRow = append ? node.children.length : 0
    try {
      const res = await source.getRows({
        startRow,
        endRow: startRow + pageSize,
        pageIndex: Math.floor(startRow / pageSize),
        pageSize,
        sortModel,
        filterModel,
        groupBy,
        groupKeys: path,
        aggregations,
      })
      if (disposed || gen !== generation) return // stale: the tree was reset
      node.count = res.rowCount
      const block = res.rows.map((data, i): ChildDescriptor<TData> => {
        // A row is an expandable "group" when: (tree mode) the source says it has
        // children, or (grouping mode) we are above the innermost groupBy level.
        const isGroup = treeData ? hasChildren!(data) : level < groupBy.length
        if (isGroup) {
          const gk = treeData
            ? getRowId!(data)
            : ((v) => (v == null ? '' : String(v)))((data as Record<string, unknown>)[groupField!])
          const aggregates: Record<string, unknown> = {}
          for (const a of aggregations) aggregates[a.col] = (data as Record<string, unknown>)[a.col]
          return { kind: 'group', path: [...path, gk], field: treeData ? '' : groupField!, key: gk, level, aggregates, data }
        }
        const id = treeData && getRowId ? `${key}:${getRowId(data)}` : `${key}:${startRow + i}`
        return { kind: 'leaf', id, level, data }
      })
      node.children = append ? [...node.children, ...block] : block
      node.loaded = true
      node.loading = false
      emit()
    } catch (err) {
      if (disposed || gen !== generation) return
      node.error = err
      if (!append) node.loaded = false
      node.loading = false
      emit()
    }
  }

  // Clear the cache and reload the root plus any still-expanded paths (in
  // parallel; flatten only descends into loaded nodes, so children appear as
  // each level lands).
  function resetTree(): void {
    generation += 1
    nodes.clear()
    void fetchNode([])
    for (const k of expanded) void fetchNode(JSON.parse(k) as string[])
  }

  function expandGroup(path: string[]): void {
    const key = keyOf(path)
    if (expanded.has(key)) return
    expanded.add(key)
    const node = nodes.get(key)
    if (!node?.loaded && !node?.loading) void fetchNode(path)
    else emit()
  }

  function collapseGroup(path: string[]): void {
    if (expanded.delete(keyOf(path))) emit()
  }

  return {
    refresh: resetTree,
    setSort(next) {
      sortModel = next
      resetTree()
    },
    setFilter(next) {
      filterModel = next
      resetTree()
    },
    setGroupBy(next) {
      groupBy = [...next]
      expanded.clear()
      resetTree()
    },
    toggleGroup(row) {
      if (expanded.has(row.id)) collapseGroup(row.path)
      else expandGroup(row.path)
    },
    expandGroup,
    collapseGroup,
    loadMoreChildren: (path) => void fetchNode(path, true),
    isExpanded: (path) => expanded.has(keyOf(path)),
    getState() {
      const root = nodes.get(rootKey)
      return {
        displayRows: flatten(),
        groupBy: [...groupBy],
        loading: !!root?.loading && !root?.loaded,
        error: root?.error ?? null,
        sortModel,
        filterModel,
        expandedGroups: [...expanded],
      }
    },
    dispose() {
      disposed = true
      generation += 1
    },
  }
}
