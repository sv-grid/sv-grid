/**
 * The FREE half of the Gantt view: the `gantt` prop, what the grid hands the
 * renderer, and what shows when no Enterprise renderer is registered.
 *
 * The renderer itself is Pro and lives behind `registerGanttView`, so most of
 * this suite deliberately never registers one - it asserts the upsell path.
 * The last block registers a STUB renderer to pin the seam's contract: which
 * props the grid passes, and that the rows arrive already filtered. The real
 * renderer is covered by `gantt.dom.test.ts` in @svgrid/enterprise.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  createCoreRowModel,
  columnFilteringFeature,
  hasGanttView,
  registerGanttView,
  rowSortingFeature,
  tableFeatures,
} from './index'
import { getGanttView } from './gantt-view.svelte'
import GanttStub from './gantt-stub.test.svelte'
import type { ColumnDef, GanttConfig, SvGridApi } from './index'

type Task = { id: number; name: string; start: string; end: string; parentId: number | null }
const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
const rows: Task[] = [
  { id: 1, name: 'Discovery', start: '2026-09-01', end: '2026-09-10', parentId: null },
  { id: 2, name: 'Interviews', start: '2026-09-01', end: '2026-09-04', parentId: 1 },
  { id: 3, name: 'Build', start: '2026-09-10', end: '2026-09-30', parentId: null },
]
const cols: ColumnDef<typeof features, Task>[] = [
  { field: 'name', header: 'Task', width: 180 },
  { field: 'start', header: 'Start', width: 120 },
  { field: 'end', header: 'End', width: 120 },
]
const gantt: GanttConfig<typeof features, Task> = {
  startField: 'start',
  endField: 'end',
  parentField: 'parentId',
}

const tick = () => new Promise<void>((r) => setTimeout(r))
const UPSELL = '.sv-grid-gantt-upsell'

afterEach(() => {
  // The seam is module-level state; a stub left registered would make every
  // later "no renderer" assertion pass for the wrong reason.
  registerGanttView(null as never)
  document.body.innerHTML = ''
})

function mountGrid(extra: Record<string, unknown> = {}) {
  return new Promise<{ api: SvGridApi<typeof features, Task>; target: HTMLElement; destroy: () => void }>(
    (res, rej) => {
      const target = document.createElement('div')
      document.body.appendChild(target)
      const app = mount(SvGrid, {
        target,
        props: {
          data: rows,
          columns: cols,
          features,
          _rowModels: { coreRowModel: createCoreRowModel() },
          getRowId: (r: Task) => String(r.id),
          containerHeight: 260,
          virtualization: false,
          gantt,
          onApiReady(api: SvGridApi<typeof features, Task>) {
            res({ api, target, destroy: () => { unmount(app); target.remove() } })
          },
          ...extra,
        } as any,
      })
      queueMicrotask(() => {
        if (!target.querySelector('.sv-grid-gantt-root')) rej(new Error('no gantt root'))
      })
    },
  )
}

describe('gantt - without the Enterprise renderer', () => {
  it('reports that no renderer is registered', () => {
    // If this is ever true here, the suite is testing the Pro path by accident
    // and every assertion below is meaningless.
    expect(hasGanttView()).toBe(false)
  })

  it('renders the upsell note in place of the table', async () => {
    const { target, destroy } = await mountGrid()
    await tick()

    const note = target.querySelector(UPSELL)!
    expect(note).not.toBeNull()
    expect(note.getAttribute('role')).toBe('note')
    expect(note.textContent).toContain('@svgrid/enterprise')
    expect(note.textContent).toContain('enableGanttView()')
    // The table is replaced, not decorated - this is a view of the grid.
    expect(target.querySelector('[role="grid"]')).toBeNull()
    destroy()
  })

  it('says a license is needed, and links to it', async () => {
    // Naming the package is what unblocks a developer trying it; saying a key
    // is needed is what they have to know before shipping. Enterprise is
    // SOFT-gated, so the wording must not imply the feature is inert without
    // one - it says "watermark", which is what actually happens.
    const { target, destroy } = await mountGrid()
    await tick()

    const license = target.querySelector('.sv-grid-upsell-license')!
    expect(license).not.toBeNull()
    expect(license.textContent).toContain('license key')
    expect(license.textContent).toContain('watermark')

    const link = license.querySelector('a')!
    expect(link.getAttribute('href')).toBe('https://svgrid.com/pricing/')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    destroy()
  })

  it('shows the search box, and hides it on `searchable: false`', async () => {
    const withBox = await mountGrid()
    await tick()
    const input = withBox.target.querySelector<HTMLInputElement>('.sv-grid-board-search input')!
    expect(input).not.toBeNull()
    expect(input.placeholder).toBe('Search tasks...')
    withBox.destroy()

    const without = await mountGrid({ gantt: { ...gantt, searchable: false } })
    await tick()
    expect(without.target.querySelector('.sv-grid-board-search')).toBeNull()
    without.destroy()
  })

  it('is localizable, like the rest of the grid chrome', async () => {
    const { target, destroy } = await mountGrid({
      localization: {
        text: { ganttUpsellTitle: 'Gantt-Ansicht', upsellLicense: 'Lizenz erforderlich.' },
      },
    })
    await vi.waitFor(() => {
      expect(target.querySelector(UPSELL)?.textContent).toContain('Gantt-Ansicht')
      expect(target.querySelector('.sv-grid-upsell-license')?.textContent).toContain(
        'Lizenz erforderlich.',
      )
    })
    destroy()
  })
})

describe('gantt - the renderer seam', () => {
  // GanttStub stands in for @svgrid/enterprise's SvGridGantt: it writes every
  // prop it receives into the DOM, so the grid's half of the contract is what
  // those attributes say.
  const stub = () => document.querySelector<HTMLElement>('.gantt-stub')!

  it('mounts the registered renderer instead of the upsell', async () => {
    registerGanttView(GanttStub as never)
    expect(hasGanttView()).toBe(true)
    expect(getGanttView()).not.toBeNull()

    const { target, destroy } = await mountGrid()
    await tick()
    expect(target.querySelector(UPSELL)).toBeNull()
    expect(target.querySelector('.gantt-stub')).not.toBeNull()
    destroy()
  })

  it('hands it data, columns, the config and getRowId', async () => {
    registerGanttView(GanttStub as never)
    const { destroy } = await mountGrid()
    await tick()

    expect(stub().dataset.ids).toBe('1,2,3')
    expect(stub().dataset.cols).toBe(String(cols.length))
    expect(stub().dataset.start).toBe('start')
    expect(stub().dataset.parent).toBe('parentId')
    expect(stub().dataset.hasGetRowId).toBe('true')
    destroy()
  })

  it("hands it the grid's FILTERED rows, so the search box flows through", async () => {
    // This is what makes the Gantt a view of the grid rather than a second
    // data path: the renderer never filters, it just draws what it is given.
    registerGanttView(GanttStub as never)
    const { target, destroy } = await mountGrid()
    await tick()

    const search = target.querySelector<HTMLInputElement>('.sv-grid-board-search input')!
    search.value = 'Interviews'
    search.dispatchEvent(new Event('input', { bubbles: true }))

    await vi.waitFor(() => expect(stub().dataset.ids).toBe('2'))
    destroy()
  })
})
