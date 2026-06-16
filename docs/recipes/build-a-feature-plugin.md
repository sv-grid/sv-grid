# Build your own feature plugin

> The pattern: `tableFeatures()` is an open registry. Library features
> (`rowSortingFeature`, `columnFilteringFeature`, ...) are nothing more
> than objects with three hooks. Your own feature plugs into the same
> surface.

## When

You want to inject behavior that applies to *every* row or column - a
computed accent class, an audit fingerprint, an inline diff badge, a
per-row policy gate - without forking the grid component or writing
the same `cell:` boilerplate on every column def.

## The contract

A feature is an object with three optional hooks:

```ts
type TableFeature = {
  /** Initial slice of state the engine merges into its store. */
  getInitialState?: () => Record<string, unknown>
  /** Default values for the options bag the consumer passes through. */
  getDefaultOptions?: <TData>() => Record<string, unknown>
  /** Runs once when the table is created. Wrap api methods here. */
  createTable?: <TFeatures extends TableFeatures, TData extends RowData>(table: {
    options: Record<string, unknown>
    getRowModel: () => { rows: Array<{ original: TData }> }
  }) => void
}
```

Drop the unused hooks. A read-only decorator only needs `createTable`.

## How

This 25-line plugin writes a computed `__rowAccent` string onto every
row in the row model. A user-supplied function decides the accent:

```ts
import { tableFeatures, rowSortingFeature, type RowData, type TableFeatures } from '@svgrid/grid'

type RowAccentFn<TData extends RowData> = (row: TData) => string | undefined

const rowAccentFeature = {
  getInitialState: () => ({}),
  getDefaultOptions: <TData extends RowData>() =>
    ({ rowAccent: undefined as RowAccentFn<TData> | undefined }),
  createTable: <TFeatures extends TableFeatures, TData extends RowData>(table: {
    options: { rowAccent?: RowAccentFn<TData> }
    getRowModel: () => { rows: Array<{ original: TData }> }
  }) => {
    // Wrap the row-model accessor so every row carries the computed
    // accent. Cheap O(visibleRows) per render.
    const orig = table.getRowModel.bind(table)
    table.getRowModel = () => {
      const model = orig()
      const fn = table.options.rowAccent
      if (!fn) return model
      for (const row of model.rows) {
        (row.original as Record<string, unknown>).__rowAccent =
          fn(row.original as TData)
      }
      return model
    }
  },
} as const
```

## Wire it up

Register the feature and supply `rowClass` to surface the accent in CSS:

```svelte
<script lang="ts">
  import { SvGrid, tableFeatures, rowSortingFeature } from '@svgrid/grid'

  type Deal = { company: string; health: number; __rowAccent?: string }

  const features = tableFeatures({ rowSortingFeature, rowAccentFeature })
  const deals: Deal[] = [/* ... */]

  function rowAccent(d: Deal): string | undefined {
    if (d.health >= 0.75) return 'good'
    if (d.health <  0.40) return 'bad'
    return 'warn'
  }
  function rowClass(ctx: { row: Deal; rowIndex: number }): string {
    const a = rowAccent(ctx.row)
    return a ? `accent-${a}` : ''
  }
</script>

<SvGrid {features} {columns} data={deals} {rowClass} />

<style>
  /* rowClass lands on the <tr>; <td> cells paint their own bg over it,
     so tint the cells via a descendant selector. */
  :global(.accent-good td.sv-grid-cell) { background: rgba(34,197,94,0.14) !important; }
  :global(.accent-warn td.sv-grid-cell) { background: rgba(245,158,11,0.16) !important; }
  :global(.accent-bad  td.sv-grid-cell) { background: rgba(239,68,68,0.18) !important; }
</style>
```

## Trade-offs

- **`createTable` runs once.** Mutating row data inside `getRowModel`
  works because the model is rebuilt on every state change - but it's a
  side effect on the consumer's `TData`. Use `__`-prefixed keys so it
  reads as a synthetic field, not a real one.
- **Don't put expensive work in `createTable`.** It runs for every
  feature in the registry on every table creation. Put expensive work
  on the consumer's option (`rowAccent: (d) => ...`) where the consumer
  controls the cost.
- **No reactivity from the feature itself.** Reactivity comes from the
  data the consumer hands the grid (Svelte 5 `$state`) - the feature is
  pure transform.

## See also

- [Features reference](../reference/features.md) - the full registry contract
- [Conditional row coloring recipe](./conditional-row-coloring.md) - same idea, no plugin
- [Architecture overview](../help/architecture.md)
