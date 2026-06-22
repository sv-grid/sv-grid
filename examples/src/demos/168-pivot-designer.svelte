<!-- Documented in: docs/help/pivot.md -->
<script lang="ts">
  /**
   * 168. Pivot designer (Enterprise) - SvPivotDesigner component
   * --------------------------------------------------------------
   * `<SvPivotDesigner>` is a self-contained, enterprise-ready pivot
   * authoring component. The consumer provides flat rows + a field
   * list; the designer handles everything else:
   *
   *  - Left-rail field picker with search + dimension/measure grouping
   *  - Four drop wells (Filters, Columns, Rows, Values)
   *  - HTML5 drag-and-drop to move fields between wells
   *  - Per-chip menus: Values picks an aggregator, Filters picks
   *    allowed source values
   *  - Toolbar: Reset, Preset menu, Subtotal/Grand-total toggles,
   *    optional Export hook
   *  - Inline pivot grid driven by `createPivotModel`
   *  - A single bindable `layout` prop so the page can save it,
   *    restore it from URL, or sync it with other components.
   */
  import { SvPivotDesigner, defaultLayoutFor, type PivotField, type PivotLayout, type PivotPreset } from '@svgrid/enterprise'

  type Row = {
    id: number
    region: 'Americas' | 'EMEA' | 'APAC'
    country: string
    category: 'Electronics' | 'Apparel' | 'Home' | 'Outdoors'
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
    salesperson: string
    units: number
    revenue: number
    profit: number
  }
  const REGIONS: Row['region'][] = ['Americas', 'EMEA', 'APAC']
  const COUNTRIES: Record<Row['region'], string[]> = {
    Americas: ['USA', 'Canada', 'Brazil', 'Mexico'],
    EMEA: ['UK', 'Germany', 'France', 'Spain', 'UAE'],
    APAC: ['Japan', 'Australia', 'Singapore', 'India'],
  }
  const CATEGORIES: Row['category'][] = ['Electronics', 'Apparel', 'Home', 'Outdoors']
  const QUARTERS: Row['quarter'][] = ['Q1', 'Q2', 'Q3', 'Q4']
  const NAMES = ['Ada', 'Grace', 'Linus', 'Donald', 'Margaret', 'Brian', 'Barbara', 'Ken', 'Anita', 'Tim']
  let seed = 0xc0ffee
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  const rows: Row[] = Array.from({ length: 720 }, (_, id) => {
    const region = REGIONS[id % 3]!
    const country = COUNTRIES[region][id % COUNTRIES[region].length]!
    const category = CATEGORIES[id % 4]!
    const quarter = QUARTERS[id % 4]!
    const units = Math.round(2 + rnd() * 38)
    const price = category === 'Electronics' ? 280 : category === 'Apparel' ? 65 : category === 'Home' ? 120 : 45
    const revenue = Math.round(units * price * (0.8 + rnd() * 0.5))
    return {
      id, region, country, category, quarter,
      salesperson: NAMES[id % NAMES.length]!,
      units, revenue,
      profit: Math.round(revenue * (0.15 + rnd() * 0.25)),
    }
  })

  const fields: PivotField<Row>[] = [
    { field: 'region',      label: 'Region',      kind: 'dimension', group: 'Geography' },
    { field: 'country',     label: 'Country',     kind: 'dimension', group: 'Geography' },
    { field: 'category',    label: 'Category',    kind: 'dimension', group: 'Product' },
    { field: 'quarter',     label: 'Quarter',     kind: 'dimension', group: 'Time' },
    { field: 'salesperson', label: 'Salesperson', kind: 'dimension', group: 'People' },
    { field: 'units',       label: 'Units sold',  kind: 'measure',   defaultAgg: 'sum',
      format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'revenue',     label: 'Revenue',     kind: 'measure',   defaultAgg: 'sum',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { field: 'profit',      label: 'Profit',      kind: 'measure',   defaultAgg: 'sum',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
  ]

  // Saved layouts surfaced in the toolbar's Presets menu.
  const presets: PivotPreset[] = [
    {
      name: 'Revenue by Region × Quarter',
      layout: {
        rows: ['region'], cols: ['quarter'],
        values: [{ field: 'revenue', agg: 'sum', label: 'Revenue', format: fields.find((f) => f.field === 'revenue')!.format }],
        filters: [],
      },
    },
    {
      name: 'Category drill: Region → Country',
      layout: {
        rows: ['region', 'country'], cols: ['category'],
        values: [
          { field: 'units',   agg: 'sum',  label: 'Units' },
          { field: 'revenue', agg: 'sum',  label: 'Revenue', format: fields.find((f) => f.field === 'revenue')!.format },
        ],
        filters: [],
      },
    },
    {
      name: 'Salesperson scorecard',
      layout: {
        rows: ['salesperson'], cols: [],
        values: [
          { field: 'revenue', agg: 'sum', label: 'Revenue', format: fields.find((f) => f.field === 'revenue')!.format },
          { field: 'profit',  agg: 'sum', label: 'Profit',  format: fields.find((f) => f.field === 'profit')!.format },
          { field: 'units',   agg: 'avg', label: 'Avg units' },
        ],
        filters: [],
      },
    },
  ]

  // Bindable layout. Initial: revenue by region × quarter.
  let layout = $state<PivotLayout>(presets[0]!.layout)

  function onExport(layout: PivotLayout, rows: unknown[]) {
    // Real apps would forward to @svgrid/enterprise `exportGrid` or
    // a CSV helper. For the demo we just log + show a toast.
    console.log('Export:', { layout, rowCount: rows.length })
    alert(`Would export ${rows.length} pivot rows. See console for the layout payload.`)
  }
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="shrink-0 rounded-lg border px-4 py-3" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <p class="text-sm font-semibold" style="color: var(--sg-fg);">
      &lt;SvPivotDesigner&gt; — a self-contained pivot authoring component
    </p>
    <p class="mt-0.5 text-xs" style="color: var(--sg-muted);">
      Drag a field from the rail into any well, or tick its checkbox to drop it in its default
      well (dimensions → Rows, measures → Values). Click a Values chip to change the aggregator
      (sum / avg / min / max / count …). Click a Filters chip to pick which source values pass.
      Try a preset from the toolbar.
    </p>
  </div>

  <div class="flex-1 min-h-0">
    <SvPivotDesigner
      data={rows}
      {fields}
      bind:layout
      {presets}
      {onExport}
    />
  </div>
</section>
