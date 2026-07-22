import { describe, expect, it } from 'vitest'
import { avatarInitials, avatarColorHue } from './avatar'

describe('avatarInitials', () => {
  it('uses first + last word initials', () => {
    expect(avatarInitials('Ada Lovelace')).toBe('AL')
    expect(avatarInitials('a b c')).toBe('AC')
  })

  it('uses the first two letters of a single word', () => {
    expect(avatarInitials('Grace')).toBe('GR')
  })

  it('returns empty for blank input', () => {
    expect(avatarInitials('   ')).toBe('')
    expect(avatarInitials('')).toBe('')
  })
})

describe('avatarColorHue', () => {
  it('is deterministic and within 0-359', () => {
    const a = avatarColorHue('Ada Lovelace')
    const b = avatarColorHue('Ada Lovelace')
    expect(a).toBe(b)
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThan(360)
  })

  it('differs for different names (usually)', () => {
    expect(avatarColorHue('Alice')).not.toBe(avatarColorHue('Zeno'))
  })
})
