import { describe, expect, it } from 'vitest'
import { checkLicenseKey, editionCovers } from './license-core'

describe('checkLicenseKey', () => {
  it('unset for null / empty', () => {
    expect(checkLicenseKey(null)).toEqual({ status: 'unset', valid: false, edition: 'suite' })
    expect(checkLicenseKey(undefined)).toEqual({ status: 'unset', valid: false, edition: 'suite' })
    expect(checkLicenseKey('')).toEqual({ status: 'unset', valid: false, edition: 'suite' })
  })

  it('invalid for a wrong prefix', () => {
    expect(checkLicenseKey('nope-123')).toEqual({ status: 'invalid', valid: false, edition: 'suite' })
  })

  it('dev / eval keys are valid but flagged', () => {
    expect(checkLicenseKey('SVENTERPRISE-DEV-abc')).toEqual({ status: 'dev', valid: true, edition: 'suite' })
    expect(checkLicenseKey('SVENTERPRISE-EVAL-acme-2026')).toEqual({
      status: 'eval',
      valid: true,
      edition: 'suite',
    })
  })

  it('any other SVENTERPRISE- key is licensed', () => {
    expect(checkLicenseKey('SVENTERPRISE-ACME-2026-9XYZ')).toEqual({
      status: 'licensed',
      valid: true,
      edition: 'suite',
    })
  })
})

describe('editions', () => {
  it('a GRID key reads as the grid edition', () => {
    expect(checkLicenseKey('SVENTERPRISE-GRID-ACME-5-202612-9XYZ').edition).toBe('grid')
  })

  it('a SUITE key reads as the suite edition', () => {
    expect(checkLicenseKey('SVENTERPRISE-SUITE-ACME-5-202612-9XYZ').edition).toBe('suite')
  })

  it('a key issued before editions existed still reads as suite', () => {
    // The whole back-compat story: nothing an existing customer ships changes.
    expect(checkLicenseKey('SVENTERPRISE-ACME-2026-9XYZ').edition).toBe('suite')
  })

  it('GRID is only an edition on a paid key, never on a trial', () => {
    // A trial evaluates the whole product, so DEV/EVAL win over the marker.
    expect(checkLicenseKey('SVENTERPRISE-DEV-GRID-abc').edition).toBe('suite')
    expect(checkLicenseKey('SVENTERPRISE-EVAL-GRID-abc').edition).toBe('suite')
  })

  it('does not mistake a customer slug that merely starts with GRID', () => {
    // The separator is what makes it a marker: GRIDLY Ltd bought the suite.
    expect(checkLicenseKey('SVENTERPRISE-GRIDLY-2026-9XYZ').edition).toBe('suite')
  })

  it('grid covers the grid and nothing else; suite covers everything', () => {
    expect(editionCovers('grid', 'grid')).toBe(true)
    expect(editionCovers('grid', 'spreadsheet')).toBe(false)
    expect(editionCovers('grid', 'studio')).toBe(false)
    expect(editionCovers('suite', 'grid')).toBe(true)
    expect(editionCovers('suite', 'spreadsheet')).toBe(true)
    expect(editionCovers('suite', 'studio')).toBe(true)
  })

  it('an expiry still parses on an edition key', () => {
    // The edition marker sits where DEV/EVAL sit, so it must not shift the
    // date out of the second-to-last segment.
    const info = checkLicenseKey('SVENTERPRISE-GRID-ACME-5-202612-9XYZ', new Date('2027-01-05T00:00:00Z'))
    expect(info.edition).toBe('grid')
    expect(info.expired).toBe(true)
  })
})
