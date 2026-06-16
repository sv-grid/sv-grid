import type { Updater } from './core'

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

export const createSvGridState = createGridState
