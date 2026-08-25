/**
 * Integration test for the cell-editor registry wiring in SvGrid.svelte: a
 * component registered via `registerCellEditor` is actually mounted when a cell
 * of that custom `editorType` starts editing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
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
      // The editor UI is a lazy chunk (SvGridCellEditor), so a fixed number of
      // ticks is a race - poll the same assertion until the import lands.
      await vi.waitFor(() => {
        // The registered SvRating editor is mounted in the editing overlay.
        expect(target.querySelector('.sv-rating')).not.toBeNull()
      })
    } finally {
      destroy()
    }
  })

  it('hands the editor the full EditorInteraction contract, not a subset', async () => {
    // The contract type used to be documented but never supplied: the registry
    // passed only value/onChange/onCommit/onCancel, so an editor written against
    // `EditorInteraction` (Tab-to-move, dismiss-without-commit, in-cell tuning)
    // silently got undefined for half of it.
    let seen: Record<string, unknown> = {}
    registerCellEditor('stars', {
      component: SvRating,
      props: (ctx) => {
        seen = ctx as unknown as Record<string, unknown>
        return { value: ctx.value }
      },
    })

    const { api, target, destroy } = await mountGrid()
    try {
      api.startEditing(0, 'score')
      // SvGridCellEditor is a lazy chunk; poll until it has mounted and run the
      // registration's props mapping.
      await vi.waitFor(() => expect(typeof seen.onCommit).toBe('function'))
      expect(typeof seen.onCommit).toBe('function')
      expect(typeof seen.onCancel).toBe('function')
      expect(typeof seen.onChange).toBe('function')
      expect(typeof seen.onCommitAndMove).toBe('function')
      expect(typeof seen.onRequestClose).toBe('function')
      expect(seen.inCell).toBe(true)
      expect(seen.rowId).toBeTruthy()
      expect(seen.columnId).toBe('score')
      void target
    } finally {
      destroy()
    }
  })

  it('defaults to passing the whole contract when a registration has no props mapping', async () => {
    // A registration with no `props` should still work for a contract-aware
    // editor - that is the point of the default mapping.
    registerCellEditor('stars', SvRating)
    const { api, target, destroy } = await mountGrid()
    try {
      api.startEditing(0, 'score')
      // SvGridCellEditor is a lazy chunk; poll rather than fixing a tick count.
      await vi.waitFor(() => expect(target.querySelector('.sv-rating')).not.toBeNull())
    } finally {
      destroy()
    }
  })
})
