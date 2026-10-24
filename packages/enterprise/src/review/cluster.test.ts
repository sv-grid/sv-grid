import { describe, expect, it } from 'vitest'
import { clusterProposals } from './cluster'
import type { Proposal, ProposalSource } from './types'
import { crmCleanupFixture } from './test-fixtures/crm-cleanup'

const AGENT: ProposalSource = { kind: 'agent', id: 'a', label: 'Agent' }
let seq = 0
const p = (field: string, before: unknown, after: unknown, extra: Partial<Proposal> = {}): Proposal => ({
  id: `p${++seq}`, op: 'update', rowId: `r${seq}`, field, before, after,
  source: AGENT, createdAt: 0, status: 'pending', ...extra,
})
const kinds = (ps: Proposal[]) => clusterProposals(ps).map((g) => [g.kind, g.count])
const only = (ps: Proposal[]) => {
  const gs = clusterProposals(ps)
  expect(gs).toHaveLength(1)
  return gs[0]!
}

describe('rule detectors', () => {
  it('whitespace: trims and collapses', () => {
    const g = only([p('name', '  Acme ', 'Acme'), p('name', 'Acme   Corp', 'Acme Corp')])
    expect(g).toMatchObject({ kind: 'whitespace', rule: true, label: 'Trim spaces in name' })
  })

  it('case: one group per target case', () => {
    const gs = clusterProposals([p('n', 'JOHN SMITH', 'John Smith'), p('n', 'MARY JONES', 'Mary Jones'), p('n', 'Ab', 'AB')])
    expect(gs.map((g) => g.label).sort()).toEqual(['Change n to Title Case', 'Change n to UPPER CASE'])
  })

  it('format: phone shapes group by the target shape', () => {
    const g = only([p('phone', '(555) 123-4567', '555-123-4567'), p('phone', '555.987.6543', '555-987-6543')])
    expect(g).toMatchObject({ kind: 'format', label: 'Reformat phone as 999-999-9999' })
  })

  it('format: punctuation in words is labelled by what changed', () => {
    expect(only([p('c', 'Acme Inc.', 'Acme Inc'), p('c', 'J.P. Morgan', 'JP Morgan')]).label).toBe('Remove "." in c')
  })

  it('format: a number written as text becomes that number', () => {
    expect(only([p('amt', '1,200', 1200), p('amt', ' 35 ', 35)]).label).toBe('Convert amt text to numbers')
  })

  it('format never hides a value change in a number', () => {
    // "3.5" -> "35" keeps every digit; "1,5" is a decimal comma, not 15.
    for (const [b, a] of [['3.5', '35'], ['1,5', '15'], ['1/2', '12']]) {
      expect(clusterProposals([p('x', b, a)])[0]!.kind).toBe('unpatterned')
    }
    expect(clusterProposals([p('x', '1,5', 15)])[0]!.kind).toBe('unpatterned')
  })

  it('format: dates only when the day and month are unambiguous', () => {
    expect(only([p('d', '15/03/2024', '2024-03-15')]).kind).toBe('format')
    expect(only([p('d', '03/05/2024', '2024-03-05')]).kind).toBe('unpatterned')
    expect(only([p('d', '2024-03-15', new Date(2024, 2, 15))]).label).toBe('Reformat d dates as dates')
  })

  it('scale: five or more with one ratio; zero is never a base', () => {
    const five = [100, 200, 300, 400, 500].map((v) => p('rev', v, v / 100))
    expect(only(five)).toMatchObject({ kind: 'scale', label: 'Divide rev by 100' })
    expect(clusterProposals(five.slice(0, 4)).every((g) => g.kind !== 'scale')).toBe(true)
    expect(clusterProposals([0, 0, 0, 0, 0].map((v) => p('rev', v, 5)))[0]!.kind).not.toBe('scale')
    expect(only([1, 2, 3, 4, 5].map((v) => p('q', v, v * 2.5))).label).toBe('Multiply q by 2.5')
  })
})

describe('judgment detectors', () => {
  it('same-mapping: one group per target, read as a mapping table', () => {
    const ps = [p('c', 'usa', 'United States'), p('c', 'usa', 'United States'), p('c', 'U.S.', 'United States'), p('c', 'U.S.', 'United States')]
    const g = only(ps)
    expect(g).toMatchObject({ kind: 'same-mapping', rule: false, label: 'c: 2 values → "United States"' })
    expect(g.beforeDistribution).toEqual([{ value: 'usa', count: 2 }, { value: 'U.S.', count: 2 }])
  })

  it('fill-empty: split by value, singletons pooled', () => {
    const ps = [p('r', '', 'EMEA'), p('r', null, 'EMEA'), p('r', '', 'APAC'), p('r', undefined, 'AMER')]
    expect(clusterProposals(ps).map((g) => g.label).sort()).toEqual(['Fill empty r (different values)', 'Fill empty r with "EMEA"'])
  })

  it('constant-target: three or more, with the before distribution', () => {
    const ps = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((b) => p('s', b, 'X'))
    const g = only(ps)
    expect(g).toMatchObject({ kind: 'constant-target', label: 'Set s to "X"' })
    expect(g.beforeDistribution).toHaveLength(6)
    expect(g.beforeDistribution![5]).toEqual({ value: undefined, count: 2, other: true })
    expect(kinds(ps.slice(0, 2))).toEqual([['unpatterned', 2]])
  })

  it('two sources or two fields never share a group', () => {
    const other: ProposalSource = { kind: 'import', id: 'b', label: 'Import' }
    const gs = clusterProposals([p('n', ' a', 'a'), p('n', ' b', 'b', { source: other }), p('m', ' c', 'c')])
    expect(gs).toHaveLength(3)
  })
})

