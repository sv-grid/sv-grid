/**
 * Number formatting for chart values: the compact `1.2k` tick label and
 * `formatChartValue`, which honours a spec's `valueFormat`, `locale` and
 * `currency`.
 *
 * A leaf of its own, and deliberately small. The chart engine and the lazily
 * loaded summary (chart-summary.ts) both need it, and a bundler hoists
 * whatever the base chunk and a lazy chunk share into a third chunk. When
 * that shared module was all of chart-scale.ts the hoist cost the base
 * bundle a kilobyte of gzip locality for no new code; two functions cost a
 * few dozen bytes. chart-scale.ts re-exports both, so importers of the old
 * home keep working.
 */
import { getNumberFormatter } from './cell-formatting'
import type { ChartFormatLocale, ChartValueFormat } from './chart-types'

/** @internal Locale-free compact tick label (1.2k / 1.2M). */
export function fmtTick(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs % 1_000_000 ? 1 : 0)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs % 1_000 ? 1 : 0)}k`
  return String(Math.round(n * 100) / 100)
}

/**
 * Format a numeric value for display, honouring an optional `valueFormat`.
 *
 * Two modes, on purpose. With no `locale` and no `currency` this is the original
 * locale-free output: the compact `1.2k` / `1.2M` base, currency prefixed with
 * `$` (sign outside), percent multiplied by 100 and suffixed `%`. Set either one
 * and it switches to `Intl.NumberFormat`, so separators, the decimal mark and the
 * compact suffixes all follow the locale.
 *
 * Keeping the old path as the default is deliberate rather than lazy. `Intl`'s
 * compact notation is not the same string even for `en-US` (`1.2K`, capital),
 * so formatting everything through it would silently restyle every axis in every
 * existing chart. Opting in is the only version of this that is not a surprise.
 */
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
