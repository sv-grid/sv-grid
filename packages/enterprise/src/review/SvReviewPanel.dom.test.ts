/**
 * Change review in a real `<SvGrid>`: the tint and the proposed value drawn in
 * the cell, the panel's groups, an accept written through the app's data, and
 * one Ctrl+Z to undo it.
 */
import { describe, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import axe from 'axe-core'
import Harness from './test-fixtures/ReviewHarness.svelte'
import type { Review } from './model.svelte'
import type { ProposalSource } from './types'

if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
}

const AGENT: ProposalSource = { kind: 'agent', id: 'cleanup', label: 'Cleanup agent' }
const initial = [
  { id: 'a', name: '  Acme', region: '', done: false },
  { id: 'b', name: 'Globex ', region: 'EMEA', done: true },
  { id: 'c', name: 'Initech', region: '', done: false },
]
const columns = [
  { field: 'name', header: 'Name', width: 160, editable: true },
  { field: 'region', header: 'Region', width: 120 },
  { field: 'done', header: 'Done', width: 80 },
]

async function setup(confirmOver = 50) {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let h!: { review: Review<any>; api: any; rows: () => any[] }
  const app = mount(Harness, { target, props: { initial, columns, confirmOver, onReady: (x: typeof h) => (h = x) } })
  await vi.waitFor(() => expect(h).toBeDefined())
  return { ...h, target, destroy: () => { unmount(app); target.remove() } }
}

describe('SvReviewPanel in a grid', () => {
  it('draws the proposal in the cell, tints it, and lists groups risky-first', async () => {
    const { review, target, destroy } = await setup()
    review.add({
      source: AGENT,
      proposals: [
        { rowId: 'a', field: 'name', before: '  Acme', after: 'Acme' },
        { rowId: 'b', field: 'name', before: 'Globex ', after: 'Globex' },
        { rowId: 'a', field: 'region', before: '', after: 'AMER', confidence: 0.4 },
        { rowId: 'b', field: 'done', before: true, after: false },
      ],
    })
    flushSync()
    await vi.waitFor(() => expect(target.querySelector('.sv-review-ghost')).not.toBeNull())
    const ghosts = [...target.querySelectorAll('.sv-review-ghost')].map((g) => g.textContent!.replace(/\s+/g, ' ').trim())
    expect(ghosts).toContain('Acme ··Acme') // proposed first, then the old value struck, its spaces visible
    expect(ghosts).toContain('AMER')
    // The boolean column keeps its checkbox: it is tinted, never wrapped.
    expect(target.querySelectorAll('.sv-grid-checkbox').length).toBeGreaterThan(0)
    const labels = [...target.querySelectorAll('.sv-review-label')].map((l) => l.textContent)
    expect(labels).toEqual(['Done: no shared pattern', 'Fill empty Region (different values)', 'Trim spaces in Name'])
    expect(target.querySelector('.sv-review-count')!.textContent).toContain('4 pending in 3 groups')
    destroy()
  })

  it('accepting a group writes the app data; Ctrl+Z puts it back and the proposals return', async () => {
    const { review, api, rows, target, destroy } = await setup()
    review.add({
      source: AGENT,
      proposals: [
        { rowId: 'a', field: 'name', before: '  Acme', after: 'Acme' },
        { rowId: 'b', field: 'name', before: 'Globex ', after: 'Globex' },
      ],
    })
    flushSync()
    const accept = target.querySelector('.sv-review-act.is-accept') as HTMLButtonElement
    accept.click()
    await vi.waitFor(() => expect(rows()[0].name).toBe('Acme'))
    expect(rows()[1].name).toBe('Globex')
    await vi.waitFor(() => expect(target.querySelector('.sv-review-live')!.textContent).toBe('2 accepted'))
    expect(review.pending()).toHaveLength(0)
    expect(api.canUndo()).toBe(true)
    api.undo()
    flushSync()
    expect(rows()[0].name).toBe('  Acme')
    expect(review.pending()).toHaveLength(2)
    destroy()
  })

  it('asks before deciding more than confirmOver at once', async () => {
    const { review, target, destroy } = await setup(1)
    review.add({
      source: AGENT,
      proposals: [
        { rowId: 'a', field: 'name', before: '  Acme', after: 'Acme' },
        { rowId: 'b', field: 'name', before: 'Globex ', after: 'Globex' },
      ],
    })
    flushSync()
    ;(target.querySelector('.sv-review-act:not(.is-accept)') as HTMLButtonElement).click()
    flushSync()
    expect(target.querySelector('.sv-review-confirm')!.textContent).toContain('Reject 2 changes')
    expect(review.pending()).toHaveLength(2)
    destroy()
  })

  it('keyboard: J moves, Enter opens, R rejects the focused group', async () => {
    const { review, target, destroy } = await setup()
    review.add({
      source: AGENT,
      proposals: [
        { rowId: 'a', field: 'name', before: '  Acme', after: 'Acme' },
        { rowId: 'c', field: 'region', before: '', after: 'APAC' },
      ],
    })
    flushSync()
    const list = target.querySelector('.sv-review-groups') as HTMLElement
    const heads = () => [...target.querySelectorAll<HTMLElement>('.sv-review-group-head')]
    heads()[0]!.focus()
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }))
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    flushSync()
    expect(heads()[1]!.getAttribute('aria-expanded')).toBe('true')
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }))
    flushSync()
    expect(review.pending().map((p) => p.field)).toEqual(['region'])
    destroy()
  })

  it('has no axe violations', async () => {
    const { review, target, destroy } = await setup()
    review.add({ source: AGENT, proposals: [{ rowId: 'a', field: 'name', before: '  Acme', after: 'Acme' }] })
    flushSync()
    ;(target.querySelector('.sv-review-group-head') as HTMLButtonElement).click()
    flushSync()
    const result = await axe.run(target.querySelector('.sv-review')!, { rules: { 'color-contrast': { enabled: false } } })
    expect(result.violations.map((v) => v.id)).toEqual([])
    destroy()
  })
})

