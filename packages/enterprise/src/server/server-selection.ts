/**
 * Selection across rows that were never loaded.
 *
 * A grid that keeps a list of selected ids is right until the rows it has
 * seen are a window onto a million on a server. Then "select all" has to mean
 * a million, the header checkbox has to say so, and a bulk edit has to reach
 * rows that never came down the wire. None of that fits a list of ids. It
 * fits a RULE: "everything, except these" - which is what this model stores.
 *
 * Two shapes, chosen by `groupSelects`:
 *
 * - `self`: one flat rule. `{ selectAll, toggled }` - toggled ids are the
 *   exceptions to `selectAll`, whatever level they sit on. A group row is a
 *   row like any other.
 * - `descendants`: a tree of rules. Ticking a group selects everything under
 *   it, and an exception inside that group is recorded under that group, so
 *   the state reads like the tree it describes:
 *   `{ selectAllChildren: true, toggled: { EMEA: { selectAllChildren: false, toggled: { DE: { selectAllChildren: true } } } } }`
 *   means "everything, except EMEA, except DE within it".
 *
 * The shapes are plain data (`getState()` / `setState()`), so a selection
 * survives a page reload or travels to a bulk-edit endpoint as "apply to
 * these rules". Headless and framework-free; the row model wires it to the
 * grid's `rowSelectionModel` seam and re-renders on `onChange`.
 */

/** How ticking a group row behaves: itself, or everything beneath it. */
export type ServerSelectionGroupMode = 'self' | 'descendants' | 'filteredDescendants'

/** The flat rule, for `groupSelects: 'self'`. */
export type ServerSelectionState = {
  selectAll: boolean
  /** Exceptions to `selectAll`: selected ids when it is false, deselected ones when true. */
  toggled: string[]
}

/** One node of the hierarchical rule, for `groupSelects: 'descendants'`. */
export type ServerGroupSelectionNode = {
  /** Whether everything under this node is selected, before exceptions. */
  selectAllChildren: boolean
  /** Exceptions, keyed by child id (a group key or a leaf id) under this node. */
  toggled: Record<string, ServerGroupSelectionNode>
  /**
   * True when this node is a group. A flipped group is an exception of
   * unknown size (its rows were never counted here); a flipped leaf is
   * exactly one row. Absent on the root and on leaves.
   */
  group?: boolean
}

/** What `createServerSelectionModel` takes: the group mode and a change callback. */
export type ServerSelectionModelOptions = {
  /**
   * How ticking a group row behaves. `self` selects that one row;
   * `descendants` selects everything beneath it. `filteredDescendants` is
   * `descendants` under a filter, which on a server is the same rule - the
   * server applies the filter - so it is accepted as an alias.
   */
  groupSelects?: ServerSelectionGroupMode
  /** Called after any change. The row model re-renders from here. */
  onChange?: () => void
  /**
   * How many leaves sit under a group, by its route, or `null` when that is
   * not known. `selectedCount` needs it once a rule flips a whole group
   * (a plan ticked under an unticked root): without it the count of such a
   * rule is unknown. The row model answers from the group row's `count`
   * aggregate.
   */
  leafCount?: (route: ReadonlyArray<string>) => number | null
}

/** A selection kept as a rule - "everything, except these" - flat or per group, that the row model exposes to the grid. */
export type ServerSelectionModel = {
  readonly groupSelects: ServerSelectionGroupMode
  /** Whether the row `id` at `route` is selected. Leaves and groups alike. */
  isSelected(route: ReadonlyArray<string>, id: string): boolean
  /**
   * Set one row's selection. Under `descendants` a group takes its subtree
   * along, and `isGroup` says which kind of row this is - the model cannot
   * tell, and the difference decides whether a count is still exact.
   */
  toggle(route: ReadonlyArray<string>, id: string, next: boolean, isGroup?: boolean): void
  /** The header checkbox: select or clear everything. */
  setAll(next: boolean): void
  clear(): void
  /** `all`, `none`, or `some` - what the header checkbox should draw. */
  headerState(): 'none' | 'some' | 'all'
  /**
   * How many rows are selected, given the total. Exact for the flat rule.
   * Under `descendants` it is exact only while no group is an exception (a
   * group's size is not known here); then it is `null`, and a UI should say
   * "some" rather than invent a number.
   */
  selectedCount(rowCount: number | null): number | null
  /** True when the rule is "everything" with no exceptions - a bulk edit can go by filter alone. */
  isSelectAllWithoutExceptions(): boolean
  getState(): ServerSelectionState | ServerGroupSelectionNode
  setState(state: ServerSelectionState | ServerGroupSelectionNode): void
}

/**
 * Build a rule-based selection model. `createServerRowModel` makes one when
 * its `selection` option is set; it is exported for a model of your own.
 */
