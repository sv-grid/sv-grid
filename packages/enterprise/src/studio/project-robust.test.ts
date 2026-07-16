/**
 * Robustness suite: the designer must survive extensive, adversarial editing
 * without throwing or corrupting the model. Two guarantees:
 *
 *  1. `validateProject` can legitimately return DUPLICATE messages (two
 *     unconfigured master-detail blocks on one screen produce identical warnings).
 *     This is the root cause of the historical `each_key_duplicate` crash - the
 *     designer must key those lists by index, never by message. We pin the
 *     behaviour here so a future "dedupe by message" refactor can't silently
 *     reintroduce the crash surface.
 *  2. A fuzz driver applies thousands of random ops (including invalid ids /
 *     out-of-range indices) and asserts the ops never throw and never break the
 *     model's invariants (unique block ids, unique screen ids, round-trippable).
 */
import { describe, expect, it } from 'vitest'
import type { EntitySchema } from '../schema'
import {
  addBlock,
  addBlockAt,
  addScreen,
  addScreenFromTemplate,
  createProject,
  isProjectValid,
  moveBlock,
  parseProject,
  removeBlock,
  removeEntity,
  removeScreen,
  reorderBlock,
  serializeProject,
  updateBlock,
  updateScreen,
  validateProject,
  type BlockKind,
  type StudioProject,
} from './project'

const customers: EntitySchema = {
  name: 'customers', label: 'Customer', idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true },
    { field: 'name', type: 'text' },
    { field: 'tier', type: 'enum', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] },
    { field: 'mrr', type: 'number' },
  ],
}
const orders: EntitySchema = {
  name: 'orders', label: 'Order', idField: 'id',
  fields: [{ field: 'id', type: 'text', primaryKey: true }, { field: 'total', type: 'number' }],
}

describe('validation message duplication (the each_key_duplicate root cause)', () => {
  it('two unconfigured master-detail blocks yield IDENTICAL warning messages', () => {
    const sid = 'customers'
    let p = createProject([customers])
    p = addBlock(p, sid, 'master-detail')
    p = addBlock(p, sid, 'master-detail')
    const warnings = validateProject(p).filter((i) => /Master\/detail/.test(i.message))
    expect(warnings).toHaveLength(2)
    expect(warnings[0]!.message).toBe(warnings[1]!.message) // duplicate keys IF keyed by message
    // The designer must therefore key its issue list by index; this is a contract.
  })

  it('never throws while validating a project full of duplicate-warning blocks', () => {
    let p = createProject([customers])
    for (let i = 0; i < 12; i++) p = addBlock(p, 'customers', 'master-detail')
    expect(() => validateProject(p)).not.toThrow()
    expect(validateProject(p).filter((i) => /Master\/detail/.test(i.message))).toHaveLength(12)
  })
})

describe('ops are total: invalid targets are no-ops, not throws', () => {
  const p = createProject([customers, orders])
  const sid = p.screens[0]!.id
  const bid = p.screens[0]!.blocks[0]!.id

  it('tolerates unknown screen / block ids', () => {
    expect(() => addBlock(p, 'nope', 'grid')).not.toThrow()
    expect(removeBlock(p, sid, 'ghost')).toEqual(p)
    expect(removeBlock(p, 'ghost', bid)).toEqual(p)
    expect(moveBlock(p, sid, 'ghost', 1)).toEqual(p)
    expect(reorderBlock(p, sid, 'ghost', 0)).toEqual(p)
    expect(updateBlock(p, sid, 'ghost', { span: 2 })).toEqual(p)
    expect(updateScreen(p, 'ghost', { title: 'x' })).toEqual(p)
    expect(removeScreen(p, 'ghost')).toEqual(p)
  })

  it('clamps out-of-range indices instead of tearing the array', () => {
    expect(addBlockAt(p, sid, 'kpi', -5).screens[0]!.blocks[0]!.config.kind).toBe('kpi')
    expect(addBlockAt(p, sid, 'kpi', 999).screens[0]!.blocks.at(-1)!.config.kind).toBe('kpi')
    expect(reorderBlock(p, sid, bid, -10).screens[0]!.blocks[0]!.id).toBe(bid)
    expect(reorderBlock(p, sid, bid, 999).screens[0]!.blocks.at(-1)!.id).toBe(bid)
    expect(moveBlock(p, sid, bid, -1)).toEqual(p) // already first
  })

  it('removing an entity drops its screens and never orphans a screen without validation catching it', () => {
    const gone = removeEntity(createProject([customers, orders]), 'orders')
    expect(gone.screens.every((s) => s.entity !== 'orders')).toBe(true)
    expect(validateProject(gone).some((i) => /missing entity/.test(i.message))).toBe(false)
  })
})

// A tiny seeded PRNG so a failing fuzz run is reproducible.
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff)
}

function invariants(p: StudioProject): void {
  // Screen ids unique.
  const sids = p.screens.map((s) => s.id)
  expect(new Set(sids).size).toBe(sids.length)
  for (const s of p.screens) {
    // Block ids unique within a screen (the crash-adjacent invariant).
    const bids = s.blocks.map((b) => b.id)
    expect(new Set(bids).size).toBe(bids.length)
    for (const b of s.blocks) expect([1, 2, 3]).toContain(b.span)
  }
  // Always serializable + round-trippable.
  expect(() => parseProject(serializeProject(p))).not.toThrow()
}

describe('fuzz: thousands of random ops never throw and preserve invariants', () => {
  const KINDS: BlockKind[] = ['grid', 'form', 'chart', 'dashboard', 'kpi', 'master-detail', 'lookup']

  it.each([1, 7, 42, 1337, 99999])('seed %i', (seed) => {
    const rnd = lcg(seed)
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!
    let p = createProject([customers, orders], { title: 'Fuzz' })

    for (let step = 0; step < 400; step++) {
      const screen = p.screens.length ? pick(p.screens) : null
      // Occasionally target a bogus id to exercise the no-op paths.
      const sid = !screen || rnd() < 0.1 ? 'ghost-screen' : screen.id
      const block = screen && screen.blocks.length ? pick(screen.blocks) : null
      const bid = !block || rnd() < 0.1 ? 'ghost-block' : block.id
      const op = Math.floor(rnd() * 10)
      expect(() => {
        switch (op) {
          case 0: p = addBlock(p, sid, pick(KINDS)); break
          case 1: p = addBlockAt(p, sid, pick(KINDS), Math.floor((rnd() - 0.2) * 12)); break
          case 2: p = removeBlock(p, sid, bid); break
          case 3: p = moveBlock(p, sid, bid, rnd() < 0.5 ? -1 : 1); break
          case 4: p = reorderBlock(p, sid, bid, Math.floor((rnd() - 0.2) * 12)); break
          case 5: p = updateBlock(p, sid, bid, { span: pick([1, 2, 3] as const) }); break
          case 6: p = addScreen(p, pick(['customers', 'orders', 'ghost'])); break
          case 7: p = removeScreen(p, sid); break
          case 8: p = addScreenFromTemplate(p, pick(['customers', 'orders']), pick(['crud', 'dashboard', 'master-detail'] as const)); break
          case 9: p = updateScreen(p, sid, { title: `T${step}` }); break
        }
      }).not.toThrow()
      expect(() => validateProject(p)).not.toThrow()
      expect(typeof isProjectValid(p)).toBe('boolean')
      invariants(p)
    }
  })
})
