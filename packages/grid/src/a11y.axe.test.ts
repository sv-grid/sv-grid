/**
 * Accessibility tests that run axe-core against a REAL rendered grid.
 *
 * The other a11y tests in this package (`a11y.test.ts`, `a11y.contract.test.ts`)
 * check the ARIA prop builders in isolation, against strings. Useful, but they
 * cannot catch a violation that only exists once the component is assembled:
 * a duplicated id, a control with no accessible name, a role nested somewhere
 * it is not allowed. This file mounts `<SvGrid>` and audits the resulting DOM.
 *
 * It runs in the normal vitest suite - which means it runs in CI. The Playwright
 * e2e suite cannot, because it depends on the private `website/` submodule.
 *
 * jsdom limitation, stated rather than hidden: jsdom performs no layout, so
 * every geometry-dependent rule is meaningless here and is disabled below. The
 * important one is `color-contrast`, which needs real painting. Contrast is a
 * property of a theme, not of grid markup, and the guidance for verifying it
 * against your own theme lives in docs/help/accessibility.md. What this file
 * does cover is the structural half: roles, names, relationships, and ids.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import axe from 'axe-core'
import SvGrid from './SvGrid.svelte'
import {
  tableFeatures,
  columnFilteringFeature,
  rowSortingFeature,
  rowSelectionFeature,
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
} from './index'
import type { ColumnDef } from './index'

type Row = { id: string; name: string; team: string; score: number }

const features = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  rowSelectionFeature,
})

const sortFns = {} as never

const rows: Row[] = [
  { id: 'r1', name: 'Ada Lovelace', team: 'Platform', score: 91 },
  { id: 'r2', name: 'Grace Hopper', team: 'Compilers', score: 88 },
  { id: 'r3', name: 'Karen Sparck Jones', team: 'Search', score: 95 },
  { id: 'r4', name: 'Barbara Liskov', team: 'Platform', score: 93 },
]

const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'name', header: 'Name', width: 200 },
  { field: 'team', header: 'Team', width: 140 },
  { field: 'score', header: 'Score', width: 100, align: 'right' },
]

/**
 * Rules that depend on layout or painting. jsdom gives every element zero size
 * and no computed colour, so these produce noise rather than signal.
 */
const LAYOUT_DEPENDENT_RULES = [
  'color-contrast',
  'scrollable-region-focusable',
  'target-size',
]

function mountGrid(extraProps: Record<string, unknown> = {}) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid, {
    target,
    props: {
      data: rows,
      columns: cols,
      features,
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        filteredRowModel: createFilteredRowModel(),
        sortedRowModel: createSortedRowModel(sortFns),
      },
      containerHeight: 300,
      virtualization: false,
      columnVirtualization: false,
      ...extraProps,
    } as never,
  })
  return {
    target,
    destroy: () => {
      unmount(app)
      target.remove()
    },
  }
}

async function auditGrid(props: Record<string, unknown> = {}) {
  const { target, destroy } = mountGrid(props)
  try {
    // Let the grid settle (row model + effects) before auditing.
    await new Promise((r) => setTimeout(r, 0))
    const results = await axe.run(target, {
      rules: Object.fromEntries(LAYOUT_DEPENDENT_RULES.map((id) => [id, { enabled: false }])),
    })
    return results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => n.html).slice(0, 3),
    }))
  } finally {
    destroy()
  }
}

describe('axe audit of a rendered grid', () => {
  it('reports no violations for a plain grid', async () => {
    expect(await auditGrid()).toEqual([])
  })

  it('reports no violations with the filter row and global filter shown', async () => {
    expect(
      await auditGrid({ showColumnFilters: true, showFilterRow: true, showGlobalFilter: true }),
    ).toEqual([])
  })

  it('reports no violations with row selection enabled', async () => {
    expect(await auditGrid({ showRowSelection: true })).toEqual([])
  })

  it('reports no violations with pagination shown', async () => {
    expect(await auditGrid({ showPagination: true, pageSize: 2 })).toEqual([])
  })

  it('actually audits something - the grid role is present in the tree', async () => {
    // Guards against the audit silently passing because nothing rendered.
    const { target, destroy } = mountGrid()
    try {
      await new Promise((r) => setTimeout(r, 0))
      expect(target.querySelector('[role="grid"], table')).not.toBeNull()
    } finally {
      destroy()
    }
  })
})

describe('validation is exposed to assistive technology', () => {
  // `validate` used to mark a bad cell with a red class and a `title` only.
  // Both are visual: the class carries no semantics at all, and `title` is
  // unreliably surfaced and unreachable by keyboard. A screen-reader user had
  // no way to know the cell was rejected, which is WCAG 3.3.1.
  const validatedCols: ColumnDef<typeof features, Row>[] = [
    { field: 'name', header: 'Name', width: 200 },
    {
      field: 'score',
      header: 'Score',
      width: 100,
      validate: ({ value }) => (Number(value) < 90 ? 'Score must be at least 90' : null),
    },
  ]

  it('marks an invalid cell with aria-invalid and keeps the message', async () => {
    const { target, destroy } = mountGrid({ columns: validatedCols })
    try {
      await new Promise((r) => setTimeout(r, 0))
      const invalid = [...target.querySelectorAll('td[aria-invalid="true"]')]
      // Grace 88 fails, Ada 91 / Karen 95 / Barbara 93 pass.
      expect(invalid).toHaveLength(1)
      // The reason must reach assistive tech, not just the hover tooltip:
      // either as the accessible description (`title`) or as visually-hidden
      // text read with the cell. Which one depends on the render path.
      const reason =
        invalid[0]?.getAttribute('title') ??
        invalid[0]?.querySelector('.sv-grid-sr-only')?.textContent
      expect(reason).toBe('Score must be at least 90')
    } finally {
      destroy()
    }
  })

  it('leaves valid cells unmarked', async () => {
    const { target, destroy } = mountGrid({ columns: validatedCols })
    try {
      await new Promise((r) => setTimeout(r, 0))
      expect(target.querySelectorAll('td[aria-invalid]')).toHaveLength(1)
    } finally {
      destroy()
    }
  })

  it('passes axe with an invalid cell rendered', async () => {
    expect(await auditGrid({ columns: validatedCols })).toEqual([])
  })
})
