// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkLicenseKey, parseLicenseExpiry } from './license-core'
import {
  assertEnterpriseLicensed,
  clearLicenseKey,
  getLicenseExpiry,
  isLicenseExpired,
  setLicenseKey,
} from './license'
import { dismissUpgradePrompt } from './upgrade-prompt'
import { emitUnlicensedNudge } from './watermark'

// Keep everything else in the module real; only the watermark emitter is spied.
vi.mock('./watermark', async (importOriginal) => ({
  ...(await importOriginal()),
  emitUnlicensedNudge: vi.fn(),
}))

const KEY = 'SVENTERPRISE-EVAL-GUNEI-5-20260904-RGY2TN'
const CARD = '[data-svgrid-enterprise-upgrade]'

/** Calls to emitUnlicensedNudge() since the last reset.
 *
 *  Spied rather than counted in the DOM: the real function attaches its badge
 *  to grid elements on a microtask, so in a document with no grid it renders
 *  nothing and a node count would read 0 for every case - passing even if the
 *  watermark were wired up wrongly. The call is the contract under test. */
const watermarkCalls = () => vi.mocked(emitUnlicensedNudge).mock.calls.length

describe('trial key expiry parsing', () => {
  it('unlocks Enterprise today', () => {
    const info = checkLicenseKey(KEY, new Date('2026-08-21T12:00:00Z'))
    expect(info).toMatchObject({ status: 'eval', valid: true, expired: false })
  })

  it('expires end of 2026-09-04, not end of September', () => {
    expect(parseLicenseExpiry(KEY)?.toISOString()).toBe('2026-09-04T23:59:59.999Z')
  })

  it('still valid on the final day', () => {
    expect(checkLicenseKey(KEY, new Date('2026-09-04T23:00:00Z')).expired).toBe(false)
  })

  it('expired the next day, but still permitted', () => {
    const info = checkLicenseKey(KEY, new Date('2026-09-05T00:30:00Z'))
    expect(info.expired).toBe(true)
    expect(info.valid).toBe(true)
  })

  it('keeps parsing month-granularity keys issued before day precision', () => {
    expect(parseLicenseExpiry('SVENTERPRISE-ACME-5-202705-ABC123')?.toISOString()).toBe(
      '2027-05-31T23:59:59.999Z',
    )
  })

  it('a key with no encoded date has no expiry', () => {
    const info = checkLicenseKey('SVENTERPRISE-EVAL-acme-2026')
    expect(info.expiresAt).toBeUndefined()
    expect(info.expired).toBeUndefined()
  })
})

describe('what happens after the trial ends', () => {
  beforeEach(() => {
    vi.useRealTimers()
    clearLicenseKey()
    dismissUpgradePrompt()
    vi.mocked(emitUnlicensedNudge).mockClear()
    document.body.innerHTML = ''
  })

  it('during the trial: no card, and nothing thrown', () => {
    vi.useFakeTimers({ now: new Date('2026-08-25T10:00:00Z') })
    setLicenseKey(KEY)
    expect(isLicenseExpired()).toBe(false)
    expect(() => assertEnterpriseLicensed('Export')).not.toThrow()
    expect(document.querySelector(CARD)).toBeNull()
  })

  it('after the trial: pops the message, and STILL does not throw', () => {
    vi.useFakeTimers({ now: new Date('2026-09-20T10:00:00Z') })
    setLicenseKey(KEY)
    expect(isLicenseExpired()).toBe(true)

    expect(() => assertEnterpriseLicensed('Export')).not.toThrow()

    const card = document.querySelector(CARD)
    expect(card).not.toBeNull()
    expect(card!.textContent).toContain('Your trial has ended')
    expect(card!.textContent).toContain('everything still works')
  })

  it('exposes the expiry date so a host can render its own banner', () => {
    vi.useFakeTimers({ now: new Date('2026-09-20T10:00:00Z') })
    setLicenseKey(KEY)
    expect(getLicenseExpiry()?.toISOString()).toBe('2026-09-04T23:59:59.999Z')
  })

  it('a lapsed trial gets the watermark, the console notice AND the card', () => {
    vi.useFakeTimers({ now: new Date('2026-09-20T10:00:00Z') })
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    setLicenseKey(KEY)
    assertEnterpriseLicensed('Export')

    // The evaluation is over, so the app stops looking licensed on every
    // surface - it just keeps working.
    expect(document.querySelector(CARD)).not.toBeNull()
    expect(watermarkCalls()).toBeGreaterThan(0)
    expect(info.mock.calls.flat().join(' ')).toMatch(/evaluation license expired on 2026-09-04/)
    info.mockRestore()
  })

  it('the expiry console notice fires once, not on every Pro call', () => {
    vi.useFakeTimers({ now: new Date('2026-09-20T10:00:00Z') })
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    setLicenseKey(KEY)
    assertEnterpriseLicensed('Export')
    assertEnterpriseLicensed('Export')
    assertEnterpriseLicensed('Print')

    const expiryNotices = info.mock.calls
      .flat()
      .filter((m) => typeof m === 'string' && m.includes('evaluation license expired'))
    expect(expiryNotices).toHaveLength(1)
    info.mockRestore()
  })

  it('an app with no key at all still gets the watermark', () => {
    clearLicenseKey()
    assertEnterpriseLicensed('Export')

    expect(document.querySelector(CARD)).not.toBeNull()
    expect(watermarkCalls()).toBeGreaterThan(0)
  })

  it('a paid key never shows the card', () => {
    vi.useFakeTimers({ now: new Date('2026-09-20T10:00:00Z') })
    setLicenseKey('SVENTERPRISE-ACME-5-202705-ABC123')
    expect(isLicenseExpired()).toBe(false)
    assertEnterpriseLicensed('Export')
    expect(document.querySelector(CARD)).toBeNull()
  })
})
