/**
 * The two ways a live feed can change a row, and what each one reaches.
 *
 * A `$state` array passed as `data` has two update paths and they are not
 * interchangeable, which is the whole design problem of a ticking grid:
 *
 *   1. Mutate a field through the proxy (`rows[i].price = x`). The visible
 *      cell re-renders because its template reads the field through the
 *      proxy. The row model does NOT run - it caches on the array reference
 *      and the reference did not change - so an active sort or filter is
 *      stale for that row until something replaces the array.
 *   2. Replace the array (`rows = next`, or `api.applyTransaction`). The row
 *      model rebuilds and re-runs the pipeline over every row; sort and filter
 *      are current again.
 *
 * Replacing one ELEMENT through the proxy (`rows[i] = {...}`) is the case a
 * React-trained hand reaches for, and it is the one that does neither: the
 * base row keeps its old `original`, so the cell keeps its old value.
 *
 * These are the facts the real-time docs and the blog describe; if one of
 * them changes, this file is where it shows up first.
 *
 * Lives in a `.svelte.test.ts` so `$state` is available.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  createCoreRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from './index'
import type { SvGridApi } from './index'

type Quote = { id: string; symbol: string; price: number }

const features = tableFeatures({ rowSortingFeature })
const columns = [
  { field: 'symbol', header: 'Symbol', width: 120 },
  { field: 'price', header: 'Price', width: 120, editorType: 'number' as const },
]

function seed(): Quote[] {
  return [
    { id: 'a', symbol: 'AAA', price: 10 },
    { id: 'b', symbol: 'BBB', price: 20 },
    { id: 'c', symbol: 'CCC', price: 30 },
  ]
}

/**
 * The props object must be the `$state` proxy itself, not a copy of it: a
 * spread would snapshot `data` at mount and the reassignment tests would be
 * testing nothing.
 */
function liveProps(data: Quote[]) {
  const props = $state({
    data,
    columns,
    features,
    _rowModels: {
      coreRowModel: createCoreRowModel(),
      filteredRowModel: createFilteredRowModel(),
      sortedRowModel: createSortedRowModel(sortFns),
    },
    getRowId: (r: Quote) => r.id,
    // Price descending: CCC, BBB, AAA. A tick that lifts AAA above CCC is
    // the observable difference between "cell updated" and "re-sorted".
    initialSorting: [{ id: 'price', desc: true }],
    containerHeight: 400,
    virtualization: false,
    onApiReady: undefined as ((next: SvGridApi<typeof features, Quote>) => void) | undefined,
  })
  return props
}

function mountGrid(props: ReturnType<typeof liveProps>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api: SvGridApi<typeof features, Quote> | null = null
  props.onApiReady = (next) => (api = next)
  const app = mount(SvGrid, { target, props: props as never })
  flushSync()
  const dataRows = () =>
    Array.from(target.querySelectorAll('tbody.sv-grid-body tr.sv-grid-row:not(.sv-grid-row-spacer)'))
  const cellsOf = (tr: Element) =>
    Array.from(tr.querySelectorAll('.sv-grid-cell:not(.sv-grid-selection-cell)')).map((td) =>
      td.textContent?.trim(),
    )
  const symbolsInOrder = () => dataRows().map((tr) => cellsOf(tr)[0])
  const priceOf = (symbol: string) => {
    const tr = dataRows().find((row) => cellsOf(row)[0] === symbol)
    return tr ? cellsOf(tr)[1] : undefined
  }
  return {
    app,
    target,
    api: () => api!,
    symbolsInOrder,
    priceOf,
    done() {
      unmount(app)
      target.remove()
    },
  }
}

describe('live update paths', () => {
  it('starts sorted by price descending', () => {
    const props = liveProps(seed())
    const g = mountGrid(props)
    expect(g.symbolsInOrder()).toEqual(['CCC', 'BBB', 'AAA'])
    g.done()
  })

  it('proxy field write: the cell updates, the sort does not re-run', () => {
    const props = liveProps(seed())
    const g = mountGrid(props)

    props.data[0]!.price = 99 // AAA now the highest price
    flushSync()

    expect(g.priceOf('AAA')).toBe('99')
    // Still where it was: the row model never saw the write.
    expect(g.symbolsInOrder()).toEqual(['CCC', 'BBB', 'AAA'])
    g.done()
  })

  it('proxy element replacement: neither the cell nor the sort updates', () => {
    const props = liveProps(seed())
    const g = mountGrid(props)

    props.data[0] = { ...props.data[0]!, price: 99 }
    flushSync()

    // The base row still points at the object it was built from.
    expect(g.priceOf('AAA')).toBe('10')
    expect(g.symbolsInOrder()).toEqual(['CCC', 'BBB', 'AAA'])
    g.done()
  })

  it('array reassignment: the cell updates and the sort re-runs', () => {
    const props = liveProps(seed())
    const g = mountGrid(props)

    props.data = props.data.map((r) => (r.id === 'a' ? { ...r, price: 99 } : r))
    flushSync()

    expect(g.priceOf('AAA')).toBe('99')
    expect(g.symbolsInOrder()).toEqual(['AAA', 'CCC', 'BBB'])
    g.done()
  })

  it('applyTransaction: the cell updates and the sort re-runs', () => {
    const props = liveProps(seed())
    const g = mountGrid(props)

    g.api().applyTransaction({ update: [{ id: 'a', symbol: 'AAA', price: 99 }] })
    flushSync()

    expect(g.priceOf('AAA')).toBe('99')
    expect(g.symbolsInOrder()).toEqual(['AAA', 'CCC', 'BBB'])
    g.done()
  })

  it('a proxy field write is caught up by the next array replacement', () => {
    const props = liveProps(seed())
    const g = mountGrid(props)

    props.data[0]!.price = 99
    flushSync()
    expect(g.symbolsInOrder()).toEqual(['CCC', 'BBB', 'AAA'])

    // Any structural change re-runs the pipeline over the current values,
    // including the one the proxy write left behind.
    props.data = [...props.data]
    flushSync()
    expect(g.symbolsInOrder()).toEqual(['AAA', 'CCC', 'BBB'])
    g.done()
  })
})
