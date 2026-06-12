/**
 * Behavioral tests for the imperative SvGridApi exposed via `onApiReady`.
 *
 * These mount the real <SvGrid /> render component in jsdom, capture the api
 * object on mount, and exercise:
 *   - clearAllFilters (new)
 *   - getFilters     (new)
 *   - getDisplayedRows (new)
 *   - setFilter      (regression)
 *   - getData        (regression)
 *
 * Bare-bones DOM env is enough; we never assert on rendered HTML, just on
 * the object the component hands back.
 */

import { describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
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

const features = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
})

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

function mountGrid(): Promise<{
  api: SvGridApi<typeof features, Row>
  destroy: () => void
}> {
  return new Promise((resolveApi, rejectApi) => {
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
          resolveApi({
            api,
            destroy: () => {
              unmount(app)
              target.remove()
            },
          })
        },
      } as any,
    })

    // Safety net: if onApiReady doesn't fire within a turn, fail loudly.
    queueMicrotask(() => {
      if (!capturedApi) rejectApi(new Error('onApiReady never fired'))
    })
  })
}

describe('SvGridApi - getData / getDisplayedRows', () => {
  it('getData returns the full row set', async () => {
    const { api, destroy } = await mountGrid()
    try {
      const data = api.getData()
      expect(data.length).toBe(sampleRows.length)
      expect(data.map((r) => (r as Row).id)).toEqual([1, 2, 3, 4, 5])
    } finally {
      destroy()
    }
  })

  it('getDisplayedRows returns the post-pipeline visible rows', async () => {
    const { api, destroy } = await mountGrid()
    try {
      // With no filters / sort, displayed rows match full data (no group rows).
      const displayed = api.getDisplayedRows()
      expect(displayed.length).toBe(sampleRows.length)
    } finally {
      destroy()
    }
  })

  it('getDisplayedRows updates after setFilter narrows the set', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setFilter('team', { operator: 'contains', value: 'Research' })
      // Wait one microtask so the derived row pipeline re-runs.
      await Promise.resolve()
      const displayed = api.getDisplayedRows()
      // 2 rows have team === 'Research'
      expect(displayed.length).toBe(2)
      for (const r of displayed) {
        expect((r as Row).team).toBe('Research')
      }
    } finally {
      destroy()
    }
  })
})

describe('SvGridApi - getFilters / clearAllFilters', () => {
  it('getFilters returns an empty object when nothing is filtered', async () => {
    const { api, destroy } = await mountGrid()
    try {
      expect(api.getFilters()).toEqual({})
    } finally {
      destroy()
    }
  })

  it('getFilters reflects the last setFilter call', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setFilter('team', { operator: 'equals', value: 'Apollo' })
      await Promise.resolve()
      const filters = api.getFilters()
      expect(filters.team).toEqual({ operator: 'equals', value: 'Apollo' })
    } finally {
      destroy()
    }
  })

  it('clearAllFilters wipes every column filter at once', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setFilter('team', { operator: 'contains', value: 'Research' })
      api.setFilter('name', { operator: 'contains', value: 'Ada' })
      await Promise.resolve()
      expect(Object.keys(api.getFilters()).length).toBe(2)

      api.clearAllFilters()
      await Promise.resolve()
      expect(api.getFilters()).toEqual({})

      // The full row set is back.
      const displayed = api.getDisplayedRows()
      expect(displayed.length).toBe(sampleRows.length)
    } finally {
      destroy()
    }
  })

  it('clearAllFilters returns a snapshot that is safe to mutate', async () => {
    const { api, destroy } = await mountGrid()
    try {
      api.setFilter('team', { operator: 'contains', value: 'X' })
      await Promise.resolve()
      const snapshot = api.getFilters()
      // Mutate the snapshot - internal state must not be affected.
      snapshot.team!.value = 'mutated externally'
      const fresh = api.getFilters()
      expect(fresh.team!.value).toBe('X')
    } finally {
      destroy()
    }
  })
})
