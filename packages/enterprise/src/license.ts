// Polite license gate. Not crypto - anyone with devtools can extract the key
// from a deployed bundle. The point is to make commercial use require a
// transaction, not to defeat reverse engineering.
//
// Behavior matrix:
//
//   currentKey state                  -> result
//   ────────────────────────────────────────────────────────────────────
//   null (no key set)                 -> soft-gate: watermark + console.log,
//                                        feature still runs
//   does not start with "SVENTERPRISE-"      -> throws (programmer error)
//   in REVOKED_KEYS                   -> throws (revoked / leaked / expired)
//   starts with "SVENTERPRISE-DEV" or
//     "SVENTERPRISE-EVAL"                    -> works; one-time console.info notice
//   any other "SVENTERPRISE-..."             -> works silently (paid production)

import { REVOKED_KEYS } from './revoked'
import { emitUnlicensedNudge } from './watermark'
import { showUpgradePrompt, type EnterpriseFeatureLabel } from './upgrade-prompt'

const VALID_PREFIX = 'SVENTERPRISE-'
let currentKey: string | null = null
let noticedDev = false

export function setLicenseKey(key: string): void {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('@svgrid/enterprise: setLicenseKey() requires a non-empty string')
  }
  currentKey = key
  noticedDev = false
}

export function clearLicenseKey(): void {
  currentKey = null
  noticedDev = false
}

export function getLicenseKey(): string | null {
  return currentKey
}

/** True if a key is set at all (regardless of validity). */
export function isLicenseKeySet(): boolean {
  return currentKey != null
}

/**
 * True if the current key passes every check: present, valid prefix, not
 * revoked. Use this from callers that want to branch on license status
 * (e.g. UI that hides Pro-only options when unlicensed).
 */
export function hasValidLicense(): boolean {
  if (currentKey == null) return false
  if (!currentKey.startsWith(VALID_PREFIX)) return false
  if (REVOKED_KEYS.has(currentKey)) return false
  return true
}

export function assertEnterpriseLicensed(feature?: EnterpriseFeatureLabel): void {
  if (currentKey == null) {
    // Soft-gate: the feature still runs, but the user gets a watermark +
    // a one-time console.log nudge directing them to pricing, plus a
    // contextual moment-of-intent upgrade card naming the feature they
    // just reached for.
    emitUnlicensedNudge()
    showUpgradePrompt(feature)
    return
  }
  if (!currentKey.startsWith(VALID_PREFIX)) {
    throw new Error(
      '@svgrid/enterprise: invalid license key format (expected "SVENTERPRISE-..." prefix).',
    )
  }
  if (REVOKED_KEYS.has(currentKey)) {
    throw new Error(
      '@svgrid/enterprise: this license key has been revoked. ' +
        'Contact sales@jqwidgets.com for a replacement.',
    )
  }
  if (
    !noticedDev &&
    (currentKey.startsWith('SVENTERPRISE-DEV') || currentKey.startsWith('SVENTERPRISE-EVAL'))
  ) {
    // eslint-disable-next-line no-console
    console.info(
      '@svgrid/enterprise: using a development / evaluation license. Not for production use.',
    )
    noticedDev = true
  }
}
