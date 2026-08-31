/**
 * The footer summary row: its default, its `summary` shortcut, and the
 * per-column `summary` aggregator.
 *
 * The default matters more than it looks. It used to be ON, so a plain
 * `<SvGrid {data} {columns} />` grew a totals row nobody asked for and every
 * caller had to opt out - which is why this repo had 375 `enableRowSummaries=
 * {false}` call sites against 6 that wanted it. These tests pin the flip.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  columnFilteringFeature,
  createCoreRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  type ColumnDef,
} from './index'

const features = tableFeatures({
  columnFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
})

type Row = { id: number; name: string; amount: number }

const rows: Row[] = [
  { id: 1, name: 'Ada', amount: 100 },
  { id: 2, name: 'Grace', amount: 200 },
  { id: 3, name: 'Alan', amount: 300 },
]

const baseColumns: ColumnDef<typeof features, Row>[] = [
  { field: 'name', header: 'Name', width: 200 },
  { field: 'amount', header: 'Amount', width: 160 },
]

function mountGrid(overrides: Record<string, unknown> = {}) {
  const target = document.createElement('div')
  target.style.width = '900px'
  target.style.height = '400px'
  document.body.appendChild(target)

  const app = mount(SvGrid, {
    target,
    props: {
      data: rows,
      columns: baseColumns,
      features,
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        filteredRowModel: createFilteredRowModel(),
        sortedRowModel: createSortedRowModel(sortFns),
        paginatedRowModel: createPaginatedRowModel(),
      },
      rowHeight: 36,
      containerHeight: 320,
      virtualization: false,
      ...overrides,
    } as any,
  })

  return {
    target,
    row: () => target.querySelector('.sv-grid-summary-row'),
    cells: () =>
      [...target.querySelectorAll('.sv-grid-summary-column')].map((c) =>
        (c.textContent ?? '').trim(),
      ),
    destroy: () => {
      unmount(app)
      target.remove()
    },
  }
}

describe('SvGrid - footer summary row', () => {
  it('is OFF by default', () => {
    const g = mountGrid()
    try {
      expect(g.row()).toBeNull()
    } finally {
      g.destroy()
    }
  })

  it('turns on with the `summary` shortcut', () => {
    const g = mountGrid({ summary: true })
    try {
      expect(g.row()).not.toBeNull()
    } finally {
      g.destroy()
    }
  })

  it('still turns on with the long-form `enableRowSummaries`', () => {
    const g = mountGrid({ enableRowSummaries: true })
    try {
      expect(g.row()).not.toBeNull()
    } finally {
      g.destroy()
    }
  })

  it('lets the `summary` shortcut win over the long-form prop', () => {
    const on = mountGrid({ summary: true, enableRowSummaries: false })
    try {
      expect(on.row()).not.toBeNull()
    } finally {
      on.destroy()
    }

    const off = mountGrid({ summary: false, enableRowSummaries: true })
    try {
      expect(off.row()).toBeNull()
    } finally {
      off.destroy()
    }
  })

  it('defaults to summing a numeric column and counting the rest', () => {
    const g = mountGrid({ summary: true })
    try {
      const cells = g.cells()
      expect(cells).toContain('Count: 3')
      expect(cells.join(' ')).toContain('600')
    } finally {
      g.destroy()
    }
  })
})

describe('SvGrid - per-column summary aggregator', () => {
  it('honours an explicit aggregator instead of the default sum', () => {
    const g = mountGrid({
      summary: true,
      columns: [
        { field: 'name', header: 'Name', width: 200 },
        { field: 'amount', header: 'Amount', width: 160, summary: 'avg' },
      ],
    })
    try {
      // avg of 100 / 200 / 300, not the 600 the default would show.
      expect(g.cells().join(' ')).toContain('200')
      expect(g.cells().join(' ')).not.toContain('600')
    } finally {
      g.destroy()
    }
  })

  it('supports min, max and count', () => {
    for (const [agg, expected] of [
      ['min', '100'],
      ['max', '300'],
      ['count', '3'],
    ] as const) {
      const g = mountGrid({
        summary: true,
        columns: [
          { field: 'name', header: 'Name', width: 200 },
          { field: 'amount', header: 'Amount', width: 160, summary: agg },
        ],
      })
      try {
        expect(g.cells().join(' ')).toContain(expected)
      } finally {
        g.destroy()
      }
    }
  })

  it('takes a custom aggregator function', () => {
    const g = mountGrid({
      summary: true,
      columns: [
        { field: 'name', header: 'Name', width: 200 },
        {
          field: 'amount',
          header: 'Amount',
          width: 160,
          summary: (values: number[]) => `${values.length} values`,
        },
      ],
    })
    try {
      expect(g.cells()).toContain('3 values')
    } finally {
      g.destroy()
    }
  })

  it('leaves the cell blank on `summary: false`', () => {
    const g = mountGrid({
      summary: true,
      columns: [
        { field: 'name', header: 'Name', width: 200, summary: false },
        { field: 'amount', header: 'Amount', width: 160 },
      ],
    })
    try {
      // The name column would otherwise read "Count: 3".
      expect(g.cells()).not.toContain('Count: 3')
      expect(g.cells().join(' ')).toContain('600')
    } finally {
      g.destroy()
    }
  })
})