describe('only rows with changes', () => {
  it('ANDs onto the user filter, drops decided rows, and gives the user filter back', async () => {
    const { review, api, target, destroy } = await setup()
    const own = { kind: 'cmp' as const, column: 'done', op: 'equals' as const, value: false }
    api.setAdvancedFilter(own)
    review.add({
      source: AGENT,
      proposals: [
        { rowId: 'a', field: 'region', before: '', after: 'AMER' },
        { rowId: 'b', field: 'region', before: 'EMEA', after: 'APAC' },
      ],
    })
    flushSync()
    ;(target.querySelector('.sv-review-only') as HTMLButtonElement).click()
    flushSync()
    // b is done: the user filter still applies, so only a shows.
    await vi.waitFor(() => expect(api.getDisplayedRows().map((r: any) => r.id)).toEqual(['a']))
    expect(target.querySelector('.sv-review-only')!.getAttribute('aria-pressed')).toBe('true')
    await review.accept(review.pending().filter((p) => p.rowId === 'a').map((p) => p.id))
    flushSync()
    await vi.waitFor(() => expect(api.getDisplayedRows()).toHaveLength(0))
    review.showPendingOnly(false)
    flushSync()
    expect(api.getAdvancedFilter()).toEqual(own)
    await vi.waitFor(() => expect(api.getDisplayedRows().map((r: any) => r.id)).toEqual(['a', 'c']))
    destroy()
  })
})

it('the toggle reads off once the grid clears the advanced filter itself', async () => {
  const { review, api, destroy } = await setup()
  review.add({ source: AGENT, proposals: [{ rowId: 'a', field: 'region', before: '', after: 'AMER' }] })
  review.showPendingOnly(true)
  expect(review.pendingOnly).toBe(true)
  api.clearAdvancedFilter()
  expect(review.pendingOnly).toBe(false)
  destroy()
})

