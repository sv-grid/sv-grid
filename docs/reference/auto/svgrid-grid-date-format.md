# `@svgrid/grid` · `datetime/date-format.ts`

Auto-generated. Source: `packages\grid\src\datetime\date-format.ts`.

### `function tokenizeMask`

Split a mask into an ordered list of token / literal parts. */

```ts
export function tokenizeMask(mask: string): Part[] {
  const parts: Part[] = []
  let i = 0
  while (i < mask.length) {
    const ch = mask[i]!
    // Backslash escape: next char is a literal.
    if (ch === '\\' && i + 1 < mask.length) {
      parts.push({ literal: mask[i + 1]! })
      i += 2
      continue
    }
    // Single-quoted literal run.
    if (ch === "'") {
      let j = i + 1
      let lit = ''
      while (j < mask.length && mask[j] !== "'") {
        lit += mask[j]
        j++
      }
      parts.push({ literal: lit })
      i = j + 1 // skip closing quote (or run to end)
      continue
    }
    // Greedy longest-token match.
    let matched: string | null = null
    for (const t of TOKENS) {
      if (mask.startsWith(t, i)) {
        matched = t
        break
      }
    }
    if (matched) {
      parts.push({ token: matched })
      i += matched.length
    } else {
      parts.push({ literal: ch })
      i += 1
    }
  }
  return parts
}
```

### `function formatDate`

Render `date` per `mask` in `locale`. */

```ts
export function formatDate(date: Date, mask: string, locale = 'en-US'): string {
  const parts = tokenizeMask(mask)
  const h24 = date.getHours()
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const ms = date.getMilliseconds()
  let out = ''
  for (const p of parts) {
    if ('literal' in p) {
      out += p.literal
      continue
    }
    switch (p.token) {
      case 'd': out += String(date.getDate()); break
      case 'dd': out += pad(date.getDate(), 2); break
      case 'ddd': out += weekdayNames(locale).short[date.getDay()]; break
      case 'dddd': out += weekdayNames(locale).long[date.getDay()]; break
      case 'M': out += String(date.getMonth() + 1); break
      case 'MM': out += pad(date.getMonth() + 1, 2); break
      case 'MMM': out += monthNames(locale).short[date.getMonth()]; break
      case 'MMMM': out += monthNames(locale).long[date.getMonth()]; break
      case 'yy': out += pad(date.getFullYear() % 100, 2); break
      case 'yyyy': out += pad(date.getFullYear(), 4); break
      case 'H': out += String(h24); break
      case 'HH': out += pad(h24, 2); break
      case 'h': out += String(h12); break
      case 'hh': out += pad(h12, 2); break
      case 'm': out += String(date.getMinutes()); break
      case 'mm': out += pad(date.getMinutes(), 2); break
      case 's': out += String(date.getSeconds()); break
      case 'ss': out += pad(date.getSeconds(), 2); break
      case 'f': out += pad(ms, 3).slice(0, 1); break
      case 'ff': out += pad(ms, 3).slice(0, 2); break
      case 'fff': out += pad(ms, 3); break
      case 't': out += (h24 < 12 ? dayPeriods(locale).am : dayPeriods(locale).pm).slice(0, 1); break
      case 'tt': out += h24 < 12 ? dayPeriods(locale).am : dayPeriods(locale).pm; break
      default: out += p.token
    }
  }
  return out
}
```

### `function parseDate`

Parse `str` against `mask` in `locale`. Returns a Date or null if the string
does not satisfy the mask. `yearCutoff` disambiguates 2-digit years: values
<= (yearCutoff % 100) map to 2000s, above to 1900s (Smart's default 1926 ->
a 26 pivot). `base` supplies fields the mask omits (defaults to epoch-zero
local midnight so a time-only mask yields a today-agnostic time).

```ts
export function parseDate(
  str: string,
  mask: string,
  locale = 'en-US',
  yearCutoff = 2029,
  base?: Date,
): Date | null {
  const parts = tokenizeMask(mask)
  const acc: Acc = {}
  let i = 0
  const s = str
  for (const p of parts) {
    if ('literal' in p) {
      // Literals must match (whitespace-insensitive at the boundary).
      for (const ch of p.literal) {
        if (ch === ' ') {
          while (s[i] === ' ') i++
          continue
        }
        if (s[i] !== ch) return null
        i++
      }
      continue
    }
    const tok = p.token
    switch (tok) {
      case 'ddd':
      case 'dddd': {
        const m = matchName(s, i, weekdayNames(locale)[tok === 'ddd' ? 'short' : 'long'])
        if (!m) return null
        i += m.len // weekday is informational; day-of-month drives the date
        break
      }
      case 'MMM':
      case 'MMMM': {
        const m = matchName(s, i, monthNames(locale)[tok === 'MMM' ? 'short' : 'long'])
        if (!m) return null
        acc.month = m.index
        i += m.len
        break
      }
      case 't':
      case 'tt': {
        const dp = dayPeriods(locale)
        const lower = s.slice(i).toLowerCase()
        if (lower.startsWith(dp.pm.toLowerCase())) { acc.isPm = true; i += dp.pm.length }
        else if (lower.startsWith(dp.am.toLowerCase())) { acc.isPm = false; i += dp.am.length }
        else if (lower.startsWith(dp.pm.slice(0, 1).toLowerCase())) { acc.isPm = true; i += 1 }
        else if (lower.startsWith(dp.am.slice(0, 1).toLowerCase())) { acc.isPm = false; i += 1 }
        else return null
        break
      }
      default: {
        const r = readDigits(s, i, MAX_DIGITS[tok] ?? 2)
        if (!r) return null
        i += r.len
        const v = r.value
        switch (tok) {
          case 'd': case 'dd': acc.day = v; break
          case 'M': case 'MM': acc.month = v - 1; break
          case 'yy': acc.year = v <= yearCutoff % 100 ? 2000 + v : 1900 + v; break
          case 'yyyy': acc.year = v; break
          case 'H': case 'HH': acc.hour = v; break
          case 'h': case 'hh': acc.hour12 = v; break
          case 'm': case 'mm': acc.minute = v; break
          case 's': case 'ss': acc.second = v; break
          case 'f': acc.ms = v * 100; break
          case 'ff': acc.ms = v * 10; break
          case 'fff': acc.ms = v; break
        }
      }
    }
  }
  // Trailing input that the mask did not consume is a mismatch.
  if (i !== s.length && s.slice(i).trim() !== '') return null

  const b = base ?? new Date(1970, 0, 1)
  let hour = acc.hour
  if (hour == null && acc.hour12 != null) {
    hour = acc.hour12 % 12
    if (acc.isPm) hour += 12
  }
  const year = acc.year ?? b.getFullYear()
  const month = acc.month ?? b.getMonth()
  const day = acc.day ?? b.getDate()
  const result = new Date(
    year,
    month,
    day,
    hour ?? b.getHours(),
    acc.minute ?? b.getMinutes(),
    acc.second ?? b.getSeconds(),
    acc.ms ?? b.getMilliseconds(),
  )
  // Reject impossible dates the constructor silently rolls over (e.g. Feb 31).
  if (
    (acc.day != null && result.getDate() !== day) ||
    (acc.month != null && result.getMonth() !== month)
  ) {
    return null
  }
  return isNaN(result.getTime()) ? null : result
}
```
