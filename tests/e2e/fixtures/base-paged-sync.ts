/**
 * A base on a paged table whose reads the spec can fail, with a feed the spec drives
 * (base-paged-sync.spec.ts). Not a demo: the spec loads it into a page itself.
 *
 * `show({ grouped, count })` mounts one base: Tasks (paged, read a block at a time from
 * the page's own records) and Notes (held in the page). Grouped, its first view groups by
 * Kind. `window.__paged` holds `store` (the records, which a teammate changes), `send`
 * (the feed: nothing to read again, or the changes), `fail` (every read fails) and
 * `failFrom` (reads from that row on fail), and `reads` (each read's first row).
 */
import { mount } from 'svelte'
import '../../../examples/src/gallery-license'
import { SvBase, baseSource, enableBase, queryRecords, type BaseTable } from '@svgrid/enterprise/base'

type Row = Record<string, unknown>
enableBase()

const KINDS = ['Bug', 'Chore', 'Feature']

export function show(o: { grouped?: boolean; count?: number } = {}): void {
  document.body.replaceChildren()
  const columns = [
    { id: 'name', field: 'name', header: 'Task', width: 160, fieldType: 'text' },
    { id: 'note', field: 'note', header: 'Note', width: 200, fieldType: 'text' },
    { id: 'kind', field: 'kind', header: 'Kind', width: 140, fieldType: 'text' },
  ]
  const store: Row[] = Array.from({ length: o.count ?? 600 }, (_, i) => ({ id: `r${i}`, name: `Task ${i}`, note: `n${i}`, kind: KINDS[i % 3] }))
  let tell: (changes?: unknown) => void = () => {}
  const paged = { store, fail: false, failFrom: -1, reads: [] as number[], send: (changes?: unknown) => tell(changes) }
  ;(window as unknown as { __paged: typeof paged }).__paged = paged
  const ds = {
    async getRows(req: { startRow: number }) {
      paged.reads.push(req.startRow)
      await new Promise((r) => setTimeout(r, 20))
      if (paged.fail || (paged.failFrom >= 0 && req.startRow >= paged.failFrom)) throw new Error('500 Internal Server Error')
      return queryRecords([{ id: 'tasks', columns, data: store } as never], 'tasks', req as never)
    },
    async updateRow(id: string, patch: Row) {
      const r = store.find((x) => x.id === id)!
      Object.assign(r, patch)
      return { ...r }
    },
    async deleteRow(id: string) {
      const i = store.findIndex((x) => x.id === id)
      if (i >= 0) store.splice(i, 1)
    },
  }
  const views = [{ id: 'grid', name: 'All tasks', type: 'grid' }, { id: 'kind', name: 'By kind', type: 'grid', state: { grouping: ['kind'] } }]
  const tables = [
    {
      id: 'tasks', name: 'Tasks of the quarterly planning board', primaryField: 'name', columns, data: [],
      views: o.grouped ? [views[1], views[0]] : views,
      source: baseSource(ds as never, { serverRows: { blockSize: 100 }, realtime: (apply) => ((tell = apply as never), () => {}) }),
    },
    { id: 'notes', name: 'Notes', primaryField: 'name', columns: [columns[0]], data: [{ id: 'x1', name: 'One' }] },
  ] as unknown as BaseTable[]
  const box = document.createElement('div')
  box.style.cssText = 'height:100vh;display:flex;flex-direction:column'
  document.body.append(box)
  const state = { tables }
  mount(SvBase as never, {
    target: box,
    props: {
      get tables() { return state.tables },
      set tables(v: BaseTable[]) { state.tables = v },
      editable: true,
      containerHeight: 640,
    },
  })
}