describe('panel polish', () => {
  it('Accept rule groups takes only the provable groups and leaves judgment ones pending', async () => {
    const { review, target, rows, destroy } = await setup()
    review.add({
      source: AGENT,
      proposals: [
        { rowId: 'a', field: 'name', before: '  Acme', after: 'Acme' },
        { rowId: 'b', field: 'name', before: 'Globex ', after: 'Globex' },
        { rowId: 'c', field: 'region', before: '', after: 'APAC' },
      ],
    })
    flushSync()
    const btn = [...target.querySelectorAll('button')].find((b) => b.textContent?.includes('Accept rule groups'))!
    expect(btn.textContent).toContain('(2)')
    btn.click()
    await vi.waitFor(() => expect(rows()[0].name).toBe('Acme'))
    expect(review.pending().map((p) => p.field)).toEqual(['region'])
    destroy()
  })

  it('a click on a sample line shows that row in the grid and lights it for a moment', async () => {
    const { review, target, destroy } = await setup()
    review.add({ source: AGENT, proposals: [{ rowId: 'c', field: 'region', before: '', after: 'APAC' }] })
    flushSync()
    ;(target.querySelector('.sv-review-group-head') as HTMLButtonElement).click()
    flushSync()
    ;(target.querySelector('.sv-review-sample-row') as HTMLButtonElement).click()
    flushSync()
    const lit = (review.formats as any[]).filter((f) => !f.columns)
    expect(lit).toHaveLength(1)
    expect(lit[0].when({ row: { id: 'c' } })).toBe(true)
    await vi.waitFor(() => expect((review.formats as any[]).filter((f) => !f.columns)).toHaveLength(0), { timeout: 3000 })
    destroy()
  })
})

it('takes its wording from the review, and a panel can override it', async () => {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let h!: { review: Review<any> }
  const app = mount(Harness, {
    target,
    props: {
      initial,
      columns,
      messages: { labelWhitespace: 'Leerzeichen in {field} kürzen', changes: '{count} Änderungen', acceptAll: 'Alle annehmen' },
      panelMessages: { acceptAll: 'Alles übernehmen' },
      onReady: (x: typeof h) => (h = x),
    },
  })
  await vi.waitFor(() => expect(h).toBeDefined())
  h.review.add({ source: AGENT, proposals: [
    { rowId: 'a', field: 'name', before: '  Acme', after: 'Acme' },
    { rowId: 'b', field: 'name', before: 'Globex ', after: 'Globex' },
  ] })
  flushSync()
  expect(target.querySelector('.sv-review-label')!.textContent).toBe('Leerzeichen in Name kürzen')
  expect(target.querySelector('.sv-review-conf')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('2 Änderungen')
  // The panel's own override wins over the review's.
  expect([...target.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Alles übernehmen')).toBe(true)
  unmount(app)
  target.remove()
})

it('after a keyboard decision the focus moves to the next group, then to the heading', async () => {
  const { review, target, destroy } = await setup()
  review.add({ source: AGENT, proposals: [
    { rowId: 'a', field: 'name', before: '  Acme', after: 'Acme' },
    { rowId: 'c', field: 'region', before: '', after: 'APAC' },
  ] })
  flushSync()
  const list = target.querySelector('.sv-review-groups') as HTMLElement
  ;(target.querySelector('.sv-review-group-head') as HTMLElement).focus()
  list.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }))
  await vi.waitFor(() => expect(document.activeElement?.classList.contains('sv-review-group-head')).toBe(true))
  ;(document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }))
  await vi.waitFor(() => expect(document.activeElement?.classList.contains('sv-review-title')).toBe(true))
  destroy()
})

