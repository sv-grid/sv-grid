/**
 * Change review in SvGrid Base (the fields module turned on): the proposed
 * value is drawn in field-type columns whose type draws no cell of its own,
 * and an accept does what an edit does there: "last modified" fields are
 * stamped and the record's activity credits the change.
 *
 * A file of its own: enableFields() registers module-wide.
 */
import { describe, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import { enableFields, setCurrentUser, setFieldUsers } from '../fields/index'
import { changesOf } from '../fields/activity.svelte'
import { gridOf } from '../fields/grid-access'
import { canGhost } from './ghost'
import type { Review } from './model.svelte'
import BaseHarness from './test-fixtures/BaseHarness.svelte'

enableFields()
if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
}

const AGENT = { kind: 'agent' as const, id: 'crm', label: 'CRM agent' }

describe('canGhost with field types', () => {
  it('wraps a type that draws no cell of its own, never one that does', () => {
    expect(canGhost({ field: 'name', fieldType: 'text' })).toBe(true)
    expect(canGhost({ field: 'status', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Open' }] } })).toBe(false)
    expect(canGhost({ field: 'mail', fieldType: 'email' })).toBe(false)
    expect(canGhost({ field: 'done', fieldType: 'checkbox' })).toBe(false)
  })
})

type Row = { id: string; name: string; status: string; updatedBy?: string }

async function mountBase(withApplied = true) {
  setFieldUsers([{ id: 'u-dana', name: 'Dana' }])
  setCurrentUser({ id: 'u-dana', name: 'Dana' })
  const target = document.createElement('div')
  document.body.appendChild(target)
  const initial: Row[] = [
    { id: 'r1', name: '  Acme', status: 'Open' },
    { id: 'r2', name: 'Globex', status: 'Open' },
  ]
  const columns = [
    { field: 'name', header: 'Name', fieldType: 'text' },
    { field: 'status', header: 'Status', fieldType: 'singleSelect', fieldProps: { options: [{ value: 'Open' }, { value: 'Closed' }] } },
    { field: 'updatedBy', header: 'Updated by', fieldType: 'lastModifiedBy' },
  ]
  let h!: { review: Review<Row>; api: any; rows: () => Row[] }
  const app = mount(BaseHarness, { target, props: { initial, columns, withApplied, onReady: (x: typeof h) => (h = x) } })
  await vi.waitFor(() => expect(h).toBeDefined())
  return { ...h, api: () => h.api, target, destroy: () => { unmount(app); target.remove() } }
}

describe('in a grid with field types', () => {
  it('draws the proposal in a text field; a select keeps its own cell and gets the tint', async () => {
    const { review, target, destroy } = await mountBase()
    review.add({ source: AGENT, proposals: [
      { rowId: 'r1', field: 'name', before: '  Acme', after: 'Acme' },
      { rowId: 'r2', field: 'status', before: 'Open', after: 'Closed' },
    ] })
    flushSync()
    await vi.waitFor(() => expect(target.querySelector('.sv-review-ghost')).not.toBeNull())
    const nameCell = target.querySelector('[data-col-id="name"] .sv-review-ghost')!
    expect(nameCell.textContent!.replace(/\s+/g, ' ').trim()).toBe('Acme ··Acme')
    // The select is drawn by its field type, not wrapped.
    expect(target.querySelector('[data-col-id="status"] .sv-review-ghost')).toBeNull()
    destroy()
  })

  it('an accept stamps last-modified-by and credits the activity to the agent and the person', async () => {
    const { review, api, rows, destroy } = await mountBase()
    review.add({ source: AGENT, proposals: [{ rowId: 'r1', field: 'name', before: '  Acme', after: 'Acme' }] })
    await review.accept(review.pending().map((p) => p.id))
    expect(rows()[0]!.name).toBe('Acme')
    expect(rows()[0]!.updatedBy).toBe('u-dana')
    const activity = changesOf(gridOf(api()), 'r1')
    expect(activity.at(-1)).toMatchObject({ by: 'u-dana', via: 'CRM agent', columnId: 'name', value: 'Acme' })
    destroy()
  })

  it('without the hook an accept leaves Base bookkeeping alone', async () => {
    const { review, rows, destroy } = await mountBase(false)
    review.add({ source: AGENT, proposals: [{ rowId: 'r1', field: 'name', before: '  Acme', after: 'Acme' }] })
    await review.accept(review.pending().map((p) => p.id))
    expect(rows()[0]!.updatedBy).toBeUndefined()
    destroy()
  })
})

describe('rich cells', () => {
  it('a select keeps its own cell and shows the proposed value after it', async () => {
    const { review, target, destroy } = await mountBase()
    review.add({ source: AGENT, proposals: [{ rowId: 'r2', field: 'status', before: 'Open', after: 'Closed', reason: 'stale lead' }] })
    flushSync()
    const mark = await vi.waitFor(() => {
      const m = target.querySelector('[data-col-id="status"] .sv-review-cellmark')
      expect(m).not.toBeNull()
      return m!
    })
    expect(mark.textContent!.replace(/\s+/g, ' ').trim()).toBe('→ Closed')
    expect(mark.getAttribute('title')).toBe('CRM agent proposes Closed - stale lead')
    // The select still draws its own value next to the mark.
    expect(target.querySelector('[data-col-id="status"]')!.textContent).toContain('Open')
    review.reject(review.pending().map((p) => p.id))
    flushSync()
    await vi.waitFor(() => expect(target.querySelector('.sv-review-cellmark')).toBeNull())
    destroy()
  })

  it('a person field shows the proposed person by name, through the field formatter', async () => {
    const { review, target, destroy } = await mountBase()
    // mountBase sets the users; add the one the proposal names.
    setFieldUsers([{ id: 'u-dana', name: 'Dana' }, { id: 'u-lee', name: 'Lee Park' }])
    review.add({ source: AGENT, proposals: [{ rowId: 'r1', field: 'updatedBy', before: undefined, after: 'u-lee' }] })
    flushSync()
    await vi.waitFor(() => expect(target.querySelector('[data-col-id="updatedBy"] .sv-review-cellmark')?.textContent).toContain('Lee Park'))
    destroy()
  })
})
