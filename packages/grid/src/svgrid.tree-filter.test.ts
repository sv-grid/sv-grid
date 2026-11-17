/**
 * DOM: a filtered tree with `treeData.keepAncestors`. The filters test every
 * record, folded or not; a kept record stays under its parents, which come
 * back greyed as context (`__treeContext`) and are not counted. Footer totals
 * add up every record of the tree, folded or not, and never a context row.
 * Without `keepAncestors` nothing changes.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'

type Node = { id: number; managerId: number | null; name: string; hours: number }
const data: Node[] = [
  { id: 1, managerId: null, name: 'Ada', hours: 1 },
  { id: 2, managerId: 1, name: 'Grace', hours: 2 },
  { id: 3, managerId: 2, name: 'Alan', hours: 4 },
  { id: 4, managerId: 1, name: 'Linus', hours: 8 },
  { id: 5, managerId: null, name: 'Edsger', hours: 16 },
]
const columns = [
  { field: 'name', header: 'Name', width: 200 },
  { field: 'hours', header: 'Hours', width: 120, cellDataType: 'number' },
]

const tick = () => new Promise<void>((r) => setTimeout(r, 0))
let cleanup: (() => void) | null = null
afterEach(() => {
  cleanup?.()
  cleanup = null
})

function mountTree(keepAncestors: boolean, extra: Record<string, unknown> = {}) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api: any = null
  const app = mount(SvGrid, {
    target,
    props: {
      data,
      columns,
      treeData: { parentField: 'managerId', column: 'name', keepAncestors },
      containerHeight: 600,
      virtualization: false,
      onApiReady: (a: unknown) => (api = a),
      ...extra,
    } as never,
  })
  flushSync()
  host = target
  cleanup = () => {
    unmount(app)
    target.remove()
  }
  return { target, api: () => api }
}

// The rows on screen by name, a context row marked with "*".
let host: HTMLElement
const shown = (_api?: unknown) =>
  [...host.querySelectorAll('tbody tr.sv-grid-row')]
    .filter((r) => !r.classList.contains('sv-grid-row-spacer'))
    .map((r) => {
      const name = data.find((d) => r.textContent?.includes(d.name))?.name ?? '?'
      return `${name}${r.classList.contains('sv-grid-row-tree-context') ? '*' : ''}`
    })

describe('treeData keepAncestors', () => {
  it('keeps a match under its parents, greyed, folded as they were', async () => {
    const { target, api } = mountTree(true)
    await tick()
    api().setState({ globalFilter: 'Alan' })
    flushSync()
    await tick()
    // Ada is folded: the match is under it.
    expect(shown(api())).toEqual(['Ada*'])
    api().expandAllGroups()
    flushSync()
    await tick()
    expect(shown(api())).toEqual(['Ada*', 'Grace*', 'Alan'])
    expect(target.querySelectorAll('tr.sv-grid-row-tree-context')).toHaveLength(2)
    // The rows a reader exports are the records: the context rows are on screen only.
    expect(api().getDisplayedRows().map((r: Node) => r.name)).toEqual(['Alan'])
  })

  it('a match with children keeps only the children that match, or that lead to one', async () => {
    const { api } = mountTree(true)
    await tick()
    api().expandAllGroups()
    api().setState({ globalFilter: 'a' })
    flushSync()
    await tick()
    // Ada, Grace and Alan match; Linus and Edsger do not.
    expect(shown(api())).toEqual(['Ada', 'Grace', 'Alan'])
  })

  it('without keepAncestors a filter works as before', async () => {
    const { api } = mountTree(false)
    await tick()
    api().expandAllGroups()
    api().setState({ globalFilter: 'Alan' })
    flushSync()
    await tick()
    expect(shown(api())).toEqual(['Alan'])
  })

  it('footer totals add up every record, folded or not, and no context row', async () => {
    const { target, api } = mountTree(true, { showSummaryRow: true, summary: true })
    await tick()
    const footer = () => target.querySelector('.sv-grid-summary, tfoot')?.textContent?.replace(/\s+/g, ' ') ?? ''
    // Folded: only Ada and Edsger are on screen, but all five records are totalled.
    await new Promise((r) => setTimeout(r, 50))
    expect(footer()).toContain('31')
    api().setState({ globalFilter: 'Alan' })
    flushSync()
    await new Promise((r) => setTimeout(r, 50))
    expect(footer()).toContain('4')
    expect(footer()).not.toContain('7')
  })
})
