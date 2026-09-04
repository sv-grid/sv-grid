<script lang="ts">
  /**
   * 15. Localization
   * ----------------
   * The same data, re-rendered as you flip locale + currency. Demonstrates
   * how the grid's `format` config and a tiny `messages` map cover the
   * 90% case: header text, dates, numbers, and currencies all switch
   * together. RTL flips the column order via `dir="rtl"` on the wrapper.
   *
   * Showcases:
   *   - `format: { type: 'date'|'number'|'currency' }` driven by the live
   *     locale prop on each column
   *   - Header text from a small i18n dictionary
   *   - RTL handling for Arabic
   *   - Locale-aware sort via `Intl.Collator` in a custom sort function
   *     would go here too - the grid's default sort already uses
   *     `String.prototype.localeCompare`, so we get that for free.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from '@svgrid/grid'

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  type Locale = 'en-US' | 'en-GB' | 'de-DE' | 'fr-FR' | 'ja-JP' | 'zh-CN' | 'ar-EG'
  type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'AED'

  type Order = {
    id: string
    customer: string
    country: string
    orderedAt: string  // ISO date
    qty: number
    unitPriceUSD: number
    totalUSD: number
    weightKg: number
  }

  const LOCALES: Array<{ id: Locale; label: string; flag: string; dir: 'ltr' | 'rtl' }> = [
    { id: 'en-US', label: 'English (US)',  flag: '🇺🇸', dir: 'ltr' },
    { id: 'en-GB', label: 'English (UK)',  flag: '🇬🇧', dir: 'ltr' },
    { id: 'de-DE', label: 'Deutsch',       flag: '🇩🇪', dir: 'ltr' },
    { id: 'fr-FR', label: 'Français',      flag: '🇫🇷', dir: 'ltr' },
    { id: 'ja-JP', label: '日本語',         flag: '🇯🇵', dir: 'ltr' },
    { id: 'zh-CN', label: '中文 (简体)',    flag: '🇨🇳', dir: 'ltr' },
    { id: 'ar-EG', label: 'العربية',       flag: '🇪🇬', dir: 'rtl' },
  ]

  const CURRENCIES: Array<{ id: Currency; rate: number }> = [
    { id: 'USD', rate: 1 },
    { id: 'EUR', rate: 0.93 },
    { id: 'GBP', rate: 0.79 },
    { id: 'JPY', rate: 156.4 },
    { id: 'CNY', rate: 7.24 },
    { id: 'AED', rate: 3.67 },
  ]

  // ---- localized header strings. Keep the keys English; translate values.
  type MessageKey = 'id' | 'customer' | 'country' | 'orderedAt' | 'qty' | 'unitPrice' | 'total' | 'weight'
  const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
    'en-US': { id: 'Order #',     customer: 'Customer',  country: 'Country', orderedAt: 'Ordered on', qty: 'Qty',     unitPrice: 'Unit price', total: 'Total',  weight: 'Weight' },
    'en-GB': { id: 'Order no.',   customer: 'Customer',  country: 'Country', orderedAt: 'Ordered on', qty: 'Qty',     unitPrice: 'Unit price', total: 'Total',  weight: 'Weight' },
    'de-DE': { id: 'Auftrag',     customer: 'Kunde',     country: 'Land',    orderedAt: 'Bestelldatum', qty: 'Menge', unitPrice: 'Stückpreis', total: 'Gesamt', weight: 'Gewicht' },
    'fr-FR': { id: 'Commande',    customer: 'Client',    country: 'Pays',    orderedAt: 'Date',        qty: 'Qté',    unitPrice: 'Prix unit.', total: 'Total',  weight: 'Poids' },
    'ja-JP': { id: '注文番号',     customer: '顧客',       country: '国',       orderedAt: '注文日',       qty: '数量',    unitPrice: '単価',       total: '合計',    weight: '重量' },
    'zh-CN': { id: '订单号',       customer: '客户',       country: '国家',     orderedAt: '下单日期',     qty: '数量',    unitPrice: '单价',       total: '总计',    weight: '重量' },
    'ar-EG': { id: 'رقم الطلب',  customer: 'العميل',    country: 'الدولة',  orderedAt: 'تاريخ الطلب', qty: 'الكمية', unitPrice: 'سعر الوحدة', total: 'الإجمالي', weight: 'الوزن' },
  }

  // ---- seeded PRNG so the demo's data is reproducible.
  let prngState = 0xDEFACED1
  function rand(): number {
    prngState = (prngState * 1664525 + 1013904223) >>> 0
    return prngState / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rand() * arr.length)]! }

  const CUSTOMERS = [
    'ACME Corp', 'Globex GmbH', 'Sushi Ran 株式会社', '北京贸易有限公司',
    'Atlas Logistics', 'Polar Imports', 'Tokyo Robotics', 'Mediterraneo SpA',
    'Quantum Foundry', 'Riverbend Foods', 'Volta Energy', 'Aurora Optics',
    'مؤسسة النيل للتجارة', 'Sahara Imports', 'Café Lumière',
  ]
  const COUNTRIES = ['US', 'GB', 'DE', 'FR', 'JP', 'CN', 'AE', 'IT', 'BR', 'CA']

  function makeOrders(count: number): Order[] {
    const out: Order[] = []
    const oneYearMs = 365 * 86_400_000
    const start = Date.now() - oneYearMs
    for (let i = 0; i < count; i += 1) {
      const qty = 1 + Math.floor(rand() * 80)
      const unitPriceUSD = Math.round((4 + rand() * 1_200) * 100) / 100
      const totalUSD = Math.round(qty * unitPriceUSD * 100) / 100
      const weightKg = Math.round((0.2 + rand() * 24) * 100) / 100
      out.push({
        id: `ORD-${(i + 1).toString().padStart(5, '0')}`,
        customer: pick(CUSTOMERS),
        country: pick(COUNTRIES),
        orderedAt: new Date(start + rand() * oneYearMs).toISOString().slice(0, 10),
        qty,
        unitPriceUSD,
        totalUSD,
        weightKg,
      })
    }
    return out
  }

  const rows = makeOrders(180)

  let locale = $state<Locale>('en-US')
  let currency = $state<Currency>('USD')

  const localeMeta = $derived(LOCALES.find((l) => l.id === locale)!)
  const t = $derived(MESSAGES[locale])
  const currencyMeta = $derived(CURRENCIES.find((c) => c.id === currency)!)

  // Convert USD → display currency at the configured rate.
  function toDisplay(usd: number): number {
    return usd * currencyMeta.rate
  }

  // Locale-aware date pattern. The grid's own date formatter takes a fixed
  // pattern, so we wrap Intl directly in custom `cell` callbacks for the
  // money and date columns. Numeric quantities use the grid's number format.
  const dateFmt = $derived(
    new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }),
  )
  const moneyFmt = $derived(
    new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }),
  )
  const numberFmt = $derived(new Intl.NumberFormat(locale))
  const weightFmt = $derived(
    new Intl.NumberFormat(locale, { style: 'unit', unit: 'kilogram', maximumFractionDigits: 2 }),
  )

  // Force the grid to re-mount when locale changes - this is the simplest
  // way to make every cell render with the new formatter (otherwise the
  // formatter is captured at column-def-creation time).
  let mountKey = $derived(`${locale}:${currency}`)
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3" dir={localeMeta.dir}>
  <div class="flex flex-wrap items-end gap-4 text-sm shrink-0" dir="ltr">
    <label class="flex flex-col">
      <span class="loc-label">Locale</span>
      <select
        bind:value={locale}
        class="rounded border px-2 py-1 min-w-44 loc-select"
      >
        {#each LOCALES as l (l.id)}
          <option value={l.id}>{l.flag} {l.label} ({l.id})</option>
        {/each}
      </select>
    </label>
    <label class="flex flex-col">
      <span class="loc-label">Currency</span>
      <select
        bind:value={currency}
        class="rounded border px-2 py-1 min-w-32 loc-select"
      >
        {#each CURRENCIES as c (c.id)}
          <option value={c.id}>{c.id}</option>
        {/each}
      </select>
    </label>
    <div class="ml-auto text-xs leading-tight loc-meta">
      <div>Direction: <strong>{localeMeta.dir.toUpperCase()}</strong></div>
      <div>Today in this locale: <strong>{dateFmt.format(new Date())}</strong></div>
      <div>Sample number: <strong>{numberFmt.format(1234567.89)}</strong></div>
      <div>Sample price: <strong>{moneyFmt.format(1234.5)}</strong></div>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    {#key mountKey}
      <SvGrid responsive={true}
      columnResize
        data={rows}
        columns={[
          { field: 'id',       header: t.id,       editorType: 'text',   width: 130 },
          { field: 'customer', header: t.customer, editorType: 'text',   width: 220 },
          { field: 'country',  header: t.country,  editorType: 'text',   width: 110 },
          {
            field: 'orderedAt', header: t.orderedAt, editorType: 'date', width: 150,
            cell: (ctx) => dateFmt.format(new Date(ctx.row.original.orderedAt)),
          },
          {
            field: 'qty', header: t.qty, editorType: 'number', width: 100,
            cell: (ctx) => numberFmt.format(ctx.row.original.qty),
          },
          {
            field: 'unitPriceUSD', header: t.unitPrice, editorType: 'number', width: 160,
            cell: (ctx) => moneyFmt.format(toDisplay(ctx.row.original.unitPriceUSD)),
          },
          {
            field: 'totalUSD', header: t.total, editorType: 'number', width: 180,
            cell: (ctx) => moneyFmt.format(toDisplay(ctx.row.original.totalUSD)),
          },
          {
            field: 'weightKg', header: t.weight, editorType: 'number', width: 130,
            cell: (ctx) => weightFmt.format(ctx.row.original.weightKg),
          },
        ] satisfies ColumnDef<typeof features, Order>[]}
        features={features}
        filterMode="menu"
        selectionMode="cell"
        showPagination={true}
        pageSize={25}
        enableInlineEditing={false}
        enableCellSelection={true}
        rowHeight={36}
        containerHeight="100%"
        fitColumns={true}
      />
    {/key}
  </div>
</section>

<style>
  /* Toolbar chrome follows the active grid theme via --sg-* tokens. */
  .loc-label { color: var(--sg-muted, #64748b); }
  .loc-meta  { color: var(--sg-muted, #64748b); }
  .loc-select {
    border-color: var(--sg-input-border, var(--sg-border, #cbd5e1));
    background: var(--sg-input-bg, transparent);
    color: var(--sg-fg, inherit);
  }
</style>
