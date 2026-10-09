/**
 * The headless docs tell you to write:
 *
 *   const table = createSvGrid({ ..., state: { sorting }, onSortingChange })
 *   const rows  = $derived(table.getRowModel().rows)
 *
 * `createStore` (core.ts) is a plain closure + listener set, NOT runes, and
 * `options.state` is spread into the initial store once at creation. So that
 * `$derived` has no reactive dependency on the engine's state: clicking a
 * header updates the store and the component's own `sorting` rune, the sort
 * indicator moves, and the ROWS never recompute.
 *
 * Caught while recording the headless video: the arrow cleared and the order
 * did not change. Lives in a `.svelte.test.ts` so `$state` is available.
 */
import { describe, expect, it } from 'vitest'
import { flushSync } from 'svelte'
import {
  createSvGrid,
  createCoreRowModel,
  createSortedRowModel,
  tableFeatures,
  rowSortingFeature,
} from './index'

type Repo = { name: string; stars: number }

// Deliberately NOT in stars order: clearing the sort has to produce a
// visibly different list, or the assertions below prove nothing.
const data: Repo[] = [
  { name: 'sv-grid', stars: 172 },
  { name: 'svelte', stars: 78000 },
  { name: 'vite', stars: 68000 },
]

const features = tableFeatures({ rowSortingFeature })
const columns = [
  { field: 'name', header: 'Repo' },
  { field: 'stars', header: 'Stars' },
] as never

function build(onSortingChange: (next: unknown) => void, seed: Array<{ id: string; desc: boolean }>) {
  return createSvGrid({
    _features: features,
    _rowModels: {
      coreRowModel: createCoreRowModel<Repo>(),
      sortedRowModel: createSortedRowModel<Repo>(),
    },
    data,
    columns,
    state: { sorting: seed },
    onSortingChange,
  } as never)
}

describe('headless state reactivity', () => {
  it('seeds the sort from options.state', () => {
    const table = build(() => {}, [{ id: 'stars', desc: true }])
    const names = table.getRowModel().rows.map((r) => (r.original as Repo).name)
    expect(names).toEqual(['svelte', 'vite', 'sv-grid'])
  })

  it('re-sorts when the toggle handler runs', () => {
    let sorting = $state([{ id: 'stars', desc: true }])
    const table = build((next) => (sorting = next as typeof sorting), sorting)

    // The pattern the headless docs now teach: touch the state rune the
    // component owns so the derived re-runs. A plain
    // `$derived(table.getRowModel().rows)` reads only the framework-free
    // engine and never recomputes, which is the bug this guards.
    const rows = $derived.by(() => {
      void sorting
      return table.getRowModel().rows
    })
    expect(rows.map((r) => (r.original as Repo).name)).toEqual(['svelte', 'vite', 'sv-grid'])

    const stars = table.getAllColumns().find((c) => c.id === 'stars')!
    stars.getToggleSortingHandler()()
    flushSync()

    // The engine's own state really did change...
    expect(table.getState().sorting).toEqual([])
    // ...and the component's rune did too, which is why the arrow clears.
    expect(sorting).toEqual([])

    // The rows must follow the cleared sort, i.e. fall back to data order.
    expect(rows.map((r) => (r.original as Repo).name)).toEqual(['sv-grid', 'svelte', 'vite'])
  })
})