describe('one change at a time', () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, name: `Co ${i}`, region: '', done: false }))
  const DISTINCT = ['AMER', 'EMEA', 'APAC', 'LATAM', 'ANZ', 'DACH', 'NORDICS', 'BENELUX']
  const PAIRS = ['AMER', 'EMEA', 'APAC', 'LATAM', 'AMER', 'EMEA', 'APAC', 'LATAM']

  async function setupMany(regions = DISTINCT) {
    const target = document.createElement('div')
    document.body.appendChild(target)
    let h!: { review: Review<any>; api: any; rows: () => any[] }
    const app = mount(Harness, { target, props: { initial: many, columns, onReady: (x: typeof h) => (h = x) } })
    await vi.waitFor(() => expect(h).toBeDefined())
    h.review.add({ source: AGENT, proposals: many.map((r, i) => ({ rowId: r.id, field: 'region', before: '', after: regions[i] })) })
    flushSync()
    ;(target.querySelector('.sv-review-group-head') as HTMLButtonElement).click()
    flushSync()
    return { ...h, target, destroy: () => { unmount(app); target.remove() } }
  }

  it('a line accepts or rejects its own change and leaves the rest of the group pending', async () => {
    const { review, target, rows, destroy } = await setupMany()
    const accept = target.querySelector('.sv-review-line [aria-label="Accept this change"]') as HTMLButtonElement
    accept.click()
    await vi.waitFor(() => expect(review.pending()).toHaveLength(7))
    const written = rows().filter((r) => r.region)
    expect(written).toHaveLength(1)
    const reject = target.querySelector('.sv-review-line [aria-label="Reject this change"]') as HTMLButtonElement
    await vi.waitFor(() => expect(reject.disabled).toBe(false))
    reject.click()
    flushSync()
    expect(review.pending()).toHaveLength(6)
    expect(rows().filter((r) => r.region)).toHaveLength(1)
    destroy()
  })

  it('the open group stays open when a decision moves the rest of it to another group', async () => {
    // Four pairs; accepting one AMER leaves a singleton, which pools under another key.
    const { review, target, destroy } = await setupMany(PAIRS)
    const head = () => target.querySelector('.sv-review-group.is-open .sv-review-label')?.textContent
    expect(head()).toBe('Fill empty Region with "AMER"')
    ;(target.querySelector('.sv-review-line [aria-label="Accept this change"]') as HTMLButtonElement).click()
    await vi.waitFor(() => expect(review.pending()).toHaveLength(7))
    flushSync()
    expect(target.querySelectorAll('.sv-review-group.is-open')).toHaveLength(1)
    expect(target.querySelector('.sv-review-group.is-open .sv-review-line')!.textContent).toContain('AMER')
    destroy()
  })

  it('Show all lists every change of a judgment group past the sample', async () => {
    const { target, destroy } = await setupMany()
    const before = target.querySelectorAll('.sv-review-line').length
    expect(before).toBeLessThan(8)
    const more = target.querySelector('.sv-review-more') as HTMLButtonElement
    expect(more.textContent).toBe('Show all 8')
    more.click()
    flushSync()
    expect(target.querySelectorAll('.sv-review-line')).toHaveLength(8)
    expect(target.querySelector('.sv-review-more')).toBeNull()
    destroy()
  })

  it('keys on a line stay with the line: the group does not close under it', async () => {
    const { target, destroy } = await setupMany()
    const line = target.querySelector('.sv-review-line [aria-label="Accept this change"]') as HTMLButtonElement
    const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    line.dispatchEvent(e)
    flushSync()
    expect(e.defaultPrevented).toBe(false)
    expect(target.querySelectorAll('.sv-review-group.is-open')).toHaveLength(1)
    destroy()
  })

  it('says which keys drive the list', async () => {
    const { target, destroy } = await setupMany()
    expect(target.querySelector('.sv-review-keys')!.textContent).toContain('J / K')
    destroy()
  })
})
