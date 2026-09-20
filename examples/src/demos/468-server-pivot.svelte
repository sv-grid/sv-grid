<!-- Documented in: docs/help/server/server-pivot.md -->
<script lang="ts">
  /**
   * 468. Server-side pivot
   * -----------------------
   * The pivot designer in server mode: Rows become `groupBy`, Columns
   * `pivotBy`, Values `aggregations`, and every applied layout is one request
   * to the warehouse from demo 467 (a million rows). The backend answers with
   * one field per (pivot key x aggregation) and lists them in
   * `pivotResultFields`; the model turns that list into the column groups
   * you see. Apply / Cancel hold a slice-and-dice session to one request.
   *
   * Both the designer's server mode and the row model are Enterprise; the
   * contract the warehouse implements is free.
   */
  import type { GridColumns } from '@svgrid/grid'
  import { SvPivotDesigner, createServerRowModel, setLicenseKey, type PivotField, type PivotLayout } from '@svgrid/enterprise'
  import { createWarehouse, type WarehouseLogEntry, type WarehouseRow } from '../shared/server-warehouse'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')

  let log = $state<WarehouseLogEntry[]>([])
  const warehouse = createWarehouse({
    rows: 1_000_000,
    latencyMs: [40, 120],
    onRequest: (entry) => {
      log = [entry, ...log].slice(0, 30)
    },
  })

  const server = createServerRowModel<WarehouseRow>(warehouse, {
    groupBy: ['region', 'country'],
    aggregations: [{ col: 'amount', fn: 'sum' }],
    pivotBy: ['year'],
    pivotMode: true,
    grandTotalRow: 'pinnedBottom',
    childCount: (r) => (r as { childCount?: number }).childCount,
    // Each generated value column: the measure's name, a currency format, room for it.
    pivotResultColumn: (field, def) => ({
      ...def,
      header: 'Amount',
      width: 130,
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } },
    }),
  })

  $effect(() => () => server.dispose())

  const money = { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } as const
  const fields: PivotField<WarehouseRow>[] = [
    { field: 'region', label: 'Region', kind: 'dimension', group: 'Geography' },
    { field: 'country', label: 'Country', kind: 'dimension', group: 'Geography' },
    { field: 'rep', label: 'Rep', kind: 'dimension', group: 'People' },
    { field: 'category', label: 'Category', kind: 'dimension', group: 'Catalogue' },
    { field: 'product', label: 'Product', kind: 'dimension', group: 'Catalogue' },
    { field: 'status', label: 'Status', kind: 'dimension', group: 'Order' },
    { field: 'year', label: 'Year', kind: 'dimension', group: 'Time' },
    { field: 'quarter', label: 'Quarter', kind: 'dimension', group: 'Time' },
    { field: 'amount', label: 'Amount', kind: 'measure', defaultAgg: 'sum', format: money },
    { field: 'qty', label: 'Quantity', kind: 'measure', defaultAgg: 'sum', format: { type: 'number' } },
  ]
  let layout = $state<PivotLayout>({
    rows: ['region', 'country'],
    cols: ['year'],
    values: [{ field: 'amount', agg: 'sum', label: 'Amount', format: money }],
    filters: [],
  })
  let pivotMode = $state(true)

  const usd = { type: 'number' as const, options: { style: 'currency' as const, currency: 'USD', maximumFractionDigits: 0 } }
  const flatColumns: GridColumns<WarehouseRow> = [
    { field: 'region', header: 'Region', width: 120 },
    { field: 'country', header: 'Country', width: 140 },
    { field: 'product', header: 'Product', width: 130 },
    { field: 'status', header: 'Status', width: 100 },
    { field: 'qty', header: 'Qty', width: 90, align: 'right' as const },
    { field: 'amount', header: 'Amount', width: 140, align: 'right' as const, format: usd },
  ]
</script>

<section class="wrap demo-kit">
  <header class="chrome">
    <span class="note">
      Drag Quarter into Columns beside Year, or Status into Rows, then Apply: one request per applied layout,
      over a million rows that never leave the server. Expand a region to see the pivot repeated per country
      beneath it; the innermost group is the result itself, so it has no expander.
    </span>
  </header>
  <div class="gridpane">
    <SvPivotDesigner
      {server}
      {fields}
      bind:layout
      bind:pivotMode
      {flatColumns}
      groupColumn={{ header: 'Region / Country', width: 240, leafField: 'product' }}
      applyMode="deferred"
      panelPosition="right"
      gridFitColumns={false}
      columnTree
      toolTabs
    />
  </div>
  <aside class="log log-strip" aria-label="Request log">
    <div class="log-head">Requests <span class="muted">newest first</span></div>
    {#each log as e (e.seq)}
      <div class="log-row log-item" class:is-failed={e.failed}>
        <span class="log-kind">{e.kind}</span>
        <span class="log-route" title={e.route.join(' > ')}>{e.route.length ? e.route.join(' > ') : 'root'}</span>
        <span class="log-range">{e.range}</span>
        <span class="log-ms">{e.ms} ms</span>
      </div>
    {/each}
    {#if !log.length}<div class="muted log-empty">No requests yet.</div>{/if}
  </aside>
</section>

<style>
  /* Only what is particular to this demo; the chrome is the shared demo-kit. */
  /* Under the designer, not beside it: the designer has a tool panel of its own. */
  .log-strip { width: auto; max-height: 132px; }
  .log-row { grid-template-columns: 44px 1fr 72px 56px; }
  .log-row.is-failed { color: var(--sg-danger, #b91c1c); }
  .log-route { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .log-range, .log-ms { text-align: right; white-space: nowrap; }
</style>
