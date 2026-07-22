<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 38. RTL + i18n stress
   * ---------------------
   * Same dataset, six locales. Switching the locale chip flips:
   *
   *   - Header labels, action buttons, status pills (translated)
   *   - Document direction (`dir="rtl"` for Arabic / Hebrew)
   *   - Number formatting per Intl.NumberFormat - Arabic-Indic digits
   *     where appropriate, narrow non-breaking spaces in fr-CA, etc.
   *   - Currency symbol AND placement per the locale's CLDR data
   *   - Date format per Intl.DateTimeFormat - month-first in en-US,
   *     day-first in de-DE, era in ja-JP, full Arabic month name in
   *     ar-SA, RTL ordering in he-IL.
   *
   * The existing `15-localization` demo only flipped currency. This
   * one stresses procurement's "does your grid actually work in RTL"
   * checklist:
   *
   *   1. Headers right-align in RTL (sort indicator on the LEFT of the
   *      label, not the right)
   *   2. Sticky pinned columns pin to the correct edge in RTL
   *   3. Filter menus open from the correct anchor
   *   4. Numeric columns stay tabular (no mid-word digit re-ordering)
   *   5. Mixed-direction text (English brand inside Arabic sentence)
   *      renders cleanly using `<bdi>`-style isolation
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  // ---- Domain (a SKU catalog so every locale touches names/units) -----

  type CategoryKey = 'apparel' | 'electronics' | 'home' | 'books' | 'food'
  type StatusKey = 'in_stock' | 'low' | 'backorder' | 'discontinued'

  type Sku = {
    id: string
    /** Brand identifier - left in Latin script across all locales so we
     *  can demonstrate mixed-direction text inside Arabic / Hebrew. */
    brand: string
    category: CategoryKey
    /** Price quoted in the locale's currency at runtime - see fmtPrice. */
    basePriceUSD: number
    stock: number
    status: StatusKey
    /** Last restock as epoch ms - formatted per locale at render time. */
    updatedAt: number
  }

  // ---- Locale table ----------------------------------------------------

  type LocaleId = 'en-US' | 'de-DE' | 'fr-CA' | 'ja-JP' | 'ar-SA' | 'he-IL'

  type LocaleMeta = {
    id: LocaleId
    label: string
    flag: string
    /** ISO 4217 currency the locale's customer would see. */
    currency: 'USD' | 'EUR' | 'CAD' | 'JPY' | 'SAR' | 'ILS'
    rtl: boolean
  }

  const LOCALES: LocaleMeta[] = [
    { id: 'en-US', label: 'English (US)',        flag: '🇺🇸', currency: 'USD', rtl: false },
    { id: 'de-DE', label: 'Deutsch',             flag: '🇩🇪', currency: 'EUR', rtl: false },
    { id: 'fr-CA', label: 'Français (Canada)',   flag: '🇨🇦', currency: 'CAD', rtl: false },
    { id: 'ja-JP', label: '日本語',               flag: '🇯🇵', currency: 'JPY', rtl: false },
    { id: 'ar-SA', label: 'العربية',              flag: '🇸🇦', currency: 'SAR', rtl: true  },
    { id: 'he-IL', label: 'עברית',                flag: '🇮🇱', currency: 'ILS', rtl: true  },
  ]

  // ---- Translation table ----------------------------------------------

  type Strings = {
    title: string
    subtitle: string
    search: string
    clearAll: string
    showing: (n: number) => string
    columns: {
      id: string
      brand: string
      category: string
      price: string
      stock: string
      status: string
      updatedAt: string
    }
    categories: Record<CategoryKey, string>
    statuses: Record<StatusKey, string>
  }

  const I18N: Record<LocaleId, Strings> = {
    'en-US': {
      title: 'SKU catalog',
      subtitle: 'Same data, every locale.',
      search: 'Search brand or SKU…',
      clearAll: 'Clear filters',
      showing: (n) => `${n.toLocaleString('en-US')} items`,
      columns: {
        id: 'SKU', brand: 'Brand', category: 'Category', price: 'Price',
        stock: 'Stock', status: 'Status', updatedAt: 'Updated',
      },
      categories: {
        apparel: 'Apparel', electronics: 'Electronics', home: 'Home',
        books: 'Books', food: 'Food & Drink',
      },
      statuses: {
        in_stock: 'In stock', low: 'Low', backorder: 'Backorder', discontinued: 'Discontinued',
      },
    },
    'de-DE': {
      title: 'Artikelkatalog',
      subtitle: 'Dieselben Daten, jede Sprache.',
      search: 'Marke oder SKU suchen…',
      clearAll: 'Filter zurücksetzen',
      showing: (n) => `${n.toLocaleString('de-DE')} Artikel`,
      columns: {
        id: 'Artikelnr.', brand: 'Marke', category: 'Kategorie', price: 'Preis',
        stock: 'Bestand', status: 'Status', updatedAt: 'Aktualisiert',
      },
      categories: {
        apparel: 'Bekleidung', electronics: 'Elektronik', home: 'Haushalt',
        books: 'Bücher', food: 'Lebensmittel',
      },
      statuses: {
        in_stock: 'Verfügbar', low: 'Wenige', backorder: 'Rückstand', discontinued: 'Eingestellt',
      },
    },
    'fr-CA': {
      title: 'Catalogue de produits',
      subtitle: 'Mêmes données, chaque langue.',
      search: 'Rechercher une marque ou un UGS…',
      clearAll: 'Effacer les filtres',
      showing: (n) => `${n.toLocaleString('fr-CA')} articles`,
      columns: {
        id: 'UGS', brand: 'Marque', category: 'Catégorie', price: 'Prix',
        stock: 'Stock', status: 'État', updatedAt: 'Mis à jour',
      },
      categories: {
        apparel: 'Vêtements', electronics: 'Électronique', home: 'Maison',
        books: 'Livres', food: 'Alimentation',
      },
      statuses: {
        in_stock: 'En stock', low: 'Faible', backorder: 'Rupture', discontinued: 'Discontinué',
      },
    },
    'ja-JP': {
      title: '商品カタログ',
      subtitle: '同じデータ、すべての言語。',
      search: 'ブランドまたはSKUを検索…',
      clearAll: 'フィルターをクリア',
      showing: (n) => `${n.toLocaleString('ja-JP')} 件`,
      columns: {
        id: 'SKU', brand: 'ブランド', category: 'カテゴリー', price: '価格',
        stock: '在庫', status: 'ステータス', updatedAt: '更新日',
      },
      categories: {
        apparel: 'アパレル', electronics: '家電', home: '生活雑貨',
        books: '書籍', food: '食品・飲料',
      },
      statuses: {
        in_stock: '在庫あり', low: '残少', backorder: '取り寄せ', discontinued: '廃番',
      },
    },
    'ar-SA': {
      title: 'كتالوج المنتجات',
      subtitle: 'البيانات نفسها، بلغات متعددة.',
      search: 'ابحث عن علامة تجارية أو SKU…',
      clearAll: 'مسح عوامل التصفية',
      showing: (n) => `${n.toLocaleString('ar-SA')} عنصرًا`,
      columns: {
        id: 'الرمز', brand: 'العلامة التجارية', category: 'الفئة', price: 'السعر',
        stock: 'المخزون', status: 'الحالة', updatedAt: 'آخر تحديث',
      },
      categories: {
        apparel: 'ملابس', electronics: 'إلكترونيات', home: 'منزل',
        books: 'كتب', food: 'طعام وشراب',
      },
      statuses: {
        in_stock: 'متوفر', low: 'محدود', backorder: 'حجز مسبق', discontinued: 'متوقف',
      },
    },
    'he-IL': {
      title: 'קטלוג מוצרים',
      subtitle: 'אותו מאגר, כל שפה.',
      search: 'חיפוש מותג או מק"ט…',
      clearAll: 'נקה סינונים',
      showing: (n) => `${n.toLocaleString('he-IL')} פריטים`,
      columns: {
        id: 'מק"ט', brand: 'מותג', category: 'קטגוריה', price: 'מחיר',
        stock: 'מלאי', status: 'סטטוס', updatedAt: 'עודכן',
      },
      categories: {
        apparel: 'ביגוד', electronics: 'אלקטרוניקה', home: 'בית',
        books: 'ספרים', food: 'מזון ומשקה',
      },
      statuses: {
        in_stock: 'במלאי', low: 'מועט', backorder: 'הזמנה מוקדמת', discontinued: 'הופסק',
      },
    },
  }

  // Static FX rates so prices look distinct per currency. NOT REAL.
  const FX: Record<LocaleMeta['currency'], number> = {
    USD: 1, EUR: 0.93, CAD: 1.37, JPY: 156, SAR: 3.75, ILS: 3.62,
  }

  // ---- Seed -----------------------------------------------------------

  const BRANDS = [
    'Aurora', 'Helios', 'Vertex', 'Atlas', 'Nordic', 'Pacific',
    'Quantum', 'Stellar', 'Apex', 'Crescent', 'Sigma', 'Pioneer',
  ]
  const CATEGORIES_KEYS: readonly CategoryKey[] = ['apparel', 'electronics', 'home', 'books', 'food']
  const STATUS_KEYS: readonly StatusKey[] = ['in_stock', 'low', 'backorder', 'discontinued']

  let prng = 0xCAFEBABE
  function rnd(): number {
    prng = (prng * 1664525 + 1013904223) >>> 0
    return prng / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }

  function seedSkus(n: number): Sku[] {
    const out: Sku[] = []
    for (let i = 0; i < n; i += 1) {
      const statusRoll = rnd()
      const status: StatusKey =
        statusRoll < 0.65 ? 'in_stock' :
        statusRoll < 0.85 ? 'low' :
        statusRoll < 0.95 ? 'backorder' : 'discontinued'
      out.push({
        id: `SKU-${(10_000 + i).toString(36).toUpperCase()}`,
        brand: pick(BRANDS),
        category: pick(CATEGORIES_KEYS),
        basePriceUSD: Math.round((5 + rnd() * 495) * 100) / 100,
        stock: status === 'discontinued' ? 0 : Math.floor(rnd() * 2_500),
        status,
        updatedAt: Date.now() - Math.floor(rnd() * 90 * 86_400_000),
      })
    }
    return out
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const skus = seedSkus(60)

  // ---- State ----------------------------------------------------------

  let localeId = $state<LocaleId>('ar-SA')
  let search = $state('')

  const localeMeta = $derived(LOCALES.find((l) => l.id === localeId)!)
  const t = $derived(I18N[localeId])
  const numberFormatter = $derived(new Intl.NumberFormat(localeId))
  const currencyFormatter = $derived(
    new Intl.NumberFormat(localeId, {
      style: 'currency',
      currency: localeMeta.currency,
      maximumFractionDigits: localeMeta.currency === 'JPY' ? 0 : 2,
    }),
  )
  const dateFormatter = $derived(
    new Intl.DateTimeFormat(localeId, { year: 'numeric', month: 'short', day: 'numeric' }),
  )
  const relTimeFormatter = $derived(new Intl.RelativeTimeFormat(localeId, { numeric: 'auto' }))

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase()
    if (!q) return skus
    return skus.filter((s) => s.id.toLowerCase().includes(q) || s.brand.toLowerCase().includes(q))
  })

  function fmtPrice(usd: number): string {
    return currencyFormatter.format(usd * FX[localeMeta.currency])
  }
  function fmtRelative(ms: number): string {
    const days = Math.round((ms - Date.now()) / 86_400_000)
    return relTimeFormatter.format(days, 'day')
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet IdCell(props: { row: Sku })}
  <!-- Mixed-direction protection: <bdi> isolates Latin SKU codes when
       the surrounding direction is RTL, so the prefix stays intact. -->
  <bdi class="i18n-mono">{props.row.id}</bdi>
{/snippet}

