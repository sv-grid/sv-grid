# `@svgrid/grid` · `createGrid.svelte.ts`

Auto-generated. Source: `packages\grid\src\createGrid.svelte.ts`.

### `type SvelteGrid`

The grid instance `createSvGrid` returns: the headless {@link SvGrid} plus a
rune-backed `state` holding whatever the selector picked out of the store.

```ts
export type SvelteGrid<
  TFeatures extends TableFeatures,
  TData extends RowData,
  TSelected = {},
> = SvGrid<TData> & {
  readonly state: Readonly<TSelected>
}
```

### `function createSvGrid`

The headless engine for Svelte: the same grid `<SvGrid>` renders, without the
renderer, so you write the markup. Returns the instance with
`getHeaderGroups()`, `getRowModel()` and the `set*` writers.

`selector` picks the slice of grid state your markup reads; it is re-run on
every store change and exposed as the reactive `grid.state`, so a template
that reads `grid.state.sorting` re-renders when sorting changes.

@example
const grid = createSvGrid(
  {
    _features: tableFeatures({ rowSortingFeature }),
    _rowModels: { coreRowModel: createCoreRowModel(), sortedRowModel: createSortedRowModel() },
    data,
    columns,
  },
  (s) => ({ sorting: s.sorting }),
)

See the "Build a table" guide (help/headless/build-a-table) for a full one.

```ts
export function createSvGrid<
  TFeatures extends TableFeatures,
  TData extends RowData,
  TSelected = {},
>(
  gridOptions: SvGridOptions<TFeatures, TData>,
  selector: (state: Record<string, any>) => TSelected = () => ({}) as TSelected,
): SvelteGrid<TFeatures, TData, TSelected>
```

### `const createGrid`

Alias of {@link createSvGrid}.

```ts
export const createGrid = createSvGrid
```
