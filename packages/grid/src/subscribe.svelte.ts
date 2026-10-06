import type { RowData, SvGrid, TableFeatures } from './core'

const shallowCompare = (a: unknown, b: unknown) => {
  if (Object.is(a, b)) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  const aObj = a as Record<string, unknown>
  const bObj = b as Record<string, unknown>
  const aKeys = Object.keys(aObj)
  const bKeys = Object.keys(bObj)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => Object.is(aObj[key], bObj[key]))
}

/**
 * Fine-grained subscription to `table.store` using `useSelector` with shallow
 * comparison. Call from `<script>` so the selector is contextually typed.
 */
export function subscribeGrid<
  TFeatures extends TableFeatures,
  TData extends RowData,
  TSelected,
>(
  grid: SvGrid<TData>,
  selector: (state: Record<string, any>) => TSelected,
) {
  // $state, not a plain variable: core.ts keeps a deliberately framework-free
  // store, so this Svelte adapter is where reactivity belongs. Without it a
  // `$derived` reading .current never re-runs and the docs' headless examples
  // render their seeded state forever.
  let current = $state(selector(grid.store.state))
  grid.store.subscribe(() => {
    const next = selector(grid.store.state)
    if (!shallowCompare(current, next)) current = next
  })
  return {
    get current() {
      return current
    },
  }
}

export const subscribeSvGrid = subscribeGrid
