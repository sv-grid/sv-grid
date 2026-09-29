/**
 * Pushing onto a `$state` array passed as `data`.
 *
 * docs/getting-started/3-data-and-columns.md teaches exactly this: declare
 * `let rows = $state([...])`, hand it to `data`, and an "Add row" button that
 * does nothing but `rows.push(...)`. The grid is supposed to follow.
 *
 * `svgrid.live-update-paths.svelte.test.ts` covers the two MUTATION paths
 * (field write, element replacement) against a sorted grid. This file covers
 * the LENGTH path on the plainest possible grid, because a row appearing is a
 * different question from a cell changing: nothing in the template is reading
 * the new row yet, so the row model has to notice the array grew.
 *
 * Lives in a `.svelte.test.ts` so `$state` is available.
 */
import { describe, expect, it } from 'vitest'
import { mount, unmount, flushSync } from 'svelte'
import SvGrid from './SvGrid.svelte'

type Staff = { id: string; firstName: string; age: number }

const staffColumns = [
  { field: 'firstName', header: 'First name', width: 180 },
  { field: 'age', header: 'Age', width: 90 },
]

/** The props object is the `$state` proxy itself; a spread would snapshot it. */
function pushProps(rows: Staff[]) {
  const props = $state({
    data: rows,
    columns: staffColumns,
    containerHeight: 400,
    virtualization: false,
  })
  return props
}

function mountGrid(props: ReturnType<typeof pushProps>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const app = mount(SvGrid, { target, props: props as never })
  flushSync()
  const names = () =>
    Array.from(
      target.querySelectorAll('tbody.sv-grid-body tr.sv-grid-row:not(.sv-grid-row-spacer)'),
    ).map((tr) => tr.querySelector('.sv-grid-cell:not(.sv-grid-selection-cell)')?.textContent?.trim())
  return {
    names,
    done() {
      unmount(app)
      target.remove()
    },
  }
}

describe('data array length changes', () => {
  it('renders the rows it was given', () => {
    const rows = $state<Staff[]>([
      { id: '1', firstName: 'Ada', age: 36 },
      { id: '2', firstName: 'Linus', age: 54 },
    ])
    const g = mountGrid(pushProps(rows))
    expect(g.names()).toEqual(['Ada', 'Linus'])
    g.done()
  })

  it('push onto the $state array adds the row (the docs "Add row" button)', () => {
    const rows = $state<Staff[]>([
      { id: '1', firstName: 'Ada', age: 36 },
      { id: '2', firstName: 'Linus', age: 54 },
    ])
    const g = mountGrid(pushProps(rows))

    rows.push({ id: '3', firstName: 'New', age: 0 })
    flushSync()

    expect(g.names()).toEqual(['Ada', 'Linus', 'New'])
    g.done()
  })

  it('splice off the $state array removes the row', () => {
    const rows = $state<Staff[]>([
      { id: '1', firstName: 'Ada', age: 36 },
      { id: '2', firstName: 'Linus', age: 54 },
    ])
    const g = mountGrid(pushProps(rows))

    rows.splice(0, 1)
    flushSync()

    expect(g.names()).toEqual(['Linus'])
    g.done()
  })
})
