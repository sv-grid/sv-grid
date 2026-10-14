/**
 * What a column change does to the scroll position.
 *
 * Adding, removing or reordering columns keeps the user where they were: the
 * reset used to key on the column COUNT, so adding a field from the "+" header
 * threw the view back to the first column. A replaced column set (no column in
 * common) is a new schema and still starts from the top-left.
 *
 * jsdom has no layout, so the container's scroll offsets are recorded through
 * an own property; what is checked is whether the grid writes 0 to them.
 */
import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'

type Row = { id: number; a: string; b: string; c: string }
const data: Row[] = [{ id: 1, a: 'x', b: 'y', c: 'z' }]

function setup() {
  const target = document.createElement('div')
  document.body.appendChild(target)
  const props = $state({
    data,
    columns: [
      { field: 'a', header: 'A', width: 150 },
      { field: 'b', header: 'B', width: 150 },
    ] as Array<Record<string, unknown>>,
    containerHeight: 300,
  })
  const app = mount(SvGrid, { target, props: props as never })
  flushSync()
  const sc = target.querySelector<HTMLElement>('.sv-grid-container')!
  const writes: Array<[string, number]> = []
  for (const key of ['scrollLeft', 'scrollTop'] as const) {
    let v = 120
    Object.defineProperty(sc, key, {
      configurable: true,
      get: () => v,
      set: (next: number) => {
        writes.push([key, next])
        v = next
      },
    })
  }
  return { props, sc, writes, done: () => (unmount(app), target.remove()) }
}

describe('column changes and the scroll position', () => {
  it('adding or removing a column keeps the scroll position', () => {
    const { props, sc, writes, done } = setup()
    props.columns = [...props.columns, { field: 'c', header: 'C', width: 150 }]
    flushSync()
    props.columns = props.columns.filter((c) => c.field !== 'a')
    flushSync()
    expect(writes.filter(([, v]) => v === 0)).toEqual([])
    expect(sc.scrollLeft).toBe(120)
    done()
  })

  it('a replaced column set starts from the top-left', () => {
    const { props, writes, done } = setup()
    props.columns = [{ field: 'c', header: 'C', width: 150 }]
    flushSync()
    expect(writes).toContainEqual(['scrollLeft', 0])
    expect(writes).toContainEqual(['scrollTop', 0])
    done()
  })
})
