import { describe, expect, it } from 'vitest'
import { checkLicenseKey } from './license-core'

describe('checkLicenseKey', () => {
  it('unset for null / empty', () => {
    expect(checkLicenseKey(null)).toEqual({ status: 'unset', valid: false })
    expect(checkLicenseKey(undefined)).toEqual({ status: 'unset', valid: false })
    expect(checkLicenseKey('')).toEqual({ status: 'unset', valid: false })
  })

  it('invalid for a wrong prefix', () => {
    expect(checkLicenseKey('nope-123')).toEqual({ status: 'invalid', valid: false })
  })

  it('dev / eval keys are valid but flagged', () => {
    expect(checkLicenseKey('SVENTERPRISE-DEV-abc')).toEqual({ status: 'dev', valid: true })
    expect(checkLicenseKey('SVENTERPRISE-EVAL-acme-2026')).toEqual({ status: 'eval', valid: true })
  })

  it('any other SVENTERPRISE- key is licensed', () => {
    expect(checkLicenseKey('SVENTERPRISE-ACME-2026-9XYZ')).toEqual({ status: 'licensed', valid: true })
  })
})
