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
//   an EXPIRED dev/eval key            -> still works, but stops looking
//                                        licensed: watermark + a one-time
//                                        console notice naming the expiry date
//                                        + the upgrade card. Stays a soft gate
//                                        so a trial ending cannot break a build.
//   any other "SVENTERPRISE-..."             -> works silently (paid production)

import { checkLicenseKey, VALID_PREFIX, type LicenseInfo } from './license-core'
import { emitUnlicensedNudge } from './watermark'
import { showUpgradePrompt, type EnterpriseFeatureLabel } from './upgrade-prompt'

export { checkLicenseKey, type LicenseInfo, type LicenseStatus } from './license-core'

let currentKey: string | null = null
let noticedDev = false
let noticedExpired = false

/** One-time console notice for a trial that has run out. Separate from the
 *  dev/eval notice: that one says "not for production", this one says the
 *  evaluation is over and names the date, which is the actionable part. */
function noticeExpired(info: LicenseInfo): void {
  if (noticedExpired) return
  noticedExpired = true
  const on = info.expiresAt ? ` on ${info.expiresAt.toISOString().slice(0, 10)}` : ''
  // eslint-disable-next-line no-console
  console.info(
    `@svgrid/enterprise: your evaluation license expired${on}. Everything still ` +
      'works, but the watermark and upgrade notice stay until a license key is set. ' +
      'Contact sales@jqwidgets.com or see https://svgrid.com/pricing',
  )
}

export function setLicenseKey(key: string): void {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('@svgrid/enterprise: setLicenseKey() requires a non-empty string')
  }
  currentKey = key
  noticedDev = false
  noticedExpired = false
}

export function clearLicenseKey(): void {
  currentKey = null
  noticedDev = false
  noticedExpired = false
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
  return checkLicenseKey(currentKey).valid
}

/**
 * True when the current key encoded an expiry that has passed. The feature set
 * still runs - this exists so a host can show its own banner rather than rely
 * on the built-in card. Returns false when the key carries no expiry.
 */
export function isLicenseExpired(): boolean {
  return checkLicenseKey(currentKey).expired === true
}

/** When the current key lapses, or null if it encodes no expiry. */
export function getLicenseExpiry(): Date | null {
  return checkLicenseKey(currentKey).expiresAt ?? null
}

/**
 * Soft-gate a Pro surface: if the current key isn't valid, nudge (watermark +
 * one-time console log + a moment-of-intent upgrade card naming `feature`) and
 * return. NEVER throws and NEVER blocks - the feature always runs. This is the
 * gate the Studio uses, and it's safe to call on the server (the nudges no-op
 * without a DOM). Idempotent/self-throttling, so call it freely at chokepoints.
 */
export function nudgeEnterprise(feature?: EnterpriseFeatureLabel): void {
  const info = checkLicenseKey(currentKey)
  // `valid` stays true past a trial's expiry (the feature keeps running), so
  // checking it alone would let a lapsed trial through silently forever.
  if (info.valid && !info.expired) return
  const lapsedTrial = info.valid && info.expired === true
  // A lapsed trial gets the same treatment as an unlicensed app - watermark,
  // console notice and card. The evaluation is over; the app keeps running,
  // but it stops looking licensed.
  emitUnlicensedNudge()
  if (lapsedTrial) noticeExpired(info)
  showUpgradePrompt(feature, { expired: lapsedTrial })
}

export function assertEnterpriseLicensed(feature?: EnterpriseFeatureLabel): void {
  const info: LicenseInfo = checkLicenseKey(currentKey)
  switch (info.status) {
    case 'unset':
      // Soft-gate: the feature still runs, but the user gets a watermark +
      // a one-time console.log nudge directing them to pricing, plus a
      // contextual moment-of-intent upgrade card naming the feature they
      // just reached for.
      emitUnlicensedNudge()
      showUpgradePrompt(feature)
      return
    case 'invalid':
      throw new Error(
        `@svgrid/enterprise: invalid license key format (expected "${VALID_PREFIX}..." prefix).`,
      )
    case 'revoked':
      throw new Error(
        '@svgrid/enterprise: this license key has been revoked. ' +
          'Contact sales@jqwidgets.com for a replacement.',
      )
    case 'dev':
    case 'eval':
      if (info.expired) {
        // The trial is over. Deliberately NOT a throw: the app keeps working,
        // so the developer sees the nudges without their users hitting a broken
        // build. Watermark + console notice + card, same as an unlicensed app.
        emitUnlicensedNudge()
        noticeExpired(info)
        showUpgradePrompt(feature, { expired: true })
        return
      }
      if (!noticedDev) {
        // eslint-disable-next-line no-console
        console.info(
          '@svgrid/enterprise: using a development / evaluation license. Not for production use.',
        )
        noticedDev = true
      }
      return
    case 'licensed':
      return
  }
}
