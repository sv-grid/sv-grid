# `@svgrid/grid` · `chart-format.ts`

Auto-generated. Source: `packages\grid\src\chart-format.ts`.

### `function formatChartValue`

Format a numeric value for display, honouring an optional `valueFormat`.

Two modes, on purpose. With no `locale` and no `currency` this is the original
locale-free output: the compact `1.2k` / `1.2M` base, currency prefixed with
`$` (sign outside), percent multiplied by 100 and suffixed `%`. Set either one
and it switches to `Intl.NumberFormat`, so separators, the decimal mark and the
compact suffixes all follow the locale.

Keeping the old path as the default is deliberate rather than lazy. `Intl`'s
compact notation is not the same string even for `en-US` (`1.2K`, capital),
so formatting everything through it would silently restyle every axis in every
existing chart. Opting in is the only version of this that is not a surprise.

```ts
export function formatChartValue(
  n: number,
  format?: ChartValueFormat,
  opts?: ChartFormatLocale,
): string {
  if (!Number.isFinite(n)) return ''
  const localized = opts && (opts.locale || opts.currency)
  if (localized) {
    // Compact notation because these are axis ticks and data labels, where a
    // full-precision number is what makes an axis unreadable.
    const style = format === 'currency' ? 'currency' : format === 'percent' ? 'percent' : 'decimal'
    const o: Intl.NumberFormatOptions = { notation: 'compact', maximumFractionDigits: 1 }
    if (style === 'currency') {
      o.style = 'currency'
      // `style: 'currency'` throws without a code, so fall back to the symbol
      // this used to hard-code rather than refusing to draw the chart.
      o.currency = opts!.currency || 'USD'
    } else if (style === 'percent') {
      o.style = 'percent'
    }
    return getNumberFormatter(opts!.locale, o).format(n)
  }
  if (format === 'currency') return `${n < 0 ? '-' : ''}$${fmtTick(Math.abs(n))}`
  if (format === 'percent') {
    const p = n * 100
    return `${Math.round(p * 10) / 10}%`
  }
  return fmtTick(n)
}
```
