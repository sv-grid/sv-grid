/**
 * End-to-end: after registerBuiltinEditors(), a column with editorType 'duration'
 * mounts SvDurationInput in the editing cell (proving the built-in registration +
 * the SvGrid registry wiring together).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  registerBuiltinEditors,
  unregisterCellEditor,
  registeredCellEditorTypes,
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

type Row = { id: number; task: string; estimate: number }

const features = tableFeatures({ columnFilteringFeature, rowSortingFeature })
const rows: Row[] = [
  { id: 1, task: 'Design', estimate: 90 },
  { id: 2, task: 'Build', estimate: 240 },
]
const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'task', header: 'Task', width: 200, editorType: 'text' },
  { field: 'estimate', header: 'Estimate', width: 160, editorType: 'duration' },
]


function mountGrid() {
  return new Promise<{ api: SvGridApi<typeof features, Row>; target: HTMLElement; destroy: () => void }>(
    (res) => {
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
    },
  )
}

afterEach(() => {
  for (const t of registeredCellEditorTypes()) unregisterCellEditor(t)
})

describe('registerBuiltinEditors in SvGrid', () => {
  it("mounts SvDurationInput for an editorType 'duration' cell", async () => {
    registerBuiltinEditors()
    const { api, target, destroy } = await mountGrid()
    try {
      api.startEditing(0, 'estimate')
      // SvGridCellEditor is a lazy chunk; poll instead of fixing a tick count.
      await vi.waitFor(() => expect(target.querySelector('.sv-dur__input')).not.toBeNull())
    } finally {
      destroy()
    }
  })
})
