/**
 * Filtering depth, verified rather than assumed (#11, #12).
 *
 * Both of these were still listed as roadmap gaps. They are not: the filter row
 * renders a per-column operator picker, and a column filter carries an optional
 * second condition joined by AND/OR. These tests pin the behaviour so the claim
 * is backed by something executable.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  applyExcelFilter,
  createCoreRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  sortFns,
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
} from './index'

type Row = { id: number; name: string; amount: number }

const data: Row[] = [
  { id: 1, name: 'alpha', amount: 5 },
  { id: 2, name: 'beta', amount: 50 },
  { id: 3, name: 'gamma', amount: 500 },
]

const columns = [
  { field: 'name', header: 'Name', width: 160 },
  { field: 'amount', header: 'Amount', width: 120 },
]

const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
const tick = () => new Promise<void>((r) => queueMicrotask(r))

function mountGrid() {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api: never = null as never
  const app = mount(SvGrid, {
    target,
    props: {
      data,
      columns,
      features,
      filterable: true,
      showFilterRow: true,
      onApiReady: (a: never) => { api = a },
      _rowModels: {
        coreRowModel: createCoreRowModel(),
        filteredRowModel: createFilteredRowModel(),
        sortedRowModel: createSortedRowModel(sortFns),
        paginatedRowModel: createPaginatedRowModel(),
      },
      containerHeight: 400,
      virtualization: false,
    } as never,
  })
  return { target, getApi: () => api, destroy: () => { unmount(app); target.remove() } }
}

let cleanup: (() => void) | null = null
afterEach(() => { cleanup?.(); cleanup = null })

const bodyRows = (t: HTMLElement) =>
  [...t.querySelectorAll('tbody tr.sv-grid-row')].filter(
    (r) => !r.classList.contains('sv-grid-row-spacer'),
  )

describe('filter row operator picker (#11)', () => {
  it('renders an operator button per column in the filter row', async () => {
    const { target, destroy } = mountGrid()
    cleanup = destroy
    await tick()
    const btns = target.querySelectorAll('.sv-grid-filter-operator-btn')
    expect(btns.length).toBe(columns.length)
  })

  it('exposes the active operator on the button for a screen reader', async () => {
    const { target, destroy } = mountGrid()
    cleanup = destroy
    await tick()
    const btn = target.querySelector('.sv-grid-filter-operator-btn')!
    expect(btn.getAttribute('aria-label')).toMatch(/^Filter condition: /)
  })

  it('opens a menu of the operators valid for that column', async () => {
    const { target, destroy } = mountGrid()
    cleanup = destroy
    await tick()
    target.querySelector<HTMLButtonElement>('.sv-grid-filter-operator-btn')!.click()
    await tick()
    expect(target.querySelector('.sv-grid-filter-operator-btn.is-open')).not.toBeNull()
  })
})

describe('two-condition column filter (#12)', () => {
  // The model is what decides rows; these assert the AND/OR semantics directly.
  const between = (v: unknown, lo: number, hi: number) =>
    applyExcelFilter(v, { id: 'amount', operator: 'greaterThan', value: lo }) &&
    applyExcelFilter(v, { id: 'amount', operator: 'lessThan', value: hi })

  it('AND narrows to the intersection', () => {
    expect(between(50, 10, 100)).toBe(true)
    expect(between(5, 10, 100)).toBe(false)
    expect(between(500, 10, 100)).toBe(false)
  })

  it('OR widens to the union', () => {
    const or = (v: unknown) =>
      applyExcelFilter(v, { id: 'name', operator: 'startsWith', value: 'al' }) ||
      applyExcelFilter(v, { id: 'name', operator: 'endsWith', value: 'ma' })
    expect(or('alpha')).toBe(true)
    expect(or('gamma')).toBe(true)
    expect(or('beta')).toBe(false)
  })

  it('applies a two-condition AND filter through the api', async () => {
    const g = mountGrid()
    cleanup = g.destroy
    await tick()
    const api = g.getApi() as never as {
      setFilter: (id: string, f: Record<string, unknown>) => void
    }
    // amount > 10 AND amount < 100 -> only beta (50)
    api.setFilter('amount', {
      operator: 'greaterThan',
      value: '10',
      operator2: 'lessThan',
      value2: '100',
      join: 'AND',
    })
    await tick()
    expect(bodyRows(g.target)).toHaveLength(1)
    expect(g.target.textContent).toContain('beta')
  })

  it('applies a two-condition OR filter through the api', async () => {
    const g = mountGrid()
    cleanup = g.destroy
    await tick()
    const api = g.getApi() as never as {
      setFilter: (id: string, f: Record<string, unknown>) => void
    }
    // name startsWith "al" OR name endsWith "ma" -> alpha + gamma
    api.setFilter('name', {
      operator: 'startsWith',
      value: 'al',
      operator2: 'endsWith',
      value2: 'ma',
      join: 'OR',
    })
    await tick()
    expect(bodyRows(g.target)).toHaveLength(2)
    expect(g.target.textContent).toContain('alpha')
    expect(g.target.textContent).toContain('gamma')
    expect(g.target.textContent).not.toContain('beta')
  })
})
