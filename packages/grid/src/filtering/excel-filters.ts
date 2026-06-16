export type ExcelFilterOperator =
  | 'contains'
  | 'equals'
  | 'startsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'between'
  | 'isBlank'

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
    case 'equals':
      return normalizedText === normalizedValue
    case 'startsWith':
      return normalizedText.startsWith(normalizedValue)
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
  }
}
