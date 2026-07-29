/**
 * Regression: driving the imperative filter API from a reactive `$effect`.
 *
 * The filter mutators (`setFilter` / `clearFilter` / `setFacetFilter` /
 * `clearAllFilters`) do a read-modify-write on the grid's filter state
 * (e.g. `{ ...filterMenuValues, [id]: ... }`). If those internal reads are
 * captured as dependencies of a caller's `$effect`, the subsequent write
 * re-dirties the effect and it loops forever (Svelte throws
 * `effect_update_depth_exceeded`). This bit demo 141, whose "top performers
 * only" toggle drove `api.setFilter` from an `$effect` and hung the grid for
 * ~7s before crashing.
 *
 * The fix wraps those mutators in `untrack`, so this pattern must now settle
 * to a stable filtered row set in a bounded number of flushes.
 */

import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  columnFilteringFeature,
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: number; name: string; team: string; salary: number }

const features = tableFeatures({ columnFilteringFeature, rowSortingFeature })

const sampleRows: Row[] = [
  { id: 1, name: 'Ada Lovelace', team: 'Research', salary: 142_000 },
  { id: 2, name: 'Grace Hopper', team: 'Compilers', salary: 158_000 },
  { id: 3, name: 'Alan Turing', team: 'Research', salary: 138_000 },
  { id: 4, name: 'Margaret Hamilton', team: 'Apollo', salary: 165_000 },
  { id: 5, name: 'Linus Torvalds', team: 'Kernel', salary: 175_000 },
]

const sampleColumns: ColumnDef<typeof features, Row>[] = [
  { field: 'name', header: 'Name', width: 200 },
  { field: 'team', header: 'Team', width: 160 },
  { field: 'salary', header: 'Salary', width: 140 },
]

function mountGrid(): { api: SvGridApi<typeof features, Row>; destroy: () => void } {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let capturedApi: SvGridApi<typeof features, Row> | null = null
  const app = mount(SvGrid, {
    target,
    props: {
      data: sampleRows,
      columns: sampleColumns,
      features,
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        filteredRowModel: createFilteredRowModel(),
        sortedRowModel: createSortedRowModel(sortFns),
      },
      rowHeight: 36,
      containerHeight: 480,
      virtualization: false,
      onApiReady(api: SvGridApi<typeof features, Row>) {
        capturedApi = api
      },
    } as any,
  })
  flushSync()
  if (!capturedApi) throw new Error('onApiReady never fired')
  return { api: capturedApi, destroy: () => { unmount(app); target.remove() } }
}

describe('imperative filter API driven from a reactive $effect', () => {
  it('setFilter/clearFilter inside an $effect settle without an update loop', () => {
    const { api, destroy } = mountGrid()
    // Independent root so we own the effect lifecycle and can flush it.
    let topOnly = $state(false)
    let runs = 0
    const stop = $effect.root(() => {
      $effect(() => {
        runs += 1
        // Reads happen inside the mutators; the guard against looping is that
        // those reads are untracked, so this effect must NOT re-run per write.
        if (topOnly) api.setFilter('salary', { operator: 'greaterThan', value: '150000' })
        else api.clearFilter('salary')
      })
    })
    try {
      flushSync()
      // Turning the filter on must narrow the set and NOT blow the update depth.
      topOnly = true
      // If the mutator's reads leaked, this flush would throw
      // effect_update_depth_exceeded.
      expect(() => flushSync()).not.toThrow()

      const displayed = api.getDisplayedRows()
      expect(displayed.map((r) => (r as Row).id).sort()).toEqual([2, 4, 5])

      // The effect ran a bounded number of times: once on mount + once for the
      // toggle. A leaked dependency would push this into the hundreds.
      expect(runs).toBeLessThanOrEqual(3)

      // Toggling back off clears cleanly too.
      topOnly = false
      expect(() => flushSync()).not.toThrow()
      expect(api.getDisplayedRows().length).toBe(sampleRows.length)
    } finally {
      stop()
      destroy()
    }
  })
})
