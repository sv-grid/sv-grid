import { afterEach, describe, expect, it } from 'vitest'
import { lockScroll, scrollLockDepth } from './scroll-lock'

afterEach(() => {
  // Each test balances its own locks; just reset the inline styles.
  document.body.style.overflow = ''
  document.body.style.paddingRight = ''
})

describe('lockScroll', () => {
  it('hides body overflow while locked and restores it on unlock', () => {
    document.body.style.overflow = 'auto'
    const unlock = lockScroll()
    expect(document.body.style.overflow).toBe('hidden')
    unlock()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('ref-counts nested locks: only the last unlock restores', () => {
    document.body.style.overflow = 'scroll'
    const a = lockScroll()
    const b = lockScroll()
    expect(scrollLockDepth()).toBe(2)
    a()
    expect(document.body.style.overflow).toBe('hidden') // still locked by b
    b()
    expect(document.body.style.overflow).toBe('scroll')
  })

  it('unlock is idempotent', () => {
    document.body.style.overflow = 'auto'
    const unlock = lockScroll()
    unlock()
    unlock()
    expect(scrollLockDepth()).toBe(0)
    expect(document.body.style.overflow).toBe('auto')
  })
})
