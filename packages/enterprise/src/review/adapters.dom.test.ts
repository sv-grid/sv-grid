import { afterEach, describe, expect, it } from 'vitest'
import { setAIProvider } from '@svgrid/grid'
import { blankTargets, fromClassify, fromRows, fromSmartFill, fromStaged, reviewSmartFill } from './adapters'
import type { ReviewGridApi } from './model.svelte'
import type { ProposalSource } from './types'

type Row = { id: string; name: string; region: string; text?: string; tier?: string }
const rows: Row[] = [
  { id: 'r1', name: 'Acme', region: '' },
  { id: 'r2', name: 'Globex', region: 'EMEA' },
  { id: 'r3', name: 'Initech', region: '' },
]
const api = (data: Row[] = rows) =>
  ({ getOption: (k: string) => (k === 'getRowId' ? (r: Row) => r.id : undefined), getData: () => data }) as unknown as ReviewGridApi

afterEach(() => setAIProvider(null))

describe('fromSmartFill', () => {
  it('keys by row id from the snapshot and carries confidence and rationale', () => {
    const set = fromSmartFill(
      { field: 'region', rationale: 'by country', predictions: [{ rowIndex: 0, value: 'AMER', confidence: 0.9 }, { rowIndex: 2, value: 'APAC', confidence: 0.4 }] },
      rows, { api: api() },
    )
    expect(set.proposals).toEqual([
      { rowId: 'r1', field: 'region', before: '', after: 'AMER', confidence: 0.9, reason: 'by country' },
      { rowId: 'r3', field: 'region', before: '', after: 'APAC', confidence: 0.4, reason: 'by country' },
    ])
    expect(set.source).toMatchObject({ kind: 'ai', id: 'smart-fill:region' })
  })

  it('drops indices that were not asked about, are out of range, or repeat', () => {
    const set = fromSmartFill(
      { field: 'region', rationale: '', predictions: [
        { rowIndex: 1, value: 'X', confidence: 1 },  // not blank, so not a target
        { rowIndex: 9, value: 'X', confidence: 1 },  // outside the snapshot
        { rowIndex: 0, value: 'A', confidence: 1 },
        { rowIndex: 0, value: 'B', confidence: 1 },  // repeat
      ] },
      rows, { api: api() },
    )
    expect(set.proposals.map((p) => p.after)).toEqual(['A'])
    expect(set.dropped).toBe(3)
  })

  it('resolves against the snapshot even when the data changed during the await', () => {
    const snapshot = rows.slice()
    const later = [{ id: 'new', name: 'Inserted', region: '' }, ...rows]
    const set = fromSmartFill({ field: 'region', rationale: '', predictions: [{ rowIndex: 0, value: 'AMER', confidence: 1 }] }, snapshot, { api: api(later) })
    expect(set.proposals[0]!.rowId).toBe('r1')
  })
})

it('fromClassify writes to the output field', () => {
  const set = fromClassify(
    { inputField: 'text', outputField: 'tier', predictions: [{ rowIndex: 1, value: 'gold', confidence: 0.8 }] },
    rows, { api: api() },
  )
  expect(set.proposals).toEqual([{ rowId: 'r2', field: 'tier', before: undefined, after: 'gold', confidence: 0.8, reason: 'classified from text' }])
})

describe('fromRows', () => {
  const source: ProposalSource = { kind: 'import', id: 'crm.csv', label: 'crm.csv' }
  it('one proposal per changed field, matched by key; unmatched rows returned', () => {
    const set = fromRows<Row>([{ id: 'r1', name: 'Acme Inc', region: '' }, { id: 'r2', region: 'AMER' }, { id: 'zz', name: 'New' }], { api: api(), key: 'id', source })
    expect(set.proposals).toEqual([
      { rowId: 'r1', field: 'name', before: 'Acme', after: 'Acme Inc' },
      { rowId: 'r2', field: 'region', before: 'EMEA', after: 'AMER' },
    ])
    expect(set.unmatched).toEqual([{ id: 'zz', name: 'New' }])
  })

  it('limits to `fields` when given', () => {
    const set = fromRows<Row>([{ id: 'r1', name: 'Acme Inc', region: 'AMER' }], { api: api(), key: 'id', source, fields: ['region'] })
    expect(set.proposals.map((p) => p.field)).toEqual(['region'])
  })
})

it('reviewSmartFill snapshots, asks only for blank cells, and adds the result', async () => {
  let prompt = ''
  setAIProvider(async (req) => {
    prompt = req.prompt
    return JSON.stringify({ rationale: 'guess', predictions: [{ rowIndex: 0, value: 'AMER', confidence: 0.7 }, { rowIndex: 1, value: 'LEAK', confidence: 1 }] })
  })
  const added: unknown[] = []
  const gridApi = { ...api(), getColumns: () => [], getState: () => ({}) } as unknown as ReviewGridApi
  const set = await reviewSmartFill({ add: (s) => added.push(s) }, gridApi, { field: 'region', examples: [{ input: { name: 'Globex' }, output: 'EMEA' }] } as never)
  expect(blankTargets(rows, 'region')).toEqual([0, 2])
  expect(set.proposals.map((p) => [p.rowId, p.after])).toEqual([['r1', 'AMER']])
  expect(set.dropped).toBe(1)
  expect(added).toHaveLength(1)
  expect(prompt.length).toBeGreaterThan(0)
})

it('fromStaged maps column ids to fields and drops no-ops', () => {
  const api = { getColumns: () => [{ id: 'reg', field: 'region', header: 'Region', visible: true }] } as never
  const set = fromStaged(
    [
      { rowId: 'r1', columnId: 'reg', original: '', staged: 'EMEA' },
      { rowId: 'r2', columnId: 'reg', original: 'APAC', staged: 'APAC' },
    ],
    { api, source: { kind: 'user', id: 'dana', label: 'Dana (staged)' } },
  )
  expect(set.proposals).toEqual([{ rowId: 'r1', field: 'region', before: '', after: 'EMEA' }])
})