export function createServerSelectionModel(
  options: ServerSelectionModelOptions = {},
): ServerSelectionModel {
  const groupSelects = options.groupSelects ?? 'self'
  const hierarchical = groupSelects !== 'self'
  const notify = () => options.onChange?.()

  // ------------------------------------------------------------- flat
  let selectAll = false
  const toggled = new Set<string>()

  // ------------------------------------------------------ hierarchical
  type Node = { selectAllChildren: boolean; toggled: Map<string, Node>; group: boolean }
  let root: Node = { selectAllChildren: false, toggled: new Map(), group: true }

  /** Walk the rule tree along `route`, returning the deepest node reached and the state it implies. */
  function resolve(route: ReadonlyArray<string>): { node: Node; state: boolean; exact: boolean } {
    let node = root
    let state = root.selectAllChildren
    for (const key of route) {
      const next = node.toggled.get(key)
      if (!next) return { node, state, exact: false }
      node = next
      state = next.selectAllChildren
    }
    return { node, state, exact: true }
  }

  /** Walk-or-create the rule tree along `route`, so an exception can be recorded beneath it. */
  function ensurePath(route: ReadonlyArray<string>): Node {
    let node = root
    for (const key of route) {
      let next = node.toggled.get(key)
      if (!next) {
        // A group we descend into without an explicit rule inherits its
        // parent's state, and records it so the exception below has a base.
        next = { selectAllChildren: node.selectAllChildren, toggled: new Map(), group: true }
        node.toggled.set(key, next)
      }
      node = next
    }
    return node
  }

  /** Drop nodes that no longer differ from their parent, so state stays minimal. */
  function prune(node: Node): void {
    for (const [key, child] of [...node.toggled]) {
      prune(child)
      if (child.toggled.size === 0 && child.selectAllChildren === node.selectAllChildren) {
        node.toggled.delete(key)
      }
    }
  }

  const toPlain = (node: Node): ServerGroupSelectionNode => ({
    selectAllChildren: node.selectAllChildren,
    toggled: Object.fromEntries([...node.toggled].map(([k, v]) => [k, toPlain(v)])),
    ...(node.group ? { group: true } : {}),
  })
  const fromPlain = (plain: ServerGroupSelectionNode, group = true): Node => ({
    selectAllChildren: !!plain.selectAllChildren,
    toggled: new Map(
      Object.entries(plain.toggled ?? {}).map(([k, v]) => [k, fromPlain(v, !!v.group)]),
    ),
    group,
  })

  /**
   * The number of rows the exceptions under `node` amount to, or null when
   * one of them is a flipped GROUP - its size was never counted here. A
   * group whose own state matches its parent is a pass-through; only what
   * sits beneath it counts.
   */
  /**
   * Leaves selected under `node`, whose own subtree holds `size` leaves
   * (`null` when unknown). A selected node is its size minus the exceptions
   * among its toggled children; an unselected one is the sum of what its
   * toggled children select. A flipped group needs its size, which comes
   * from `leafCount`; without it the answer is unknown.
   */
  function selectedUnder(node: Node, route: ReadonlyArray<string>, size: number | null): number | null {
    if (node.selectAllChildren) {
      if (size == null) return null
      let minus = 0
      for (const [key, child] of node.toggled) {
        if (child.group) {
          const childRoute = [...route, key]
          const childSize = options.leafCount?.(childRoute) ?? null
          const selected = selectedUnder(child, childRoute, childSize)
          if (childSize == null || selected == null) return null
          minus += childSize - selected
        } else if (!child.selectAllChildren) {
          minus += 1
        }
      }
      return Math.max(0, size - minus)
    }
    let n = 0
    for (const [key, child] of node.toggled) {
      if (child.group) {
        const childRoute = [...route, key]
        const selected = selectedUnder(child, childRoute, options.leafCount?.(childRoute) ?? null)
        if (selected == null) return null
        n += selected
      } else if (child.selectAllChildren) {
        n += 1
      }
    }
    return n
  }

  return {
    groupSelects,

    isSelected(route, id) {
      if (!hierarchical) return selectAll !== toggled.has(id)
      const { node, state } = resolve(route)
      const own = node.toggled.get(id)
      return own ? own.selectAllChildren : state
    },

    toggle(route, id, next, isGroup = false) {
      if (!hierarchical) {
        // The row differs from the rule when `next` disagrees with selectAll.
        if (next !== selectAll) toggled.add(id)
        else toggled.delete(id)
        notify()
        return
      }
      const parent = ensurePath(route)
      // A toggled row - group or leaf - becomes a node with no exceptions of
      // its own: ticking a group throws away whatever was recorded beneath it.
      if (next === parent.selectAllChildren) parent.toggled.delete(id)
      else parent.toggled.set(id, { selectAllChildren: next, toggled: new Map(), group: isGroup })
      prune(root)
      notify()
    },

    setAll(next) {
      if (!hierarchical) {
        selectAll = next
        toggled.clear()
      } else {
        root = { selectAllChildren: next, toggled: new Map(), group: true }
      }
      notify()
    },

    clear() {
      this.setAll(false)
    },

    headerState() {
      if (!hierarchical) {
        if (selectAll) return toggled.size === 0 ? 'all' : 'some'
        return toggled.size === 0 ? 'none' : 'some'
      }
      if (root.selectAllChildren) return root.toggled.size === 0 ? 'all' : 'some'
      return root.toggled.size === 0 ? 'none' : 'some'
    },

    selectedCount(rowCount) {
      if (!hierarchical) {
        if (!selectAll) return toggled.size
        return rowCount == null ? null : Math.max(0, rowCount - toggled.size)
      }
      return selectedUnder(root, [], rowCount)
    },

    isSelectAllWithoutExceptions() {
      return hierarchical ? root.selectAllChildren && root.toggled.size === 0 : selectAll && toggled.size === 0
    },

    getState() {
      if (!hierarchical) return { selectAll, toggled: [...toggled] }
      return toPlain(root)
    },

    setState(state) {
      if (!hierarchical) {
        const flat = state as ServerSelectionState
        selectAll = !!flat.selectAll
        toggled.clear()
        for (const id of flat.toggled ?? []) toggled.add(id)
      } else {
        root = fromPlain(state as ServerGroupSelectionNode)
      }
      notify()
    },
  }
}
