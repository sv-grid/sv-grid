# `@svgrid/grid` · `cell-formatting.ts`

Auto-generated. Source: `packages\grid\src\cell-formatting.ts`.

### `function resolveDatePattern`

Map shortcut date patterns to Intl options (merged with caller `options`). */

```ts
export function resolveDatePattern(
  pattern: string | undefined,
  kind: 'date' | 'datetime',
): Intl.DateTimeFormatOptions | undefined {
  if (!pattern) return undefined

  const p = pattern.trim()

  switch (p) {
    /** Short numeric local date (no weekday). */
    case 'd':
      return kind === 'datetime'
        ? {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
          }
        : { year: 'numeric', month: 'numeric', day: 'numeric' }
    /** Long spelled-out date (+ time if datetime). */
    case 'D':
      return kind === 'datetime'
        ? {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
          }
        : { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    /** ISO-friendly yyyy-mm-dd (with time when datetime). */
    case 'y-m-d':
      return kind === 'datetime'
        ? {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }
        : { year: 'numeric', month: '2-digit', day: '2-digit' }
    case 'medium':
      return { dateStyle: 'medium', timeStyle: kind === 'datetime' ? 'short' : undefined }
    case 'short':
      return { dateStyle: 'short', timeStyle: kind === 'datetime' ? 'short' : undefined }
    case 'long':
      return { dateStyle: 'long', timeStyle: kind === 'datetime' ? 'short' : undefined }
    default:
      return undefined
  }
}
```

### `function getDateFormatter`

A cached `Intl.DateTimeFormat` for the locale and options given. Cached because
 constructing one per cell is the dominant cost when formatting a date column. */

```ts
export function getDateFormatter(
  locales: string | readonly string[] | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key =
    (Array.isArray(locales) ? locales.join(',') : locales ?? '') +
    '|' +
    (options.dateStyle ?? '') +
    '|' +
    (options.timeStyle ?? '') +
    '|' +
    (options.year ?? '') +
    '|' +
    (options.month ?? '') +
    '|' +
    (options.day ?? '') +
    '|' +
    (options.hour ?? '') +
    '|' +
    (options.minute ?? '') +
    '|' +
    (options.second ?? '') +
    '|' +
    (options.weekday ?? '') +
    '|' +
    (options.hour12 ?? '')
  let fmt = dateFormatterCache.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locales as string | string[] | undefined, options)
    dateFormatterCache.set(key, fmt)
  }
  return fmt
}
```

### `function formatNumericWithConfig`

Format a numeric value for number / currency / percent column formats. */

```ts
export function formatNumericWithConfig(value: unknown, config: NumericFormatInput): string {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return String(value ?? '')

  const locales = config.locales

  if (config.type === 'currency') {
    return getNumberFormatter(locales, {
      style: 'currency',
      currency: config.currency ?? 'USD',
      ...config.options,
    }).format(n)
  }

  if (config.type === 'percent') {
    const frac = config.valueIsPercentPoints === true ? n / 100 : n
    return getNumberFormatter(locales, {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      ...config.options,
    }).format(frac)
  }

  return getNumberFormatter(locales, config.options ?? {}).format(n)
}
```
