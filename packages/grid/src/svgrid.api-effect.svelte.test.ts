/**
 * The api's sort and group setters called from a consumer's `$effect` (a
 * sort menu bound to state, as the gallery demos do): they read grid state as
 * they write it, and without `untrack` that read made the effect depend on
 * what it wrote - an update loop ("effect_update_depth_exceeded").
 */
import { describe, expect, it } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'

type Row = { id: number; name: string; team: string }
const data: Row[] = [
  { id: 1, name: 'Cleo', team: 'B' },
  { id: 2, name: 'Ana', team: 'A' },
  { id: 3, name: 'Ben', team: 'A' },
]

describe('api setters inside an effect', () => {
  it('setSort, clearSort and setGroupBy settle instead of looping', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    let api: any = null
    const app = mount(SvGrid, {
      target,
      props: {
        data,
        columns: [
          { field: 'name', header: 'Name' },
          { field: 'team', header: 'Team' },
        ],
        getRowId: (r: Row) => String(r.id),
        sortable: true,
        containerHeight: 300,
        onApiReady: (a: unknown) => (api = a),
      } as never,
    })
    flushSync()
    const sort = $state({ by: 'name', group: false })
    const stop = $effect.root(() => {
      $effect(() => {
        if (!api) return
        if (sort.by) api.setSort(sort.by, 'asc')
        else api.clearSort()
        api.setGroupBy(sort.group ? ['team'] : [])
      })
    })
    try {
      flushSync()
      expect(api.getDisplayedRows().map((r: Row) => r.name)).toEqual(['Ana', 'Ben', 'Cleo'])
      sort.by = ''
      flushSync()
      expect(api.getState().sorting).toEqual([])
      sort.group = true
      flushSync()
      expect(api.getState().grouping).toEqual(['team'])
    } finally {
      stop()
      unmount(app)
      target.remove()
    }
  })
})
