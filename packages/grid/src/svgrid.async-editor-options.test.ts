/**
 * Async `editorOptions` (#18): an option list that arrives from the server.
 *
 * Render paths call the option resolver synchronously and often, so an async
 * source cannot block. The first call starts the fetch and returns an empty
 * list; the resolved value lands in reactive state and re-renders the open
 * editor. In-flight keys are tracked so repeated renders do not refire the
 * request, and so the dropdown can say "Loading…" rather than "No options",
 * which would read as "nothing to pick".
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  createCoreRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  sortFns,
  tableFeatures,
  rowSortingFeature,
} from './index'

type Row = { id: number; country: string; city: string }

const data: Row[] = [
  { id: 1, country: 'FR', city: 'Paris' },
  { id: 2, country: 'JP', city: 'Osaka' },
]

const tick = () => new Promise<void>((r) => queueMicrotask(r))
// The list editors lazy-load `SvGridDropdown` with a dynamic import, so
// microtasks alone never get it mounted - the settle has to yield the macrotask
// queue too, and then again for the resolved options to re-render.
const settle = async () => {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((r) => setTimeout(r, 0))
    await tick()
  }
}

function mountGrid(columns: unknown[]) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let api: never = null as never
  const app = mount(SvGrid, {
    target,
    props: {
      data,
      columns,
      features: tableFeatures({ rowSortingFeature }),
      editable: true,
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

/** Open the editor for row 0 of `columnId` through the public api. */
async function openEditor(api: never, columnId: string) {
  ;(api as never as { startEditing: (r: number, c: string) => boolean }).startEditing(0, columnId)
  await settle()
}

