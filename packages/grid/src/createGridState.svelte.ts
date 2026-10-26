import type { Updater } from './core'

/**
 * A piece of grid state held in a Svelte `$state` rune, for a headless grid
 * that owns its state outside the store (controlled sorting, pagination, ...).
 * Returns a getter and a setter; the setter takes a value or an updater
 * function, the same {@link Updater} shape the grid's `on*Change` options pass.
 *
 * @example
 * const [sorting, setSorting] = createGridState<SortingState>([])
 * // pass sorting() as state.sorting, and setSorting as onSortingChange
 */
export function createGridState<TState>(
  initialValue: TState,
): [() => TState, (updater: Updater<TState>) => void] {
  let value = $state(initialValue)

  return [
    () => value,
    (updater: Updater<TState>) => {
      if (updater instanceof Function) value = updater(value)
      else value = updater
    },
  ]
}

/** Alias of {@link createGridState}. */
export const createSvGridState = createGridState
