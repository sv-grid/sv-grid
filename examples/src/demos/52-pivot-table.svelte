<script lang="ts">
  /**
   * 52. Pivot table - built on <SvPivotDesigner>
   * ---------------------------------------------
   * A self-contained sales pivot built on the shipped `<SvPivotDesigner>`
   * (which the previous 1,232-line version of this demo hand-rolled).
   * The component handles the field rail, the four wells, drag-and-drop,
   * chip menus, presets, totals toggles, and the inline pivot grid.
   *
   * This demo adds two thin layers around it:
   *
   *  - A grand-total KPI strip ABOVE the pivot, recomputed from the
   *    designer's `onPivot` callback whenever the layout changes.
   *  - Currency / number formatting on value cells via `decorateColumns`
   *    so revenue + cost render as money and units as plain numbers.
   *
   * The pivot data is ~2,400 synthetic sales facts: 4 regions × 13
   * countries × 4 channels × 6 categories × 3 years × 4 quarters.
   */
  import {
    SvPivotDesigner,
    setLicenseKey,
    type PivotField,
    type PivotLayout,
    type PivotPreset,
    type PivotRow,
  } from '@svgrid/enterprise'
  import type { ColumnDef } from '@svgrid/grid'

  setLicenseKey('SVENTERPRISE-DEV-DEMO')

  // ---- Domain ---------------------------------------------------------
  type Region = 'NA' | 'EMEA' | 'APAC' | 'LATAM'
  type Channel = 'online' | 'retail' | 'partner' | 'direct'
  type Category = 'electronics' | 'home' | 'fashion' | 'kitchen' | 'sports' | 'books'
  type Fact = {
    year: number
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
    region: Region
    country: string
    channel: Channel
    category: Category
    revenue: number
    units: number
    cost: number
  }

  const REGIONS_COUNTRIES: Record<Region, string[]> = {
    NA:    ['USA', 'Canada', 'Mexico'],
    EMEA:  ['Germany', 'UK', 'France', 'Italy'],
    APAC:  ['Japan', 'Australia', 'India', 'Singapore'],
    LATAM: ['Brazil', 'Chile', 'Argentina'],
  }
  const CHANNELS:   readonly Channel[]   = ['online', 'retail', 'partner', 'direct']
  const CATEGORIES: readonly Category[]  = ['electronics', 'home', 'fashion', 'kitchen', 'sports', 'books']
  const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const
  const YEARS    = [2024, 2025, 2026] as const

  let prng = 0xFA170DA7 >>> 0
  function rnd(): number { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }

  function seedFacts(): Fact[] {
    const out: Fact[] = []
    for (let i = 0; i < 2400; i += 1) {
      const region = pick(['NA', 'EMEA', 'APAC', 'LATAM'] as const)
      const country = pick(REGIONS_COUNTRIES[region])
      const baseUnits = 8 + Math.floor(rnd() * 240)
      const unitPrice = 12 + Math.floor(rnd() * 240)
      const revenue = baseUnits * unitPrice
      out.push({
        year: pick(YEARS),
        quarter: pick(QUARTERS),
        region, country,
        channel: pick(CHANNELS),
        category: pick(CATEGORIES),
        revenue,
        units: baseUnits,
        cost: Math.round(revenue * (0.35 + rnd() * 0.25)),
      })
    }
    return out
  }
  const facts: Fact[] = seedFacts()

  // ---- Field metadata for the designer's rail ------------------------
  const moneyFormat = { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } as const
  const numberFormat = { type: 'number', options: { maximumFractionDigits: 0 } } as const

  const fields: PivotField<Fact>[] = [
    { field: 'year',     label: 'Year',     kind: 'dimension', group: 'Time' },
    { field: 'quarter',  label: 'Quarter',  kind: 'dimension', group: 'Time' },
    { field: 'region',   label: 'Region',   kind: 'dimension', group: 'Geography' },
    { field: 'country',  label: 'Country',  kind: 'dimension', group: 'Geography' },
    { field: 'channel',  label: 'Channel',  kind: 'dimension', group: 'Sales' },
    { field: 'category', label: 'Category', kind: 'dimension', group: 'Sales' },
    { field: 'revenue',  label: 'Revenue',  kind: 'measure',   defaultAgg: 'sum', format: moneyFormat },
    { field: 'cost',     label: 'Cost',     kind: 'measure',   defaultAgg: 'sum', format: moneyFormat },
    { field: 'units',    label: 'Units',    kind: 'measure',   defaultAgg: 'sum', format: numberFormat },
  ]

  // Saved layouts shown in the designer's Presets menu.
  const presets: PivotPreset[] = [
    {
      name: 'Revenue by Region × Quarter',
      layout: {
        rows: ['region', 'country'], cols: ['year', 'quarter'],
        values: [{ field: 'revenue', agg: 'sum', label: 'Revenue', format: moneyFormat }],
        filters: [],
      },
    },
    {
      name: 'Margin scorecard (Region × Category)',
      layout: {
        rows: ['region'], cols: ['category'],
        values: [
          { field: 'revenue', agg: 'sum', label: 'Revenue', format: moneyFormat },
          { field: 'cost',    agg: 'sum', label: 'Cost',    format: moneyFormat },
        ],
        filters: [],
      },
    },
    {
      name: 'Channel mix',
      layout: {
        rows: ['channel'], cols: [],
        values: [
          { field: 'revenue', agg: 'sum', label: 'Revenue', format: moneyFormat },
          { field: 'units',   agg: 'sum', label: 'Units',   format: numberFormat },
          { field: 'revenue', agg: 'avg', label: 'Avg deal', format: moneyFormat },
        ],
        filters: [],
      },
    },
  ]

  let layout = $state<PivotLayout>(presets[0]!.layout)

  // ---- KPI strip: read totals off the grand-total row ----------------
  // The designer's `onPivot` hands us the rebuilt rows + column tree
  // after every layout change. The grand-total row carries the same
  // values that appear in the rightmost grand-total column - we just
  // bucket them by which measure the column key encodes.
  let pivotRows = $state<PivotRow[]>([])
  let pivotColumns = $state<ColumnDef<{ rowSortingFeature: { key: string } }, PivotRow>[]>([])

  /** Decode the engine's column id "pv__<axis>__m<i>" to a measure field. */
  function measureFieldFromColId(colId: string): string | null {
    const m = colId.match(/__m(\d+)$/)
    if (!m) return null
    const chip = layout.values[Number(m[1])]
    return chip?.field ?? null
  }
  /** Flatten the column tree to every leaf id. */
  function leafColIds(cols: typeof pivotColumns): string[] {
    const out: string[] = []
    function walk(cs: typeof pivotColumns) {
      for (const c of cs) {
        if (c.columns?.length) walk(c.columns as typeof pivotColumns)
        else if (c.id) out.push(c.id)
      }
    }
    walk(cols)
    return out
  }
  const kpis = $derived.by(() => {
    const grand = pivotRows.find((r) => r.__pivotKind === 'grandTotal') ?? pivotRows[0]
    if (!grand) return { revenue: 0, cost: 0, units: 0, margin: 0, dataCount: 0 }
    let revenue = 0, cost = 0, units = 0
    for (const id of leafColIds(pivotColumns)) {
      const field = measureFieldFromColId(id)
      if (!field) continue
      const v = Number(grand[id] ?? 0)
      if (field === 'revenue')   revenue += v
      else if (field === 'cost') cost    += v
      else if (field === 'units')units   += v
    }
    return {
      revenue, cost, units,
      margin: revenue > 0 ? (revenue - cost) / revenue : 0,
      dataCount: pivotRows.filter((r) => r.__pivotKind === 'leaf').length,
    }
  })

  const fmtMoney = (v: number) =>
    Math.abs(v) >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M'
    : Math.abs(v) >= 1e3 ? '$' + Math.round(v / 1e3) + 'k'
    : '$' + Math.round(v)
  const fmtNum = (v: number) => v.toLocaleString('en-US')
  const fmtPct = (v: number) => (v * 100).toFixed(1) + '%'
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <header class="ph-header">
    <h2>Pivot table</h2>
    <p>
      ~2,400 sales facts across 4 regions × 4 channels × 6 categories × 3 years. Drag fields
      between the wells, pick presets, change aggregators on the Value chips. The KPI strip
      below recomputes from the pivot's grand total on every layout change.
    </p>
  </header>

  <!-- KPI strip - lives ABOVE the designer because it summarises the
       designer's output. Recomputed whenever `onPivot` fires. -->
  <div class="ph-kpis">
    <div class="ph-kpi">
      <div class="ph-kpi-label">Revenue</div>
      <div class="ph-kpi-value">{fmtMoney(kpis.revenue)}</div>
    </div>
    <div class="ph-kpi">
      <div class="ph-kpi-label">Cost</div>
      <div class="ph-kpi-value">{fmtMoney(kpis.cost)}</div>
    </div>
    <div class="ph-kpi">
      <div class="ph-kpi-label">Units</div>
      <div class="ph-kpi-value">{fmtNum(kpis.units)}</div>
    </div>
    <div class="ph-kpi">
      <div class="ph-kpi-label">Gross margin</div>
      <div class="ph-kpi-value">{fmtPct(kpis.margin)}</div>
    </div>
    <div class="ph-kpi">
      <div class="ph-kpi-label">Leaf rows</div>
      <div class="ph-kpi-value">{fmtNum(kpis.dataCount)}</div>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvPivotDesigner
      data={facts}
      {fields}
      bind:layout
      {presets}
      expandable
      onPivot={(rows, cols) => {
        pivotRows = rows
        pivotColumns = cols as typeof pivotColumns
      }}
    />
  </div>
</section>

<style>
  .ph-header h2 { font-size: 16px; font-weight: 700; margin: 0; }
  .ph-header p  { margin: 4px 0 0; font-size: 12.5px; color: var(--sg-muted, #64748b); max-width: 84ch; }

  .ph-kpis {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    flex-shrink: 0;
  }
  .ph-kpi {
    background: var(--sg-header-bg, #f1f5f9);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    padding: 10px 14px;
  }
  .ph-kpi-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--sg-muted, #64748b);
    font-weight: 700;
  }
  .ph-kpi-value {
    margin-top: 4px;
    font-size: 18px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--sg-fg, #0f172a);
  }

  @media (max-width: 900px) {
    .ph-kpis { grid-template-columns: repeat(2, 1fr); }
  }
</style>
