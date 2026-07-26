<script lang="ts">
  /**
   * 359. Pivot chart (Enterprise) - the Excel PivotTable <-> PivotChart pairing
   * ---------------------------------------------------------------------------
   * One drag-drop pivot layout, two views. `<SvPivotDesigner chartable>` renders
   * the SAME layout (Rows / Columns / Values) as either an expandable pivot grid
   * or a live chart - flip Table <-> Chart in the toolbar. Rows -> chart
   * categories (full path, so nested rows read "Americas · Canada"), Columns ->
   * series, Values -> the measure. Powered by the enterprise pivot engine
   * (createPivotModel -> pivotToChartSpec) over the free MIT SvGridChart.
   */
  import { SvPivotDesigner, type PivotField, type PivotLayout, type PivotPreset } from '@svgrid/enterprise'

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
    EMEA: ['UK', 'Germany', 'France', 'Spain'],
    APAC: ['Japan', 'Australia', 'Singapore', 'India'],
  }
  const CATEGORIES: Row['category'][] = ['Electronics', 'Apparel', 'Home', 'Outdoors']
  const QUARTERS: Row['quarter'][] = ['Q1', 'Q2', 'Q3', 'Q4']
  const NAMES = ['Ada', 'Grace', 'Linus', 'Donald', 'Margaret', 'Brian', 'Barbara', 'Ken']
  let seed = 0xc0ffee
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 0xffffffff)
  const rows: Row[] = Array.from({ length: 900 }, (_, id) => {
    const region = REGIONS[id % 3]!
    const country = COUNTRIES[region][id % COUNTRIES[region].length]!
    const category = CATEGORIES[id % 4]!
    const price = category === 'Electronics' ? 280 : category === 'Apparel' ? 65 : category === 'Home' ? 120 : 45
    const units = Math.round(2 + rnd() * 38)
    const revenue = Math.round(units * price * (0.8 + rnd() * 0.5))
    return {
      id, region, country, category, quarter: QUARTERS[id % 4]!,
      salesperson: NAMES[id % NAMES.length]!,
      units, revenue,
      profit: Math.round(revenue * (0.15 + rnd() * 0.25)),
    }
  })

  const money = { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } as const
  const fields: PivotField<Row>[] = [
    { field: 'region', label: 'Region', kind: 'dimension', group: 'Geography' },
    { field: 'country', label: 'Country', kind: 'dimension', group: 'Geography' },
    { field: 'category', label: 'Category', kind: 'dimension', group: 'Product' },
    { field: 'quarter', label: 'Quarter', kind: 'dimension', group: 'Time' },
    { field: 'salesperson', label: 'Salesperson', kind: 'dimension', group: 'People' },
    { field: 'units', label: 'Units', kind: 'measure', defaultAgg: 'sum', format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'revenue', label: 'Revenue', kind: 'measure', defaultAgg: 'sum', format: money },
    { field: 'profit', label: 'Profit', kind: 'measure', defaultAgg: 'sum', format: money },
  ]

  const presets: PivotPreset[] = [
    {
      name: 'Region → Country × Quarter',
      layout: { rows: ['region', 'country'], cols: ['quarter'], values: [{ field: 'revenue', agg: 'sum', label: 'Revenue', format: money }], filters: [] },
    },
    {
      name: 'Region × Category (revenue + profit)',
      layout: { rows: ['region'], cols: ['category'], values: [{ field: 'revenue', agg: 'sum', label: 'Revenue', format: money }, { field: 'profit', agg: 'sum', label: 'Profit', format: money }], filters: [] },
    },
    {
      name: 'Salesperson scorecard',
      layout: { rows: ['salesperson'], cols: [], values: [{ field: 'revenue', agg: 'sum', label: 'Revenue', format: money }, { field: 'units', agg: 'avg', label: 'Avg units' }], filters: [] },
    },
  ]

  // Default: Region -> Country (nested, so the grid expands / collapses) x Quarter.
  let layout = $state<PivotLayout>(presets[0]!.layout)
</script>

<div class="demo-page" style="height: 660px; display: flex; flex-direction: column;">
  <p class="demo-lede">
    One pivot layout, two views. The grid is <strong>expandable</strong> (click a Region to reveal its
    countries); flip <strong>Table &harr; Chart</strong> in the toolbar and the SAME layout draws as a live
    chart - Rows become <strong>categories</strong>, Columns <strong>series</strong>, Values the
    <strong>measure</strong>. Drag fields between wells, or try a preset.
  </p>
  <div style="flex: 1; min-height: 0;">
    <SvPivotDesigner
      data={rows}
      {fields}
      bind:layout
      {presets}
      expandable
      chartable
      defaultView="table"
    />
  </div>
</div>
