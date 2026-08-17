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
 * `value` string that the filter model carries.
 *
 * This has to be single-line safe: the tool panel and the filter menu show the
 * serialised list in a plain `<input type="text">`, and the HTML input value
 * sanitiser STRIPS newlines - so a newline-joined list came back out of the DOM
 * as one run-together token. `splitInTokens` accepts newlines too, so values
 * serialised by older builds still parse.
 */
export const IN_TOKEN_SEP = ', '

/**
 * Split a serialised `in` / `notIn` value into its individual tokens.
 *
 * The grammar is CSV-shaped: comma OR newline separates, and a token may be
 * double-quoted to carry a separator literally (`""` escapes a quote inside
 * one). Quoting is what makes a comma separator safe - facet values commonly
 * contain commas of their own, because numeric bucket labels are built with
 * `toLocaleString` ("1,234 - 5,678") and date labels with a short month
 * ("Aug 17, 2026"). A quote only opens a token when it is the token's first
 * non-space character, so an unquoted `5" pipe` stays literal.
 */
export function splitInTokens(value: unknown): string[] {
  const { tokens, trailing } = scanInTokens(value)
  if (trailing) tokens.push(trailing)
  return tokens
}

/**
 * Serialise a list of tokens back into the single `in` / `notIn` value,
 * quoting any token that carries a separator or a quote of its own.
 */
export function joinInTokens(tokens: ReadonlyArray<string>): string {
  return tokens
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => (/["\n,]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t))
    .join(IN_TOKEN_SEP)
}

/**
 * The token still being typed at the end of an `in` / `notIn` value - the text
 * after the last separator. `'AAPL, MS'` -> `'MS'`; a value ending in a
 * separator (or empty) has no trailing token.
 *
 * Inputs that hold the whole token list use this to drive the value-suggestion
 * dropdown: the trailing fragment is the search query, not a committed token.
 */
export function trailingInToken(value: unknown): string {
  return scanInTokens(value).trailing
}

/**
 * One pass over a serialised `in` / `notIn` value, splitting it into the
 * tokens that are terminated by a separator and the unterminated fragment at
 * the end. Every token helper above is a view onto this, so they can never
 * disagree about where a quoted token starts or ends.
 */
function scanInTokens(value: unknown): { tokens: string[]; trailing: string } {
  const raw = String(value ?? '')
  const tokens: string[] = []
  let buf = ''
  let quoted = false
  let wasQuoted = false
  let closed = false

  // A quoted token keeps its inner spacing; an unquoted one is trimmed.
  const take = () => {
    const t = wasQuoted ? buf : buf.trim()
    buf = ''
    wasQuoted = false
    closed = false
    return t
  }

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]
    if (quoted) {
      if (ch !== '"') { buf += ch; continue }
      // A doubled quote is an escaped literal quote, not the closing one.
      if (raw[i + 1] === '"') { buf += '"'; i += 1; continue }
      quoted = false
      closed = true
      continue
    }
    if (ch === ',' || ch === '\n') {
      const t = take()
      if (t.length) tokens.push(t)
      continue
    }
    // Only opens a quoted token at the token's start - `5" pipe` is literal.
    if (ch === '"' && !closed && !buf.trim()) {
      quoted = true
      wasQuoted = true
      buf = ''
      continue
    }
    buf += ch
  }

  return { tokens, trailing: take() }
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