describe('async editorOptions (#18)', () => {
  it('resolves a promised option list and renders it', async () => {
    const columns = [
      { field: 'country', header: 'Country', width: 120 },
      {
        field: 'city',
        header: 'City',
        width: 160,
        editorType: 'select',
        editorOptions: Promise.resolve(['Paris', 'Lyon', 'Osaka']),
      },
    ]
    const g = mountGrid(columns)
    cleanup = g.destroy
    await settle()
    await openEditor(g.getApi(), 'city')
    expect(document.body.textContent).toContain('Lyon')
  })

  it('fetches once no matter how many times render asks', async () => {
    const source = vi.fn(async () => ['a', 'b'])
    const columns = [
      { field: 'country', header: 'Country', width: 120 },
      {
        field: 'city',
        header: 'City',
        width: 160,
        editorType: 'select',
        editorOptions: source(),
      },
    ]
    const g = mountGrid(columns)
    cleanup = g.destroy
    await settle()
    await openEditor(g.getApi(), 'city')
    await settle()
    // The promise was created once; the resolver must not re-await per render.
    expect(source).toHaveBeenCalledTimes(1)
  })

  it('calls a per-row async source ONCE per row, not once per render', async () => {
    // The resolver runs inside the template, so calling an async source on
    // every render fires a real request per render - and any state the source
    // touches gets mutated mid-render, which Svelte rejects outright. Reported
    // from the demo as `state_unsafe_mutation`.
    const calls: number[] = []
    const columns = [
      { field: 'country', header: 'Country', width: 120 },
      {
        field: 'city',
        header: 'City',
        width: 160,
        editorType: 'select',
        editorOptions: (row: Row) => {
          calls.push(row.id)
          return Promise.resolve(['Paris', 'Lyon'])
        },
      },
    ]
    const g = mountGrid(columns)
    cleanup = g.destroy
    await settle()
    await openEditor(g.getApi(), 'city')
    await settle()
    const afterOpen = calls.length
    expect(afterOpen).toBeGreaterThan(0)
    // Force real re-render passes while the editor is open. Each one used to
    // re-invoke the source and start another request, which in a browser
    // becomes an endless fetch loop as every resolution re-renders.
    const api = g.getApi() as never as {
      setOption: (k: string, v: unknown) => void
    }
    for (const zebra of [true, false, true]) {
      api.setOption('zebraRows', zebra)
      await settle()
    }
    expect(calls.length).toBe(afterOpen)
  })

  it('refetches a cascade when the row it depends on changes', async () => {
    // A cascade is a function of the row's OTHER cells. Keying the cache by row
    // id alone made the first result permanent - changing Country left the old
    // city list in place forever.
    const asked: string[] = []
    const columns = [
      { field: 'country', header: 'Country', width: 120 },
      {
        field: 'city',
        header: 'City',
        width: 160,
        editorType: 'select',
        editorOptions: (row: Row) => {
          asked.push(row.country)
          return Promise.resolve(row.country === 'FR' ? ['Paris', 'Lyon'] : ['Osaka', 'Kyoto'])
        },
      },
    ]
    const g = mountGrid(columns)
    cleanup = g.destroy
    await settle()
    const api = g.getApi() as never as {
      startEditing: (r: number, c: string) => boolean
      stopEditing: (cancel?: boolean) => boolean
      setCellValue: (r: number, c: string, v: unknown) => void
    }

    await openEditor(api as never, 'city')
    expect(document.body.textContent).toContain('Lyon')
    api.stopEditing(true)
    await settle()

    // Row 0 moves from FR to JP.
    api.setCellValue(0, 'country', 'JP')
    await settle()

    await openEditor(api as never, 'city')
    expect(asked).toContain('JP')
    expect(document.body.textContent).toContain('Kyoto')
    expect(document.body.textContent).not.toContain('Lyon')
  })

  it('resolves a per-row (cascading) async source', async () => {
    const columns = [
      { field: 'country', header: 'Country', width: 120 },
      {
        field: 'city',
        header: 'City',
        width: 160,
        editorType: 'select',
        editorOptions: (row: Row) =>
          Promise.resolve(row.country === 'FR' ? ['Paris', 'Lyon'] : ['Osaka', 'Kyoto']),
      },
    ]
    const g = mountGrid(columns)
    cleanup = g.destroy
    await settle()
    await openEditor(g.getApi(), 'city')
    // Row 1 is FR - it must not be offered the JP list.
    expect(document.body.textContent).toContain('Lyon')
    expect(document.body.textContent).not.toContain('Kyoto')
  })

  it('falls back to an empty list when the source rejects', async () => {
    const rejected = Promise.reject(new Error('offline'))
    rejected.catch(() => {}) // keep the reporter clean; the grid attaches its own handler
    const columns = [
      { field: 'country', header: 'Country', width: 120 },
      {
        field: 'city',
        header: 'City',
        width: 160,
        editorType: 'select',
        editorOptions: rejected,
      },
    ]
    const g = mountGrid(columns)
    cleanup = g.destroy
    await settle()
    await openEditor(g.getApi(), 'city')
    await settle()
    // The editor must settle on "No options", never spin forever.
    expect(document.body.textContent).toContain('No options')
  })

  it('exposes refreshEditorOptions on the api', async () => {
    const columns = [
      { field: 'country', header: 'Country', width: 120 },
      { field: 'city', header: 'City', width: 160 },
    ]
    const g = mountGrid(columns)
    cleanup = g.destroy
    await settle()
    const api = g.getApi() as never as { refreshEditorOptions: (c?: string) => void }
    expect(typeof api.refreshEditorOptions).toBe('function')
    expect(() => api.refreshEditorOptions('city')).not.toThrow()
    expect(() => api.refreshEditorOptions()).not.toThrow()
  })

  it('leaves a plain array source synchronous', async () => {
    const columns = [
      { field: 'country', header: 'Country', width: 120 },
      {
        field: 'city',
        header: 'City',
        width: 160,
        editorType: 'select',
        editorOptions: ['Paris', 'Lyon'],
      },
    ]
    const g = mountGrid(columns)
    cleanup = g.destroy
    await settle()
    await openEditor(g.getApi(), 'city')
    expect(document.body.textContent).toContain('Lyon')
  })
})
