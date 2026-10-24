/**
 * Value equality for change review: is a cell still what a proposal saw, and
 * is a proposal a no-op. `Object.is` for primitives, Dates by time, arrays
 * and plain objects by structure. Blank (null, undefined, '') equals blank,
 * the same rule Base sync uses (`fields/base-sync.ts`), so a cell cleared to
 * '' does not make a proposal made against `null` look stale.
 */

export const isBlank = (v: unknown): boolean => v == null || v === ''

export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (isBlank(a) && isBlank(b)) return true
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((v, i) => sameValue(v, b[i]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a)
    if (ka.length !== Object.keys(b).length) return false
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && sameValue(a[k], b[k]))
  }
  return false
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}
