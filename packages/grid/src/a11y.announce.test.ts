/**
 * Verifies the grid actually SPEAKS - that the announcement builders are wired
 * to a real live region and fire on the state changes they were written for.
 *
 * `a11y/grid-announcements.test.ts` proves the message text is right. This file
 * proves the wiring exists, which is the part that was missing: `announce()`
 * shipped and was exported for months while `<SvGrid>` never called it, so the
 * documented "filter and selection announcements" were not happening at all.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvGrid from './SvGrid.svelte'
import { _resetLiveRegions } from './a11y/live-region'
import {
  tableFeatures,
  columnFilteringFeature,
  rowSortingFeature,
  rowSelectionFeature,
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
} from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: string; name: string; team: string }

const features = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  rowSelectionFeature,
})

const rows: Row[] = [
  { id: 'r1', name: 'Ada', team: 'Platform' },
  { id: 'r2', name: 'Grace', team: 'Compilers' },
  { id: 'r3', name: 'Karen', team: 'Search' },
  { id: 'r4', name: 'Barbara', team: 'Platform' },
]

const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'name', header: 'Name', width: 200 },
  { field: 'team', header: 'Team', width: 140 },
]

/** Text currently in the polite live region. */
const politeText = () =>
  document.querySelector('[aria-live="polite"]')?.textContent ?? ''

/** `announce()` sets the text on a microtask so a repeat message re-fires. */
const settle = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

function mountGrid(extraProps: Record<string, unknown> = {}) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api: SvGridApi<typeof features, Row> | null = null
  const app = mount(SvGrid, {
    target,
    props: {
      data: rows,
      columns: cols,
      features,
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        filteredRowModel: createFilteredRowModel(),
        sortedRowModel: createSortedRowModel({} as never),
      },
      containerHeight: 300,
      virtualization: false,
      columnVirtualization: false,
      onApiReady: (a: SvGridApi<typeof features, Row>) => {
        api = a
      },
      ...extraProps,
    } as never,
  })
  flushSync()
  return {
    target,
    get api() {
      return api!
    },
    destroy: () => {
      unmount(app)
      target.remove()
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  _resetLiveRegions()
})

afterEach(() => {
  vi.useRealTimers()
  _resetLiveRegions()
})

describe('filter announcements', () => {
  it('says nothing on mount', async () => {
    const g = mountGrid()
    try {
      await vi.advanceTimersByTimeAsync(500)
      // An unfiltered grid announcing "4 of 4 rows match" would be noise on
      // every page load.
      expect(politeText()).toBe('')
    } finally {
      g.destroy()
    }
  })

  it('reports the match count after a filter narrows the rows', async () => {
    const g = mountGrid()
    try {
      g.api.setState({ globalFilter: 'Platform' })
      flushSync()
      await vi.advanceTimersByTimeAsync(500)
      await settle()
      expect(politeText()).toBe('2 of 4 rows match the current filters')
    } finally {
      g.destroy()
    }
  })

  it('reports no matches distinctly', async () => {
    const g = mountGrid()
    try {
      g.api.setState({ globalFilter: 'nothing-matches-this' })
      flushSync()
      await vi.advanceTimersByTimeAsync(500)
      await settle()
      expect(politeText()).toBe('No rows match the current filters')
    } finally {
      g.destroy()
    }
  })

  it('debounces so only the final count is announced while typing', async () => {
    const g = mountGrid()
    try {
      // Three keystrokes in quick succession, as a user typing "Pla".
      for (const s of ['P', 'Pl', 'Pla']) {
        g.api.setState({ globalFilter: s })
        flushSync()
        await vi.advanceTimersByTimeAsync(50)
      }
      await vi.advanceTimersByTimeAsync(500)
      await settle()
      // A polite region queues rather than replaces, so without the debounce
      // the user would sit through the count for every prefix.
      expect(politeText()).toBe('2 of 4 rows match the current filters')
    } finally {
      g.destroy()
    }
  })

  it('confirms that clearing the filters took effect', async () => {
    const g = mountGrid()
    try {
      g.api.setState({ globalFilter: 'Platform' })
      flushSync()
      await vi.advanceTimersByTimeAsync(500)
      g.api.clearAllFilters()
      flushSync()
      await vi.advanceTimersByTimeAsync(500)
      await settle()
      expect(politeText()).toBe('Filters cleared, showing all 4 rows')
    } finally {
      g.destroy()
    }
  })

  it('stays silent in external-filter mode', async () => {
    // The server decided what matched; the local count describes only the page
    // in hand, so announcing it would misreport the result set.
    const g = mountGrid({ externalFilter: true })
    try {
      g.api.setState({ globalFilter: 'Platform' })
      flushSync()
      await vi.advanceTimersByTimeAsync(500)
      expect(politeText()).toBe('')
    } finally {
      g.destroy()
    }
  })
})

describe('selection announcements', () => {
  it('announces select-all', async () => {
    const g = mountGrid()
    try {
      g.api.selectAllRows()
      flushSync()
      await settle()
      expect(politeText()).toBe('4 rows selected')
    } finally {
      g.destroy()
    }
  })

  it('announces clearing a multi-row selection', async () => {
    const g = mountGrid()
    try {
      g.api.selectAllRows()
      flushSync()
      await settle()
      g.api.clearRowSelection()
      flushSync()
      await settle()
      expect(politeText()).toBe('Selection cleared')
    } finally {
      g.destroy()
    }
  })

  it('stays silent when a single row is selected', async () => {
    const g = mountGrid()
    try {
      g.api.selectRows(['r1'])
      flushSync()
      await settle()
      // Focus lands on the row and the reader announces it from aria-selected.
      expect(politeText()).toBe('')
    } finally {
      g.destroy()
    }
  })
})

describe('announcements are localizable', () => {
  it('uses a consumer-supplied template, placeholders and all', async () => {
    const g = mountGrid({
      localization: {
        text: { announceFilterResults: '{visible} van de {total} rijen komen overeen' },
      },
    })
    try {
      g.api.setState({ globalFilter: 'Platform' })
      flushSync()
      await vi.advanceTimersByTimeAsync(500)
      await settle()
      expect(politeText()).toBe('2 van de 4 rijen komen overeen')
    } finally {
      g.destroy()
    }
  })
})
