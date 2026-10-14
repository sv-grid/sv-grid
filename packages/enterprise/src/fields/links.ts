/**
 * Hrefs for URL, email and phone cells. Cell values are data, so an href is
 * built only for the schemes these fields mean: a value like
 * `javascript:alert(1)` in a URL column must never become a link.
 */

export type LinkKind = 'url' | 'email' | 'phone'

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/

/** The href for a cell value, or null when the value is not a link of that kind. */
export function linkHref(kind: LinkKind, value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  if (kind === 'email') {
    const address = text.replace(/^mailto:/i, '')
    return EMAIL.test(address) ? `mailto:${address}` : null
  }
  if (kind === 'phone') {
    // Digits, an optional leading +, and the separators people type.
    const digits = text.replace(/^tel:/i, '').replace(/[\s().-]/g, '')
    return /^\+?\d{3,20}$/.test(digits) ? `tel:${digits}` : null
  }
  // url: only http(s). A bare host ("svgrid.com/docs") gets https://.
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`
  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') return null
  return parsed.href
}

/** What the cell shows: the value without the scheme noise. */
export function linkText(kind: LinkKind, value: unknown): string {
  const text = value == null ? '' : String(value).trim()
  if (kind === 'url') return text.replace(/^https?:\/\//i, '').replace(/\/$/, '')
  if (kind === 'email') return text.replace(/^mailto:/i, '')
  return text.replace(/^tel:/i, '')
}
