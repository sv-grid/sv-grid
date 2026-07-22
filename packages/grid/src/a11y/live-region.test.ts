import { afterEach, describe, expect, it } from 'vitest'
import { _resetLiveRegions, announce } from './live-region'

afterEach(() => {
  _resetLiveRegions()
})

describe('announce', () => {
  it('creates a polite status region and sets its text', async () => {
    announce('3 rows selected')
    const region = document.querySelector('[aria-live="polite"]')
    expect(region).not.toBeNull()
    expect(region!.getAttribute('role')).toBe('status')
    await Promise.resolve()
    expect(region!.textContent).toBe('3 rows selected')
  })

  it('creates a separate assertive alert region', async () => {
    announce('error!', { assertive: true })
    const region = document.querySelector('[aria-live="assertive"]')
    expect(region).not.toBeNull()
    expect(region!.getAttribute('role')).toBe('alert')
    await Promise.resolve()
    expect(region!.textContent).toBe('error!')
  })

  it('reuses the same region across calls', async () => {
    announce('first')
    announce('second')
    const regions = document.querySelectorAll('[aria-live="polite"]')
    expect(regions).toHaveLength(1)
    await Promise.resolve()
    expect(regions[0]!.textContent).toBe('second')
  })

  it('ignores empty messages', () => {
    announce('')
    expect(document.querySelector('[aria-live]')).toBeNull()
  })
})
