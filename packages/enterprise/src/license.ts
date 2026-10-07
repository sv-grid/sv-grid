// Polite license gate. Not DRM - anyone with devtools can patch a deployed
// bundle. The point is to make commercial use require a transaction, not to
// defeat reverse engineering.
//
// One license key for every customer (see license-core.ts); the package keeps
// only its SHA-256. Behavior:
//
//   currentKey state                  -> result
//   ────────────────────────────────────────────────────────────────────
//   null (no key set)                 -> evaluation: watermark + console.log
//                                        + upgrade card, feature still runs
//   anything but the license key      -> same as no key, plus a one-time
//                                        console warning that the key is not
//                                        valid. Never throws: a wrong key must
//                                        not break a running app.
//   the license key                   -> works silently, every edition, no
//                                        expiry (a paid key never lapses into
//                                        the watermark; EULA s.6)
//
// On svgrid.com itself none of the nudges show (first-party.ts).
//
// The dev / eval / expiry branches below stay for the statuses the type still
// names; the one-key check never produces them.
import {
  checkLicenseKey,
  editionCovers,
  type LicenseInfo,
  type LicensedProduct,
} from './license-core'
import { emitUnlicensedNudge } from './watermark'
import { isFirstPartySite } from './first-party'
import { showUpgradePrompt, type EnterpriseFeatureLabel } from './upgrade-prompt'

export {
  checkLicenseKey,
  editionCovers,
  type LicenseInfo,
  type LicenseStatus,
  type LicenseEdition,
  type LicensedProduct,
} from './license-core'
// The nudge the key silences, on the same subpath as the key: an app that only
// wants to set its licence imports `@svgrid/enterprise/license` and never
// pulls the component barrel (the package has no `sideEffects` flag, so a
// barrel import carries every module it reaches into the importer's chunk).
export { dismissUnlicensedNudge } from './watermark'

let currentKey: string | null = null
let noticedDev = false
let noticedExpired = false
/** One notice per product, not per call site: reaching four Studio seams on a
 *  Grid key is one licensing fact, not four. */
const noticedEdition = new Set<LicensedProduct>()

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
      'Contact sales@jqwidgets.com or see https://svgrid.com/pricing/?utm_source=svgrid-enterprise&utm_medium=console',
  )
}

/** dev / eval keys are trials; only they can lapse. */
function isTrial(info: LicenseInfo): boolean {
  return info.status === 'dev' || info.status === 'eval'
}

let noticedInvalid = false
/** One-time console warning for a key that is set but is not the license key. */
function noticeInvalid(info: LicenseInfo): void {
  if (noticedInvalid || (info.status !== 'invalid' && info.status !== 'revoked')) return
  if (isFirstPartySite()) return
  noticedInvalid = true
  // eslint-disable-next-line no-console
  console.warn(
    '@svgrid/enterprise: the license key passed to setLicenseKey() is not valid, so the ' +
      'watermark stays. Copy the key from your order email, or contact sales@jqwidgets.com.',
  )
}

export function setLicenseKey(key: string): void {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('@svgrid/enterprise: setLicenseKey() requires a non-empty string')
  }
  currentKey = key
  noticedDev = false
  noticedExpired = false
  noticedInvalid = false
  noticedEdition.clear()
}

export function clearLicenseKey(): void {
  currentKey = null
  noticedDev = false
  noticedExpired = false
  noticedInvalid = false
  noticedEdition.clear()
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
 * Gate a Pro surface: if the current key isn't valid, nudge (watermark +
 * one-time console log + a moment-of-intent upgrade card naming `feature`) and
 * return. NEVER throws and NEVER blocks - the feature always runs. This is the
 * gate the Studio uses, and it's safe to call on the server (the nudges no-op
 * without a DOM). Idempotent/self-throttling, so call it freely at chokepoints.
 */
