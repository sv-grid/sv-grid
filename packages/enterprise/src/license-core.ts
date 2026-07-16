// Pure license classification - no DOM, no Svelte, no module state. Shared by
// the browser gate (license.ts, via setLicenseKey) AND the Node/MCP generator
// (which reads the key from the SVGRID_LICENSE_KEY env var). One definition of
// "what a valid key is," so the two contexts can never drift.
//
// This is deliberately NOT crypto (see license.ts). It classifies a key string;
// callers decide what to do with the result. The Studio is soft-gate only:
// unlicensed use still works, it just nudges.
import { REVOKED_KEYS } from './revoked.js'

export const VALID_PREFIX = 'SVENTERPRISE-'

export type LicenseStatus =
  | 'unset' // no key provided
  | 'invalid' // present but wrong prefix (usually a typo)
  | 'revoked' // valid prefix but on the revoked list
  | 'dev' // SVENTERPRISE-DEV... - works, not for production
  | 'eval' // SVENTERPRISE-EVAL... - works, not for production
  | 'licensed' // any other SVENTERPRISE-... - paid production

export type LicenseInfo = {
  status: LicenseStatus
  /** True when the key permits use (dev / eval / licensed). */
  valid: boolean
}

/** Classify a license key string. Pure and side-effect-free. */
export function checkLicenseKey(key: string | null | undefined): LicenseInfo {
  if (key == null || key === '') return { status: 'unset', valid: false }
  if (!key.startsWith(VALID_PREFIX)) return { status: 'invalid', valid: false }
  if (REVOKED_KEYS.has(key)) return { status: 'revoked', valid: false }
  if (key.startsWith('SVENTERPRISE-DEV')) return { status: 'dev', valid: true }
  if (key.startsWith('SVENTERPRISE-EVAL')) return { status: 'eval', valid: true }
  return { status: 'licensed', valid: true }
}
