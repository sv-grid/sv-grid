import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { sha256Hex } from './sha256'

// The real key never appears in this public repository. The package compares
// a key's SHA-256 with LICENSE_KEY_SHA256 (license-hash.ts), so tests swap in
// the hash of a test key and keep the real hashing and the real check.
vi.mock('./license-hash', async () => {
  const { sha256Hex: hash } = await import('./sha256')
  return { LICENSE_KEY_SHA256: hash('test-license-key-0000') }
})

import { checkLicenseKey, editionCovers, parseLicenseExpiry } from './license-core'

const TEST_KEY = 'test-license-key-0000'

describe('sha256Hex', () => {
  it('matches the FIPS 180-4 test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    )
  })

  it('agrees with node:crypto across block boundaries and non-ASCII input', () => {
    for (const s of ['a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(1000), 'Ünïcødé ✓ 7ef3']) {
      expect(sha256Hex(s)).toBe(createHash('sha256').update(s, 'utf8').digest('hex'))
    }
  })
})

describe('checkLicenseKey', () => {
  it('unset for null, empty and blank', () => {
    for (const k of [null, undefined, '', '   ']) {
      expect(checkLicenseKey(k)).toEqual({ status: 'unset', valid: false, edition: 'suite' })
    }
  })

  it('the license key is licensed for every edition, with no expiry', () => {
    expect(checkLicenseKey(TEST_KEY)).toEqual({ status: 'licensed', valid: true, edition: 'suite' })
  })

  it('ignores case and surrounding whitespace in the key', () => {
    expect(checkLicenseKey(`  ${TEST_KEY.toUpperCase()}\n`).valid).toBe(true)
  })

  it('rejects every other string, including the old SVENTERPRISE- formats', () => {
    // These used to pass as paid Suite keys: the check only looked at the prefix.
    for (const k of [
      'SVENTERPRISE-anything',
      'SVENTERPRISE-DEV-LOCAL',
      'SVENTERPRISE-EVAL-ACME-5-20991231-X',
      'SVENTERPRISE-GRID-ACME-5-209912-9XYZ',
      'SVENTERPRISE-SUITE-ACME-5-209912-9XYZ',
      'test-license-key-0001',
      'nope',
    ]) {
      expect(checkLicenseKey(k)).toEqual({ status: 'invalid', valid: false, edition: 'suite' })
    }
  })

  it('never reports an expiry, so a paid key cannot lapse into the watermark', () => {
    const info = checkLicenseKey(TEST_KEY, new Date('2099-12-31T00:00:00Z'))
    expect(info.valid).toBe(true)
    expect(info.expired).toBeUndefined()
    expect(info.expiresAt).toBeUndefined()
  })
})

describe('editions', () => {
  it('grid covers the grid and nothing else; suite covers everything', () => {
    expect(editionCovers('grid', 'grid')).toBe(true)
    expect(editionCovers('grid', 'spreadsheet')).toBe(false)
    expect(editionCovers('grid', 'studio')).toBe(false)
    expect(editionCovers('suite', 'grid')).toBe(true)
    expect(editionCovers('suite', 'spreadsheet')).toBe(true)
    expect(editionCovers('suite', 'studio')).toBe(true)
  })
})

describe('parseLicenseExpiry (kept for callers that read dates from old keys)', () => {
  it('day precision expires at the end of that day', () => {
    expect(parseLicenseExpiry('SVENTERPRISE-EVAL-GUNEI-5-20260904-RGY2TN')?.toISOString()).toBe(
      '2026-09-04T23:59:59.999Z',
    )
  })

  it('month precision expires at the end of that month', () => {
    expect(parseLicenseExpiry('SVENTERPRISE-ACME-5-202705-ABC123')?.toISOString()).toBe('2027-05-31T23:59:59.999Z')
  })

  it('no encoded date means no expiry', () => {
    expect(parseLicenseExpiry('SVENTERPRISE-EVAL-acme-2026')).toBeNull()
    expect(parseLicenseExpiry(TEST_KEY)).toBeNull()
  })
})
