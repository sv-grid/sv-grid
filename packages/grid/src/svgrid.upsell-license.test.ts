/**
 * Every Enterprise gate carries the same licensing line.
 *
 * There are four of them - Kanban board, scheduler, pivot mode and the
 * selection bar - and they used to be four hand-written paragraphs. Four gates
 * worded four ways is how a product ends up explaining its own licensing
 * inconsistently, so they now share one snippet. This is the test that keeps
 * them sharing it: a fifth Enterprise feature that hand-rolls its own note
 * will show up here as a missing licensing line.
 *
 * None of the renderers are registered in this file, which is the point - it
 * asserts what a FREE grid shows.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount, unmount } from 'svelte'
import SvGrid from './SvGrid.svelte'
import {
  createCoreRowModel,
  hasBoardView,
  hasSchedulerView,
  hasSelectionBarView,
  tableFeatures,
} from './index'
import type { ColumnDef, SvGridApi } from './index'

type Row = { id: number; name: string; team: string; score: number }
const features = tableFeatures({})
const rows: Row[] = [
  { id: 1, name: 'Ada', team: 'A', score: 3 },
  { id: 2, name: 'Grace', team: 'B', score: 5 },
]
const cols: ColumnDef<typeof features, Row>[] = [
  { field: 'name', header: 'Name', width: 140 },
  { field: 'team', header: 'Team', width: 120 },
  { field: 'score', header: 'Score', width: 100 },
]

const tick = () => new Promise<void>((r) => setTimeout(r))
const LICENSE = '.sv-grid-upsell-license'

function mountGrid(extra: Record<string, unknown>) {
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
          _rowModels: { coreRowModel: createCoreRowModel() },
          getRowId: (r: Row) => String(r.id),
          containerHeight: 260,
          virtualization: false,
          onApiReady(api: SvGridApi<typeof features, Row>) {
            res({ api, target, destroy: () => { unmount(app); target.remove() } })
          },
          ...extra,
        } as any,
      })
      queueMicrotask(() => { if (!target.querySelector('[role="grid"]')) rej(new Error('no grid')) })
    },
  )
}

describe('Enterprise upsell notes', () => {
  it('starts from a grid with no Pro renderer registered', () => {
    // Otherwise every assertion below is checking the wrong branch.
    expect(hasBoardView()).toBe(false)
    expect(hasSchedulerView()).toBe(false)
    expect(hasSelectionBarView()).toBe(false)
  })

  const gates: Array<[string, Record<string, unknown>, ((api: SvGridApi<typeof features, Row>) => void)?]> = [
    ['Kanban board', { board: { groupBy: 'team' } }],
    ['scheduler', { scheduler: { startField: 'name' } }],
    ['selection bar', { showRowSelection: true, selectionBar: true }, (api) => api.selectRows(['1'])],
    // pivotViewOn = a pivot config AND pivot mode on; without the Pro engine
    // `pivotResult` stays null and the upsell renders in its place.
    ['pivot mode', { pivot: { rows: ['team'], values: [{ field: 'score', agg: 'sum' }] }, pivotMode: true }],
  ]

  for (const [name, props, activate] of gates) {
    it(`the ${name} gate explains the licensing`, async () => {
      const { api, target, destroy } = await mountGrid(props)
      try {
        await tick()
        activate?.(api)
        await vi.waitFor(() => {
          expect(target.querySelector(LICENSE), `${name} upsell`).not.toBeNull()
        })

        const note = target.querySelector(LICENSE)!
        // Soft-gated: the feature runs without a key and the grid watermarks.
        // The wording must not imply it is inert, because it is not.
        expect(note.textContent, name).toContain('license key')
        expect(note.textContent, name).toContain('watermark')
        expect(note.querySelector('a')?.getAttribute('href'), name).toBe(
          'https://svgrid.com/pricing/',
        )
      } finally {
        destroy()
      }
    })
  }

  it('says nothing about licensing on a grid using no Pro feature', async () => {
    const { target, destroy } = await mountGrid({})
    try {
      await tick()
      expect(target.querySelector(LICENSE)).toBeNull()
    } finally {
      destroy()
    }
  })
})
