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
  /** Expiry encoded in the key, when it carries one. Undefined otherwise. */
  expiresAt?: Date
  /**
   * True once `expiresAt` has passed. Deliberately does NOT clear `valid`:
   * an expired trial keeps working and the callers nudge instead. Turning a
   * lapsed key into a hard stop would break a running app on a date boundary,
   * which is exactly what a soft gate exists to avoid.
   */
  expired?: boolean
}

/**
 * Pull the expiry out of a key.
 *
 * Keys are `SVENTERPRISE[-KIND]-<SLUG>-<SEATS>-<DATE>-<RANDOM>`, so the date is
 * always the second-to-last segment regardless of whether a KIND is present.
 * Two widths are accepted:
 *
 *   YYYYMM   - subscription granularity; expires at the end of that month.
 *   YYYYMMDD - trial granularity; expires at the end of that day.
 *
 * The 6-digit form came first, so every key issued before day-precision trials
 * existed still parses. Anything else (including the older keys whose slug sits
 * in that position) yields null, which reads as "no expiry encoded".
 *
 * Boundaries are UTC so a key does not lapse at a different instant per
 * timezone. Kept in sync with `tools/issue-license.mjs`.
 */
export function parseLicenseExpiry(key: string | null | undefined): Date | null {
  if (!key) return null
  const segments = key.split('-')
  if (segments.length < 3) return null
  const stamp = segments[segments.length - 2]
  if (stamp == null) return null

  if (/^\d{6}$/.test(stamp)) {
    const year = Number(stamp.slice(0, 4))
    const month = Number(stamp.slice(4, 6))
    if (month < 1 || month > 12) return null
    // Date.UTC's month is 0-based, so passing the 1-based month lands on the
    // first of the FOLLOWING month; one millisecond earlier is the last instant
    // of the month the key names.
    return new Date(Date.UTC(year, month, 1) - 1)
  }

  if (/^\d{8}$/.test(stamp)) {
    const year = Number(stamp.slice(0, 4))
    const month = Number(stamp.slice(4, 6))
    const day = Number(stamp.slice(6, 8))
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
    // Reject a date that rolled over (e.g. 20260231), which would otherwise
    // silently grant a few extra days.
    if (end.getUTCMonth() !== month - 1) return null
    return end
  }

  return null
}

/** Classify a license key string. Pure and side-effect-free.
 *  `now` is injectable so expiry behaviour is testable without faking clocks. */
export function checkLicenseKey(
  key: string | null | undefined,
  now: Date = new Date(),
): LicenseInfo {
  if (key == null || key === '') return { status: 'unset', valid: false }
  if (!key.startsWith(VALID_PREFIX)) return { status: 'invalid', valid: false }
  if (REVOKED_KEYS.has(key)) return { status: 'revoked', valid: false }

  const expiresAt = parseLicenseExpiry(key) ?? undefined
  // Left undefined rather than false when the key encodes no date, so callers
  // can tell "not expired" apart from "no expiry to check".
  const expired = expiresAt ? now.getTime() > expiresAt.getTime() : undefined

  const status: LicenseStatus = key.startsWith('SVENTERPRISE-DEV')
    ? 'dev'
    : key.startsWith('SVENTERPRISE-EVAL')
      ? 'eval'
      : 'licensed'

  return { status, valid: true, expiresAt, expired }
}
