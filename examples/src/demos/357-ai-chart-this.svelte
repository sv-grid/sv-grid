<script lang="ts">
  /**
   * 357. AI "chart this" (Enterprise)
   * ---------------------------------
   * The built-in chart panel gains an AI button once the grid is upgraded with
   * `installEnterprise(api)`: type a request in plain English - "revenue by
   * country, stacked by product" - and the model turns it into a chart config
   * (type, group-by, split-by, measure, aggregate) that's applied live. Wired
   * to the bundled `mockAIProvider` so it runs with no API key; swap in
   * `setAIProvider(yourAdapter)` for a real model. The AI is enterprise-gated
   * (soft-gated for evaluation); the chart panel itself is free MIT core.
   */
  import { SvGrid, tableFeatures, type ColumnDef, type SvGridApi } from '@svgrid/grid'
  import {
    installEnterprise,
    setLicenseKey,
    dismissUnlicensedNudge,
    setAIProvider,
    mockAIProvider,
  } from '@svgrid/enterprise'
  import { makeOrders } from '../shared/seed'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  dismissUnlicensedNudge()
  setAIProvider(mockAIProvider) // deterministic canned model for the demo

  // Project to just the chartable fields so the AI's column schema (built from
  // the row data) matches the grid's columns - no stray id / date fields.
  type Sale = { country: string; product: string; company: string; quantity: number; price: number }
  const features = tableFeatures({})
  let rows = $state<Sale[]>(
    makeOrders(200).map((o) => ({
      country: o.country,
      product: o.product,
      company: o.company,
      quantity: o.quantity,
      price: o.price,
    })),
  )

  const columns: ColumnDef<typeof features, Sale>[] = [
    { field: 'country', header: 'Country', width: 120 },
    { field: 'product', header: 'Product', width: 150 },
    { field: 'company', header: 'Company', width: 160 },
    { field: 'quantity', header: 'Qty', width: 90, align: 'right', cellDataType: 'number', format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'price', header: 'Price', width: 120, align: 'right', cellDataType: 'number', format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
  ]

  // installEnterprise(api) wires the chart panel's AI button to aiChart() via
  // enableAiCharting - nothing else to do here.
  function onReady(next: SvGridApi<typeof features, Sale>) {
    installEnterprise(next)
  }
</script>

<div class="demo-page" style="height: 620px; display: flex; flex-direction: column;">
  <p class="demo-lede">
    Open the <strong>Chart</strong> panel and press <strong>✨ AI</strong>, then describe the chart you
    want - e.g. <em>"total price by country stacked by product"</em> or <em>"average quantity by
    product as a line"</em>. The model returns a chart config and the panel draws it. Powered by the
    bundled mock provider; wire <code>setAIProvider()</code> to a real model for production.
  </p>
  <div style="flex: 1; min-height: 0;">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      selectionMode="cell"
      containerHeight="100%"
      onApiReady={onReady}
      charting={{ defaultOpen: true, width: 500 }}
    />
  </div>
</div>
