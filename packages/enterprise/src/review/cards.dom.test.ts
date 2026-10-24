/**
 * Pending proposals on board and gallery cards: the card renderers find the
 * review through the grid's getRowId and show "N proposed".
 */
import { describe, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { enableBoardView } from '../board'
import { enableGalleryView } from '../gallery'
import { enableSchedulerView } from '../scheduler'
import Harness from './test-fixtures/ReviewHarness.svelte'
import type { Review } from './model.svelte'

enableBoardView()
enableGalleryView()
enableSchedulerView()
if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
}

const initial = [
  { id: 'a', name: 'Acme', region: 'AMER', stage: 'Lead', due: '2026-10-12' },
  { id: 'b', name: 'Globex', region: 'EMEA', stage: 'Won', due: '2026-10-20' },
]
const columns = [
  { field: 'name', header: 'Name' },
  { field: 'region', header: 'Region' },
  { field: 'stage', header: 'Stage' },
]

async function setup(extra: Record<string, unknown>) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let h!: { review: Review<any>; api: any }
  const app = mount(Harness, { target, props: { initial, columns, extra, onReady: (x: typeof h) => (h = x) } })
  await vi.waitFor(() => expect(h).toBeDefined())
  return { ...h, target, destroy: () => { unmount(app); target.remove() } }
}

describe('card marks', () => {
  it('a board card shows how many proposals its row has, and goes back to plain when they are decided', async () => {
    const { review, target, destroy } = await setup({ board: { groupBy: 'stage', titleField: 'name' } })
    review.add({ source: { kind: 'agent', id: 'x', label: 'X' }, proposals: [
      { rowId: 'a', field: 'region', before: 'AMER', after: 'EMEA' },
      { rowId: 'a', field: 'name', before: 'Acme', after: 'Acme Inc' },
    ] })
    flushSync()
    await vi.waitFor(() => expect(target.querySelectorAll('.sv-card-proposed')).toHaveLength(1))
    const mark = target.querySelector('.sv-card-proposed')!
    expect(mark.textContent).toContain('2 proposed')
    expect(mark.getAttribute('title')).toBe('Region → "EMEA", Name → "Acme Inc"')
    review.reject(review.pending().map((p) => p.id))
    flushSync()
    await vi.waitFor(() => expect(target.querySelectorAll('.sv-card-proposed')).toHaveLength(0))
    destroy()
  })

  it('a gallery card shows the same mark', async () => {
    const { review, target, destroy } = await setup({ gallery: { titleField: 'name', cardFields: ['region'] } })
    review.add({ source: { kind: 'agent', id: 'x', label: 'X' }, proposals: [{ rowId: 'b', field: 'region', before: 'EMEA', after: 'APAC' }] })
    flushSync()
    await vi.waitFor(() => expect(target.querySelector('.sv-card-proposed')?.textContent).toContain('1 proposed'))
    destroy()
  })

  it('a calendar event shows a dot with the same count and values', async () => {
    const { review, target, destroy } = await setup({
      scheduler: { startField: 'due', titleField: 'name', initialView: 'month', initialDate: '2026-10-01' },
    })
    review.add({ source: { kind: 'agent', id: 'x', label: 'X' }, proposals: [{ rowId: 'a', field: 'region', before: 'AMER', after: 'EMEA' }] })
    flushSync()
    await vi.waitFor(() => expect(target.querySelector('.sv-sched-proposed')).not.toBeNull())
    expect(target.querySelector('.sv-sched-proposed')!.getAttribute('title')).toBe('1 proposed: Region → "EMEA"')
    destroy()
  })
})

it('two grids sharing one getRowId function each show only their own marks', async () => {
  const one = await setup({ board: { groupBy: 'stage', titleField: 'name' } })
  const two = await setup({ board: { groupBy: 'stage', titleField: 'name' } })
  one.review.add({ source: { kind: 'agent', id: 'x', label: 'X' }, proposals: [{ rowId: 'a', field: 'region', before: 'AMER', after: 'EMEA' }] })
  flushSync()
  await vi.waitFor(() => expect(one.target.querySelectorAll('.sv-card-proposed')).toHaveLength(1))
  expect(two.target.querySelectorAll('.sv-card-proposed')).toHaveLength(0)
  one.destroy()
  two.destroy()
})