export function nudgeEnterprise(feature?: EnterpriseFeatureLabel): void {
  const info = checkLicenseKey(currentKey)
  // `valid` stays true past a trial's expiry (the feature keeps running), so
  // checking it alone would let a lapsed trial through silently forever.
  // Only a trial key can lapse. A paid key carries no expiry, and even if one
  // ever did, it must not bring the watermark back (EULA s.6).
  const lapsedTrial = isTrial(info) && info.expired === true
  if (info.valid && !lapsedTrial) return
  noticeInvalid(info)
  // A lapsed trial gets the same treatment as an unlicensed app - watermark,
  // console notice and card. The evaluation is over; the app keeps running,
  // but it stops looking licensed.
  emitUnlicensedNudge()
  if (lapsedTrial) noticeExpired(info)
  showUpgradePrompt(feature, { expired: lapsedTrial })
}

/** Human name for a product, for the console notice. */
const PRODUCT_LABEL: Record<LicensedProduct, string> = {
  grid: 'the enterprise grid',
  spreadsheet: 'the spreadsheet',
  studio: 'the Studio',
}

/** One-time console notice for a feature the current edition does not cover.
 *  Distinct from the unlicensed nudge: the key is real and paid, it just does
 *  not reach this far, so the actionable part is which edition to move to. */
function noticeEdition(product: LicensedProduct): void {
  if (noticedEdition.has(product)) return
  noticedEdition.add(product)
  // eslint-disable-next-line no-console
  console.info(
    `@svgrid/enterprise: your Grid license does not cover ${PRODUCT_LABEL[product]}. ` +
      'Everything still works, but the watermark and upgrade notice stay until the ' +
      'license is upgraded to Suite. Contact sales@jqwidgets.com or see ' +
      'https://svgrid.com/pricing/?utm_source=svgrid-enterprise&utm_medium=console',
  )
}

/**
 * True when the current key covers `product`. Use it to hide a Suite-only entry
 * point in your own UI instead of letting it nudge. An unlicensed app returns
 * false for everything, which keeps "no key" and "wrong edition" on the same
 * side of the branch for UI purposes.
 */
export function licenseCovers(product: LicensedProduct): boolean {
  const info = checkLicenseKey(currentKey)
  return info.valid && editionCovers(info.edition, product)
}

/** The edition the current key names, or null when no usable key is set. */
export function getLicenseEdition(): LicenseInfo['edition'] | null {
  const info = checkLicenseKey(currentKey)
  return info.valid ? info.edition : null
}

/**
 * Gate a surface that an edition can exclude. Same contract as
 * {@link nudgeEnterprise} - never throws, never blocks, safe on the server -
 * but it also nudges a valid key that simply does not reach this product.
 */
export function nudgeEnterpriseFor(
  product: LicensedProduct,
  feature?: EnterpriseFeatureLabel,
): void {
  const info = checkLicenseKey(currentKey)
  const covered = info.valid && editionCovers(info.edition, product)
  const lapsedTrial = isTrial(info) && info.expired === true
  if (covered && !lapsedTrial) return
  noticeInvalid(info)
  // A key that is valid, unexpired and merely out of edition is a different
  // message from an unlicensed or lapsed one, so it gets its own notice. The
  // watermark and the card are the same either way.
  const outOfEdition = info.valid && !lapsedTrial && !covered
  emitUnlicensedNudge()
  if (outOfEdition) noticeEdition(product)
  else if (lapsedTrial) noticeExpired(info)
  showUpgradePrompt(feature, { expired: lapsedTrial })
}

export function assertEnterpriseLicensed(feature?: EnterpriseFeatureLabel): void {
  const info: LicenseInfo = checkLicenseKey(currentKey)
  switch (info.status) {
    case 'unset':
      // Evaluation: the feature still runs, but the user gets a watermark +
      // a one-time console.log nudge directing them to pricing, plus a
      // contextual moment-of-intent upgrade card naming the feature they
      // just reached for.
      emitUnlicensedNudge()
      showUpgradePrompt(feature)
      return
    case 'invalid':
    case 'revoked':
      // A wrong key is treated like no key: the feature runs, nudged. It used to
      // throw, which turned a typo (or an old-format key) into a broken app.
      noticeInvalid(info)
      emitUnlicensedNudge()
      showUpgradePrompt(feature)
      return
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
