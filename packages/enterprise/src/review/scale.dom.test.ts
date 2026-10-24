/**
 * Change review at enterprise scale: 100,000 rows, 20,000 proposals. Every
 * step is timed and held under a ceiling with room for a loaded CI machine;
 * the measured times are printed so a regression shows as a number.
 */
import { expect, it } from 'vitest'
import { createReview, type ReviewGridApi } from './model.svelte'
import { cardMarkFor } from './card-marks.svelte'
import type { ProposalInput, ProposalSource } from './types'

type Row = { id: string; name: string; region: string; amount: number; notes: string }
const ROWS = 100_000
const AGENT: ProposalSource = { kind: 'agent', id: 'bulk', label: 'Bulk agent' }

async function timed<T>(label: string, fn: () => T | Promise<T>): Promise<[T, number]> {
  const start = performance.now()
  const value = await fn()
  const ms = Math.round(performance.now() - start)
  console.log(`scale: ${label} ${ms} ms`)
  return [value, ms]
}

it('100k rows and 20k proposals: add, group, tint, cards, accept all, undo, redo', async () => {
  let data: Row[] = Array.from({ length: ROWS }, (_, i) => ({
    id: `r${i}`,
    name: i % 7 === 0 ? `Company ${i}  ` : `Company ${i}`,
    region: i % 5 === 0 ? '' : 'EMEA',
    amount: i % 11 === 0 ? i * 100 : i,
    notes: `note ${i}`,
  }))
  const getRowId = (r: Row) => r.id
  const undo: Array<{ u: () => void; r: () => void }> = []
  const api = {
    getData: () => data,
    getOption: (k: string) => (k === 'getRowId' ? getRowId : undefined),
    getActiveCell: () => null,
    getRowId: () => null,
    getColumns: () => [],
    getCommandContext: () => ({ recordUndo: (u: () => void, r: () => void) => undo.push({ u, r }) }),
    stopEditing: () => false,
    scrollToRow() {},
    getDisplayedRows: () => data,
  } as unknown as ReviewGridApi
  const review = createReview<Row>({ api, setRows: (next) => (data = next) })

  const proposals: ProposalInput[] = []
  for (let i = 1; i < ROWS && proposals.length < 20_000; i++) {
    const r = data[i]!
    if (r.name !== r.name.trim()) proposals.push({ rowId: r.id, field: 'name', before: r.name, after: r.name.trim() })
    if (!r.region) proposals.push({ rowId: r.id, field: 'region', before: '', after: i % 2 ? 'AMER' : 'APAC', confidence: 0.9 })
    if (i % 11 === 0) proposals.push({ rowId: r.id, field: 'amount', before: r.amount, after: r.amount / 100 })
    if (i % 13 === 0) proposals.push({ rowId: r.id, field: 'notes', before: r.notes, after: `Note: ${i}` })
  }
  proposals.length = 20_000

  const [, addMs] = await timed('add 20k', () => review.add({ source: AGENT, proposals }))
  expect(addMs).toBeLessThan(3000)
  const [groups, groupMs] = await timed('group 20k', () => review.groups())
  expect(groupMs).toBeLessThan(3000)
  expect(groups.length).toBeGreaterThan(0)
  const [, tintMs] = await timed('tint rules', () => review.formats)
  expect(tintMs).toBeLessThan(1000)

  // Reading the tint linked the review to its grid's cards.
  const [marked, cardMs] = await timed('1,000 card marks', () => {
    let n = 0
    for (let i = 0; i < 1000; i++) if (cardMarkFor(getRowId as never, data[i], i)) n++
    return n
  })
  expect(cardMs).toBeLessThan(500)
  expect(marked).toBeGreaterThan(0)

  const ids = review.pending().map((p) => p.id)
  const [out, acceptMs] = await timed('accept 20k', () => review.accept(ids))
  expect(acceptMs).toBeLessThan(5000)
  expect(out.accepted).toHaveLength(20_000)
  expect(data[7]!.name).toBe('Company 7')

  const [, undoMs] = await timed('undo 20k', () => undo.at(-1)!.u())
  expect(undoMs).toBeLessThan(5000)
  expect(review.pending()).toHaveLength(20_000)
  expect(data[7]!.name).toBe('Company 7  ')

  const [, redoMs] = await timed('redo 20k', () => undo.at(-1)!.r())
  expect(redoMs).toBeLessThan(5000)
  expect(review.pending()).toHaveLength(0)
}, 60_000)
