<script lang="ts">
  // Interactive demo for CellFormatConfig: the same numbers / dates rendered
  // through each format type. Switch the locale to see Intl do its work.
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
  } from 'sv-grid-core'

  const features = tableFeatures({ rowSortingFeature })

  type Row = { label: string; n: number; pct: number; when: string }
  const rows: Row[] = [
    { label: 'Row A', n: 1234567.5, pct: 0.158, when: '2024-03-15T09:30:00Z' },
    { label: 'Row B', n: 89.4, pct: 0.4203, when: '2024-07-01T18:05:00Z' },
    { label: 'Row C', n: -4200, pct: 0.009, when: '2024-11-22T23:59:00Z' },
  ]

  let locale = $state<'en-US' | 'de-DE' | 'ja-JP'>('en-US')
  let currency = $state<'USD' | 'EUR' | 'JPY'>('USD')

  const columns = $derived<ColumnDef<typeof features, Row>[]>([
    { field: 'label', header: 'Row', width: 90 },
    { field: 'n', header: 'number', width: 150,
      format: { type: 'number', locales: locale, options: { maximumFractionDigits: 2 } } },
    { field: 'n', id: 'cur', header: 'currency', width: 150,
      format: { type: 'currency', currency, locales: locale } },
    { field: 'pct', header: 'percent', width: 110,
      format: { type: 'percent', locales: locale, options: { maximumFractionDigits: 1 } } },
    { field: 'when', header: 'date', width: 130,
      format: { type: 'date', pattern: 'y-m-d', locales: locale } },
    { field: 'when', id: 'dt', header: 'datetime', width: 200,
      format: { type: 'datetime', pattern: 'medium', locales: locale } },
  ])
</script>

<div class="flex flex-wrap items-center gap-3 mb-3 text-xs font-mono">
  <label class="inline-flex items-center gap-1.5">
    locale
    <select bind:value={locale} class="rounded border px-2 py-1"
      style="border-color: var(--sg-border); background: var(--sg-bg); color: var(--sg-fg);">
      <option value="en-US">en-US</option>
      <option value="de-DE">de-DE</option>
      <option value="ja-JP">ja-JP</option>
    </select>
  </label>
  <label class="inline-flex items-center gap-1.5">
    currency
    <select bind:value={currency} class="rounded border px-2 py-1"
      style="border-color: var(--sg-border); background: var(--sg-bg); color: var(--sg-fg);">
      <option value="USD">USD</option>
      <option value="EUR">EUR</option>
      <option value="JPY">JPY</option>
    </select>
  </label>
</div>

<div style="height: 200px;">
  <SvGrid data={rows} {columns} {features} fitColumns rowHeight={34} containerHeight="100%" />
</div>

<p class="mt-2 text-xs" style="color: var(--sg-muted);">
  The "number" and "currency" columns render the same underlying value through
  different <code>format</code> configs. Change locale / currency to watch
  <code>Intl</code> re-format grouping, symbols, and date order.
</p>
