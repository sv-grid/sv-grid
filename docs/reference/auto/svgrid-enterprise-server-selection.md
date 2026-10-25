# `@svgrid/enterprise` · `server/server-selection.ts`

Auto-generated. Source: `packages\enterprise\src\server\server-selection.ts`.

### `type ServerSelectionGroupMode`

How ticking a group row behaves: itself, or everything beneath it.

```ts
export type ServerSelectionGroupMode = 'self' | 'descendants' | 'filteredDescendants'
```

### `type ServerSelectionState`

The flat rule, for `groupSelects: 'self'`.

```ts
export type ServerSelectionState = {
  selectAll: boolean
  /** Exceptions to `selectAll`: selected ids when it is false, deselected ones when true. */
  toggled: string[]
}
```

### `type ServerGroupSelectionNode`

One node of the hierarchical rule, for `groupSelects: 'descendants'`.

```ts
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
```

### `type ServerSelectionModelOptions`

What `createServerSelectionModel` takes: the group mode and a change callback.

```ts
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
```

### `type ServerSelectionModel`

A selection kept as a rule - "everything, except these" - flat or per group, that the row model exposes to the grid.

```ts
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
```

### `function createServerSelectionModel`

Build a rule-based selection model. `createServerRowModel` makes one when
its `selection` option is set; it is exported for a model of your own.

```ts
export function createServerSelectionModel(
  options: ServerSelectionModelOptions = {},
): ServerSelectionModel
```