{#snippet BrandCell(props: { row: Sku })}
  <bdi class="i18n-brand">{props.row.brand}</bdi>
{/snippet}

{#snippet CategoryCell(props: { row: Sku })}
  <span class={`i18n-cat i18n-cat-${props.row.category}`}>{t.categories[props.row.category]}</span>
{/snippet}

{#snippet PriceCell(props: { row: Sku })}
  <span class="i18n-num">{fmtPrice(props.row.basePriceUSD)}</span>
{/snippet}

{#snippet StockCell(props: { row: Sku })}
  <span class="i18n-num">{numberFormatter.format(props.row.stock)}</span>
{/snippet}

{#snippet StatusCell(props: { row: Sku })}
  <span class={`i18n-status i18n-status-${props.row.status}`}>
    <span class="i18n-status-dot"></span>{t.statuses[props.row.status]}
  </span>
{/snippet}

{#snippet UpdatedCell(props: { row: Sku })}
  <span class="i18n-updated">
    <span>{dateFormatter.format(props.row.updatedAt)}</span>
    <span class="i18n-relative">{fmtRelative(props.row.updatedAt)}</span>
  </span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section
  class="i18n-shell flex flex-col flex-1 min-h-0 gap-3"
  dir={localeMeta.rtl ? 'rtl' : 'ltr'}
  lang={localeId}
>
  <!-- Header -->
  <header class="i18n-header">
    <div>
      <h2 class="i18n-title">{t.title}</h2>
      <p class="i18n-sub">{t.subtitle}</p>
    </div>
    <div class="i18n-locale-row">
      {#each LOCALES as loc (loc.id)}
        <button
          type="button"
          class="i18n-locale-btn"
          class:i18n-locale-active={loc.id === localeId}
          onclick={() => (localeId = loc.id)}
          dir="ltr"
        >
          <span class="i18n-flag">{loc.flag}</span>
          <span>{loc.label}</span>
          <span class="i18n-cur">{loc.currency}</span>
        </button>
      {/each}
    </div>
  </header>

  <!-- Toolbar -->
  <div class="i18n-toolbar">
    <input
      type="search"
      bind:value={search}
      placeholder={t.search}
      class="i18n-search"
    />
    <button type="button" class="i18n-clear-btn" onclick={() => (search = '')}>
      {t.clearAll}
    </button>
    <span class="i18n-count tabular-nums">{t.showing(filtered.length)}</span>
  </div>

  <!-- Grid -->
  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={filtered}
      columns={[
        { field: 'id', header: t.columns.id, width: 140, editable: false,
          cell: (ctx) => renderSnippet(IdCell, { row: ctx.row.original }) },
        { field: 'brand', header: t.columns.brand, width: 140, editable: false,
          cell: (ctx) => renderSnippet(BrandCell, { row: ctx.row.original }) },
        { field: 'category', header: t.columns.category, width: 150, editable: false,
          cell: (ctx) => renderSnippet(CategoryCell, { row: ctx.row.original }) },
        { field: 'basePriceUSD', header: t.columns.price, editorType: 'number', width: 140, editable: false,
          cell: (ctx) => renderSnippet(PriceCell, { row: ctx.row.original }) },
        { field: 'stock', header: t.columns.stock, editorType: 'number', width: 110, editable: false,
          cell: (ctx) => renderSnippet(StockCell, { row: ctx.row.original }) },
        { field: 'status', header: t.columns.status, width: 150, editable: false,
          cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }) },
        { field: 'updatedAt', header: t.columns.updatedAt, editorType: 'number', width: 200, editable: false,
          cell: (ctx) => renderSnippet(UpdatedCell, { row: ctx.row.original }) },
      ] satisfies ColumnDef<typeof features, Sku>[]}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={40}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>

<style>
  .i18n-shell {
    height: 100%;
  }

  /* Header */
  .i18n-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    flex-shrink: 0;
  }
  .i18n-title { font-size: 20px; font-weight: 700; margin: 0; }
  .i18n-sub   { font-size: 12.5px; color: var(--sg-muted, #64748b); margin: 2px 0 0 0; }

  .i18n-locale-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .i18n-locale-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 999px;
    font-size: 11.5px;
    cursor: pointer;
  }
  .i18n-locale-btn:hover { background: var(--sg-header-bg, #f1f5f9); }
  .i18n-locale-active {
    border-color: transparent;
    background: var(--sg-accent, #2563eb);
    color: #fff;
  }
  .i18n-flag { font-size: 14px; line-height: 1; }
  .i18n-cur {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 10px;
    opacity: 0.8;
  }

  /* Toolbar */
  .i18n-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .i18n-search {
    flex: 1 1 320px;
    max-width: 360px;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 13px;
  }
  .i18n-clear-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 12px;
    cursor: pointer;
  }
  .i18n-count {
    margin-inline-start: auto;
    color: var(--sg-muted, #64748b);
    font-size: 12px;
  }

  /* Cell badges */
  :global(.i18n-mono) {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 12px;
    letter-spacing: 0.02em;
  }
  :global(.i18n-brand) {
    font-weight: 500;
  }
  :global(.i18n-cat) {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
  }
  :global(.i18n-cat-apparel)     { background: #dbeafe; color: #1d4ed8; }
  :global(.i18n-cat-electronics) { background: #e0e7ff; color: #3730a3; }
  :global(.i18n-cat-home)        { background: #fef3c7; color: #92400e; }
  :global(.i18n-cat-books)       { background: #fce7f3; color: #9d174d; }
  :global(.i18n-cat-food)        { background: #dcfce7; color: #166534; }
  :global([data-theme='dark'] .i18n-cat-apparel)     { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .i18n-cat-electronics) { background: rgba(99,102,241,.18); color: #a5b4fc; }
  :global([data-theme='dark'] .i18n-cat-home)        { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .i18n-cat-books)       { background: rgba(236,72,153,.18); color: #f9a8d4; }
  :global([data-theme='dark'] .i18n-cat-food)        { background: rgba(34,197,94,.18); color: #4ade80; }

  :global(.i18n-num) {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  :global(.i18n-status) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
  }
  :global(.i18n-status-dot) {
    width: 6px; height: 6px; border-radius: 50%; background: currentColor;
  }
  :global(.i18n-status-in_stock)     { background: #dcfce7; color: #166534; }
  :global(.i18n-status-low)          { background: #fef3c7; color: #92400e; }
  :global(.i18n-status-backorder)    { background: #dbeafe; color: #1d4ed8; }
  :global(.i18n-status-discontinued) { background: #e2e8f0; color: #475569; }
  :global([data-theme='dark'] .i18n-status-in_stock)     { background: rgba(34,197,94,.18); color: #4ade80; }
  :global([data-theme='dark'] .i18n-status-low)          { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .i18n-status-backorder)    { background: rgba(59,130,246,.18); color: #93c5fd; }
  :global([data-theme='dark'] .i18n-status-discontinued) { background: rgba(148,163,184,.18); color: #cbd5e1; }

  :global(.i18n-updated) {
    display: inline-flex;
    flex-direction: column;
    gap: 1px;
  }
  :global(.i18n-relative) {
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
  }
</style>
