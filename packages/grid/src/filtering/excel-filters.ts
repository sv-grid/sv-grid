export type ExcelFilterOperator =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'regex'
  | 'in'
  | 'notIn'
  | 'greaterThan'
  | 'lessThan'
  | 'between'
  | 'isBlank'
  | 'isNotBlank'

export type ExcelFilter = {
  id: string
  operator: ExcelFilterOperator
  value?: unknown
  valueTo?: unknown
}

export type ExcelFilterOptions = {
  /**
   * BCP-47 locale tag (or fallback list) for accent- and case-
   * insensitive text comparison. When set, "café", "Café" and "CAFÉ"
   * all match "cafe" without strain.
   *
   * Implementation: NFD-decompose both sides, strip combining marks
   * (diacritics), then locale-aware lowercase. This is the standard
   * "lowercase + asciifolding" pipeline used by Elasticsearch, Postgres
   * (with `unaccent`), and Lucene. Cheap, deterministic, no Collator
   * round-trip.
   */
  locale?: string | ReadonlyArray<string>
}

// U+0300..U+036F is the Combining Diacritical Marks block. After NFD
// decomposition accented characters become "base char + combining mark";
// stripping the marks leaves the bare ASCII base.
const DIACRITIC_RE = /[̀-ͯ]/g

/** NFD-decompose, strip combining marks (diacritics), then locale-aware
 *  lowercase. The locale-aware lowercasing handles Turkish dotted-I /
 *  dotless-i correctly when the consumer threads `"tr"` through. */
export function normalizeForFilter(
  s: string,
  locale?: string | ReadonlyArray<string>,
): string {
  if (!s) return ''
  const stripped = s.normalize('NFD').replace(DIACRITIC_RE, '')
  return locale
    ? stripped.toLocaleLowerCase(locale as string | string[])
    : stripped.toLowerCase()
}

/**
 * Delimiter used to serialise the `in` / `notIn` value list into the single
 * `value` string that the filter model carries. A newline is used because it
 * (unlike a comma) practically never appears inside a typed token, so tokens
 * survive the round-trip unescaped. The chip input in the filter row reads and
 * writes with the same separator via {@link splitInTokens} / {@link joinInTokens}.
 */
export const IN_TOKEN_SEP = '\n'

/**
 * Split a serialised `in` / `notIn` value into its individual tokens. Accepts
 * both the newline separator the chip input writes and a plain comma-separated
 * string (what a raw text field, e.g. the tool-panel filter, produces), so the
 * same value round-trips through either UI.
 */
export function splitInTokens(value: unknown): string[] {
  return String(value ?? '')
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

/** Serialise a list of tokens back into the single `in` / `notIn` value. */
export function joinInTokens(tokens: ReadonlyArray<string>): string {
  return tokens.map((t) => t.trim()).filter((t) => t.length > 0).join(IN_TOKEN_SEP)
}

export function applyExcelFilter(
  cellValue: unknown,
  filter: ExcelFilter,
  options?: ExcelFilterOptions,
) {
  const text = String(cellValue ?? '')
  const normalizedText = normalizeForFilter(text, options?.locale)
  const normalizedValue = normalizeForFilter(String(filter.value ?? ''), options?.locale)
  switch (filter.operator) {
    case 'contains':
      return normalizedText.includes(normalizedValue)
    case 'notContains':
      // An empty needle is no constraint (mirrors `contains` returning true),
      // so nothing is excluded until the user types something.
      return normalizedValue === '' || !normalizedText.includes(normalizedValue)
    case 'equals':
      return normalizedText === normalizedValue
    case 'notEquals':
      return normalizedValue === '' || normalizedText !== normalizedValue
    case 'startsWith':
      return normalizedText.startsWith(normalizedValue)
    case 'endsWith':
      return normalizedText.endsWith(normalizedValue)
    case 'regex': {
      // Case-insensitive by default (matches the accent/case-folded feel of
      // the other text operators). An invalid pattern matches nothing rather
      // than throwing, so a half-typed regex never crashes the row model.
      const pattern = String(filter.value ?? '')
      if (!pattern) return true
      try {
        return new RegExp(pattern, 'i').test(text)
      } catch {
        return false
      }
    }
    case 'in':
    case 'notIn': {
      const tokens = splitInTokens(filter.value)
      if (tokens.length === 0) return true
      const hit = tokens.some(
        (t) => normalizeForFilter(t, options?.locale) === normalizedText,
      )
      return filter.operator === 'in' ? hit : !hit
    }
    case 'greaterThan': {
      const a = Number(cellValue)
      const b = Number(filter.value)
      if (Number.isFinite(a) && Number.isFinite(b)) return a > b
      return String(cellValue ?? '') > String(filter.value ?? '')
    }
    case 'lessThan': {
      const a = Number(cellValue)
      const b = Number(filter.value)
      if (Number.isFinite(a) && Number.isFinite(b)) return a < b
      return String(cellValue ?? '') < String(filter.value ?? '')
    }
    case 'between': {
      // Two paths: numeric (coerce both endpoints with the historical
      // `?? 0` fallback) and string (used when EITHER endpoint is a
      // non-numeric string like an ISO date). Numeric wins when its
      // operands are finite so callers passing numeric ages, prices, etc.
      // see the historical inclusive-range behaviour.
      const lo = filter.value   == null ? 0 : Number(filter.value)
      const hi = filter.valueTo == null ? 0 : Number(filter.valueTo)
      const a  = Number(cellValue ?? 0)
      if (Number.isFinite(a) && Number.isFinite(lo) && Number.isFinite(hi)) {
        return a >= lo && a <= hi
      }
      // Either endpoint is non-numeric (ISO date string, etc). Compare
      // lexicographically - YYYY-MM-DD orders chronologically so the
      // result matches user intent.
      const s  = String(cellValue ?? '')
      const sl = String(filter.value ?? '')
      const sh = String(filter.valueTo ?? '')
      return s >= sl && s <= sh
    }
    case 'isBlank':
      return text.trim().length === 0
    case 'isNotBlank':
      return text.trim().length > 0
  }
}
