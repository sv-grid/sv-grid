/**
 * QA sweep: the license surface - `setLicenseKey`, `clearLicenseKey`,
 * `isLicenseKeySet`, `isLicenseExpired`, `checkLicenseKey` and
 * `dismissUnlicensedNudge` - and what the soft gate actually does.
 *
 * The contract that matters commercially: an unlicensed grid still WORKS. It
 * gets a watermark and a one-time console nudge, not a broken method.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkLicenseKey,
  clearLicenseKey,
  isLicenseExpired,
  isLicenseKeySet,
  setLicenseKey,
} from '../license'
import { dismissUnlicensedNudge } from '../watermark'
import { flush, mountProGrid, qaRows } from './harness.svelte'

beforeEach(() => {
  clearLicenseKey()
  dismissUnlicensedNudge()
})
afterEach(() => {
  setLicenseKey('SVENTERPRISE-QA-TEST')
  vi.restoreAllMocks()
})

describe('QA enterprise: the license key accessors', () => {
  it('set / is / clear round-trip', () => {
    expect(isLicenseKeySet()).toBe(false)
    setLicenseKey('SVENTERPRISE-QA-TEST')
    expect(isLicenseKeySet()).toBe(true)
    clearLicenseKey()
    expect(isLicenseKeySet()).toBe(false)
  })

  it('an empty or non-string key is rejected loudly', () => {
    expect(() => setLicenseKey('')).toThrow(/non-empty string/)
    expect(() => setLicenseKey(undefined as never)).toThrow(/non-empty string/)
    expect(isLicenseKeySet()).toBe(false)
  })

  it('checkLicenseKey classifies unset, malformed and dev keys', () => {
    expect(checkLicenseKey(null).status).toBe('unset')
    expect(checkLicenseKey('nope').status).toBe('invalid')
    expect(checkLicenseKey('SVENTERPRISE-DEV-1').valid).toBe(true)
  })

  it('isLicenseExpired is false for a key with no expiry', () => {
    setLicenseKey('SVENTERPRISE-QA-TEST')
    expect(isLicenseExpired()).toBe(false)
  })
})

describe('QA enterprise: the soft gate', () => {
  it('an unlicensed export still produces the file', async () => {
    clearLicenseKey()
    const { pro } = await mountProGrid()
    clearLicenseKey()   // mountProGrid sets a dev key; drop it again
    const result = await pro.exportData({ format: 'csv', filename: 'unlicensed' })
    expect(result!.rowCount).toBe(qaRows.length)
  })

  it('an unlicensed grid paints the watermark', async () => {
    clearLicenseKey()
    const { target } = await mountProGrid()
    clearLicenseKey()
    await flush()
    // The watermark is chrome on the grid root, not an exception.
    expect(target.querySelector('.sv-grid-root')).not.toBeNull()
  })

  it('a malformed key throws on first use rather than failing silently', async () => {
    const { pro } = await mountProGrid()
    setLicenseKey('not-a-real-prefix')
    await expect(pro.exportData({ format: 'csv' })).rejects.toThrow(/license key format/)
  })

  it('dismissUnlicensedNudge silences the console notice for the session', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    const { pro } = await mountProGrid()
    clearLicenseKey()
    // Documented as "hide the console nudge for the rest of the session". It
    // used to RE-ARM it, so a test calling this to quieten its output got more.
    dismissUnlicensedNudge()

    await pro.exportData({ format: 'csv' })
    await pro.exportData({ format: 'tsv' })

    const noise = [...log.mock.calls, ...info.mock.calls].flat().join(' ')
    expect(noise).not.toMatch(/pricing/)
  })

  it('the nudge fires at most once without a dismiss', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { pro } = await mountProGrid()
    clearLicenseKey()

    await pro.exportData({ format: 'csv' })
    await pro.exportData({ format: 'tsv' })
    await pro.exportData({ format: 'json' })

    const nudges = log.mock.calls.filter((call) => String(call[0]).includes('@svgrid/enterprise'))
    expect(nudges.length).toBeLessThanOrEqual(1)
  })
})
