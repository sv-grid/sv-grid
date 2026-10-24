import { describe, expect, it } from 'vitest'
import { hasPending, stripPending, withPending, PENDING_KIND } from './pending-filter'

const own = { kind: 'cmp' as const, column: 'status', op: 'equals' as const, value: 'Open' }

describe('pending filter expressions', () => {
  it('ANDs a node on and strips it back to the user expression', () => {
    const on = withPending(own, 't1', 1)
    expect(on).toEqual({ kind: 'and', parts: [own, { kind: 'ext', type: PENDING_KIND, payload: { token: 't1', nonce: 1 } }] })
    expect(hasPending(on)).toBe(true)
    expect(stripPending(on)).toEqual(own)
  })

  it('stands alone when there is no user filter, and strips to null', () => {
    const on = withPending(null, 't1', 1)
    expect(on.kind).toBe('ext')
    expect(stripPending(on)).toBeNull()
  })

  it('re-applying replaces the node instead of stacking another', () => {
    const twice = withPending(withPending(own, 't1', 1), 't1', 2)
    expect(twice).toEqual({ kind: 'and', parts: [own, { kind: 'ext', type: PENDING_KIND, payload: { token: 't1', nonce: 2 } }] })
  })

  it('keeps the rest of a nested user expression', () => {
    const nested = { kind: 'or' as const, parts: [own, { kind: 'not' as const, expr: own }] }
    expect(stripPending(withPending(nested, 't', 1))).toEqual(nested)
  })
})
