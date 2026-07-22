import { describe, expect, it } from 'vitest'
import { fuzzyScore, fuzzyMatch } from './fuzzy'

describe('fuzzyScore', () => {
  it('matches a subsequence, rejects a non-subsequence', () => {
    expect(fuzzyScore('New invoice', 'ni')).not.toBeNull()
    expect(fuzzyScore('New invoice', 'niv')).not.toBeNull()
    expect(fuzzyScore('New invoice', 'xyz')).toBeNull()
    expect(fuzzyScore('New invoice', 'ivn')).toBeNull() // out of order
  })

  it('is case-insensitive and returns 0 for an empty query', () => {
    expect(fuzzyMatch('Export CSV', 'EXPORT')).toBe(true)
    expect(fuzzyScore('anything', '')).toBe(0)
  })

  it('scores a contiguous / prefix match higher than a scattered one', () => {
    const prefix = fuzzyScore('Settings', 'set')!
    const scattered = fuzzyScore('Silent tester', 'set')!
    expect(prefix).toBeGreaterThan(scattered)
  })

  it('rewards word-boundary starts', () => {
    const boundary = fuzzyScore('Open file', 'of')! // O..f (word starts)
    const inner = fuzzyScore('Profile', 'of')! // ...of.. inside a word
    expect(boundary).toBeGreaterThan(inner)
  })

  it('filters a list to matches only', () => {
    const cmds = ['New invoice', 'New order', 'Export invoices', 'Delete invoice']
    const ranked = cmds
      .map((c) => ({ c, s: fuzzyScore(c, 'inv') }))
      .filter((x) => x.s !== null)
      .sort((a, b) => b.s! - a.s!)
      .map((x) => x.c)
    expect(ranked).toHaveLength(3) // "New order" has no 'inv' subsequence
    expect(ranked).not.toContain('New order')
    expect(ranked).toContain('New invoice')
  })
})
