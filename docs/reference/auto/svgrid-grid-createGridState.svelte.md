# `@svgrid/grid` · `createGridState.svelte.ts`

Auto-generated. Source: `packages\grid\src\createGridState.svelte.ts`.

### `function createGridState`

A piece of grid state held in a Svelte `$state` rune, for a headless grid
that owns its state outside the store (controlled sorting, pagination, ...).
Returns a getter and a setter; the setter takes a value or an updater
function, the same {@link Updater} shape the grid's `on*Change` options pass.

@example
const [sorting, setSorting] = createGridState<SortingState>([])
// pass sorting() as state.sorting, and setSorting as onSortingChange

```ts
export function createGridState<TState>(
  initialValue: TState,
): [() => TState, (updater: Updater<TState>) => void]
```

### `const createSvGridState`

Alias of {@link createGridState}.

```ts
export const createSvGridState = createGridState
```
