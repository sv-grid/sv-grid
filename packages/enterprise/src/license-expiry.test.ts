// @vitest-environment jsdom
// What the gate does with the one license key, a wrong key, an old dated key
// and no key. The expiry bug this file used to cover a different shape of:
// a paid key whose date had passed brought the watermark back, against the
// EULA's promise that paid-term versions keep working. Keys no longer carry a
// date, and the nudges only ever treat a TRIAL key as able to lapse.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assertEnterpriseLicensed,
  clearLicenseKey,
  getLicenseExpiry,
  isLicenseExpired,
  nudgeEnterprise,
  setLicenseKey,
} from './license'
import { dismissUpgradePrompt } from './upgrade-prompt'
import { emitUnlicensedNudge } from './watermark'

// Keep everything else in the module real; only the watermark emitter is spied.
vi.mock('./watermark', async (importOriginal) => ({
  ...(await importOriginal()),
  emitUnlicensedNudge: vi.fn(),
}))
// A test key in place of the real one (see license-core.test.ts).
vi.mock('./license-hash', async () => {
  const { sha256Hex } = await import('./sha256')
  return { LICENSE_KEY_SHA256: sha256Hex('test-license-key-0000') }
})

const TEST_KEY = 'test-license-key-0000'
const OLD_DATED_KEY = 'SVENTERPRISE-ACME-5-202705-ABC123'
const CARD = '[data-svgrid-enterprise-upgrade]'

/** Calls to emitUnlicensedNudge() since the last reset (spied, not counted in
 *  the DOM: with no grid on the page the real badge renders nothing). */
const watermarkCalls = () => vi.mocked(emitUnlicensedNudge).mock.calls.length

describe('the license gate', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    clearLicenseKey()
    dismissUpgradePrompt()
    vi.mocked(emitUnlicensedNudge).mockClear()
    document.body.innerHTML = ''
  })

  it('the license key: no watermark, no card, nothing thrown', () => {
    setLicenseKey(TEST_KEY)
    expect(() => assertEnterpriseLicensed('Export')).not.toThrow()
    nudgeEnterprise('Export')
    expect(watermarkCalls()).toBe(0)
    expect(document.querySelector(CARD)).toBeNull()
  })

  it('the license key stays licensed years later (the expired-key fix)', () => {
    vi.useFakeTimers({ now: new Date('2099-06-01T00:00:00Z') })
    setLicenseKey(TEST_KEY)
    expect(isLicenseExpired()).toBe(false)
    expect(getLicenseExpiry()).toBeNull()
    assertEnterpriseLicensed('Export')
    nudgeEnterprise('Print')
    expect(watermarkCalls()).toBe(0)
    expect(document.querySelector(CARD)).toBeNull()
  })

  it('an old dated SVENTERPRISE- key is not valid: nudged like no key, never thrown', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    setLicenseKey(OLD_DATED_KEY)
    expect(() => assertEnterpriseLicensed('Export')).not.toThrow()
    expect(watermarkCalls()).toBeGreaterThan(0)
    expect(document.querySelector(CARD)).not.toBeNull()
  })

  it('a wrong key warns once in the console, however many Pro calls follow', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setLicenseKey('SVENTERPRISE-anything')
    assertEnterpriseLicensed('Export')
    assertEnterpriseLicensed('Print')
    nudgeEnterprise('Import')
    const notices = warn.mock.calls.flat().filter((m) => typeof m === 'string' && m.includes('is not valid'))
    expect(notices).toHaveLength(1)
  })

  it('an app with no key at all still gets the watermark and the card', () => {
    assertEnterpriseLicensed('Export')
    expect(watermarkCalls()).toBeGreaterThan(0)
    expect(document.querySelector(CARD)).not.toBeNull()
  })
})
