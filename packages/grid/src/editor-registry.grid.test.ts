/**
 * Integration test for the cell-editor registry wiring in SvGrid.svelte: a
 * component registered via `registerCellEditor` is actually mounted when a cell
 * of that custom `editorType` starts editing.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import SvRating from './SvRating.svelte'
import {
  registerCellEditor,
  unregisterCellEditor,
  createCoreRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  sortFns,
  tableFeatures,
  columnFilteringFeature,
  rowSortingFeature,
} from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: number; name: string; score: number }

const features = tableFeatures({ columnFilteringFeature, rowSortingFeature })
const rows: Row[] = [
  { id: 1, name: 'Ada', score: 3 },
  { id: 2, name: 'Alan', score: 5 },
]
const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'name', header: 'Name', width: 200, editorType: 'text' },
  // Custom editor type resolved through the registry:
  { field: 'score', header: 'Score', width: 160, editorType: 'stars' },
]

const tick = () => new Promise<void>((r) => queueMicrotask(r))

function mountGrid() {
  return new Promise<{ api: SvGridApi<typeof features, Row>; target: HTMLElement; destroy: () => void }>(
    (res, rej) => {
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
            paginatedRowModel: createPaginatedRowModel(),
          },
          rowHeight: 36,
          containerHeight: 300,
          virtualization: false,
          enableInlineEditing: true,
          onApiReady(api: SvGridApi<typeof features, Row>) {
            res({ api, target, destroy: () => { unmount(app); target.remove() } })
          },
        } as any,
      })
      queueMicrotask(() => rej.length && undefined)
    },
  )
}

afterEach(() => {
  unregisterCellEditor('stars')
})

describe('registry wiring in SvGrid', () => {
  it('mounts a registered component when a custom-editorType cell edits', async () => {
    let committed: unknown = undefined
    registerCellEditor('stars', {
      component: SvRating,
      props: (ctx) => ({
        value: ctx.value,
        onChange: (v: number) => ctx.onCommit(v),
      }),
    })

    const { api, target, destroy } = await mountGrid()
    try {
      api.startEditing(0, 'score')
      await tick()
      await tick()
      // The registered SvRating editor is mounted in the editing overlay.
      const rating = target.querySelector('.sv-rating')
      expect(rating).not.toBeNull()
      void committed
    } finally {
      destroy()
    }
  })
})