describe('order and sample', () => {
  it('risky groups first, rule groups last', () => {
    const ps = [
      p('n', ' a', 'a'), p('n', ' b', 'b'),
      p('s', 'x', 'X1'), p('s', 'y', 'X1'), p('s', 'z', 'X1'),
      p('u', 'q', 'w'),
      p('f', '', 'v', { confidence: 0.9 }), p('f', '', 'v', { confidence: 0.95 }),
      p('g', '', 'k', { confidence: 0.2 }), p('g', '', 'k', { confidence: 0.9 }),
    ]
    expect(clusterProposals(ps).map((g) => g.kind + ':' + g.field)).toEqual([
      'unpatterned:u', 'constant-target:s', 'fill-empty:g', 'fill-empty:f', 'whitespace:n',
    ])
  })

  it('the sample holds every low-confidence member, then spreads to five', () => {
    const ps = Array.from({ length: 40 }, (_, i) => p('r', '', 'EMEA', { confidence: i < 4 ? 0.3 : 0.9 }))
    const g = only(ps)
    expect(g.sample.slice(0, 4).sort()).toEqual(ps.slice(0, 4).map((x) => x.id).sort())
    expect(g.sample.length).toBe(5)
    expect(g.minConfidence).toBe(0.3)
  })

  it('a systematic wrong transform is its own group, labelled for what it does', () => {
    // A rule group proves the rule, not that the rule is right: an agent that
    // divides by 10 instead of 100 shows up as "Divide by 10" beside "by 100".
    const ps = [
      ...[100, 200, 300, 400, 500].map((v) => p('rev', v, v / 100)),
      ...[600, 700, 800, 900, 1000].map((v) => p('rev', v, v / 10)),
    ]
    expect(clusterProposals(ps).map((g) => g.label).sort()).toEqual(['Divide rev by 10', 'Divide rev by 100'])
  })
})

describe('crm-cleanup fixture (plan criteria 2 and 3)', () => {
  const { proposals, wrongIds } = crmCleanupFixture()
  const groups = clusterProposals(proposals)

  it('2,000 proposals cluster into 25 groups or fewer, under 10% unpatterned', () => {
    expect(proposals).toHaveLength(2000)
    expect(wrongIds.size).toBe(40)
    expect(groups.length).toBeLessThanOrEqual(25)
    const unpatterned = groups.filter((g) => g.kind === 'unpatterned').reduce((s, g) => s + g.count, 0)
    expect(unpatterned / proposals.length).toBeLessThan(0.1)
    expect(groups.reduce((s, g) => s + g.count, 0)).toBe(2000)
  })

  it('no seeded-wrong proposal lands in a rule group, and each one is in view', () => {
    for (const g of groups) {
      const wrong = g.ids.filter((id) => wrongIds.has(id))
      if (!wrong.length) continue
      expect(g.rule, g.label).toBe(false)
      // In view = a group the panel lists in full (unpatterned), a danger
      // group with its before distribution (constant-target), a group of
      // five or fewer, or the group's sample.
      const listed = g.kind === 'unpatterned' || g.kind === 'constant-target' || g.count <= 5
      for (const id of wrong) expect(listed || g.sample.includes(id), `${g.label} ${id}`).toBe(true)
    }
  })

  it('the region fills split by value, so smart-fill output is not one group', () => {
    expect(groups.filter((g) => g.field === 'region').length).toBeGreaterThan(1)
  })

  it('is deterministic', () => {
    expect(clusterProposals(crmCleanupFixture().proposals).map((g) => [g.key, g.count]))
      .toEqual(groups.map((g) => [g.key, g.count]))
  })
})

it('100k proposals cluster in well under a second', () => {
  const big: Proposal[] = []
  for (let i = 0; i < 50; i++) big.push(...crmCleanupFixture(i + 1).proposals.map((x) => ({ ...x, id: `${i}-${x.id}` })))
  const t = performance.now()
  const gs = clusterProposals(big)
  const ms = performance.now() - t
  expect(gs.reduce((s, g) => s + g.count, 0)).toBe(100_000)
  // Plan target is 500 ms in a production bench; jsdom under CI load gets headroom.
  expect(ms).toBeLessThan(1500)
})
