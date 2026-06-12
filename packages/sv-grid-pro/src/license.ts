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
//   does not start with "SVPRO-"      -> throws (programmer error)
//   in REVOKED_KEYS                   -> throws (revoked / leaked / expired)
//   starts with "SVPRO-DEV" or
//     "SVPRO-EVAL"                    -> works; one-time console.info notice
//   any other "SVPRO-..."             -> works silently (paid production)

import { REVOKED_KEYS } from './revoked'
import { emitUnlicensedNudge } from './watermark'
import { showUpgradePrompt, type ProFeatureLabel } from './upgrade-prompt'

const VALID_PREFIX = 'SVPRO-'
let currentKey: string | null = null
let noticedDev = false

export function setLicenseKey(key: string): void {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('sv-grid-pro: setLicenseKey() requires a non-empty string')
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

export function assertProLicensed(feature?: ProFeatureLabel): void {
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
      'sv-grid-pro: invalid license key format (expected "SVPRO-..." prefix).',
    )
  }
  if (REVOKED_KEYS.has(currentKey)) {
    throw new Error(
      'sv-grid-pro: this license key has been revoked. ' +
        'Contact sales@jqwidgets.com for a replacement.',
    )
  }
  if (
    !noticedDev &&
    (currentKey.startsWith('SVPRO-DEV') || currentKey.startsWith('SVPRO-EVAL'))
  ) {
    // eslint-disable-next-line no-console
    console.info(
      'sv-grid-pro: using a development / evaluation license. Not for production use.',
    )
    noticedDev = true
  }
}
