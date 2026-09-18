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
      log = [entry, ...log].slice(0, 12)
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

<section class="wrap">
  <header class="chrome">
    <span class="note">
      Drag Quarter into Columns beside Year, or Status into Rows, then Apply: one request per applied layout,
      over a million rows that never leave the server. Expand a region to see the pivot repeated per country
      beneath it; the innermost group is the result itself, so it has no expander.
    </span>
  </header>
  <div class="host">
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
  <footer class="log" aria-label="Request log">
    <span class="log-label">Requests</span>
    {#each log as e (e.seq)}
      <span class="log-item" class:is-failed={e.failed}>
        <strong>{e.kind}</strong> {e.route.length ? e.route.join(' > ') : 'root'} {e.range} <em>{e.ms} ms</em>
      </span>
    {/each}
    {#if !log.length}<span class="log-item">none yet</span>{/if}
  </footer>
</section>

<style>
  .wrap { display: flex; flex-direction: column; flex: 1; gap: 10px; height: 100%; min-height: 0; }
  .chrome { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: none; }
  .note { font-size: 12px; color: var(--sg-muted, #64748b); }
  .host { flex: 1; min-height: 0; }
  .log {
    display: flex;
    gap: 12px;
    flex: none;
    overflow: auto;
    white-space: nowrap;
    font-size: 12px;
    color: var(--sg-muted, #64748b);
    font-variant-numeric: tabular-nums;
    padding: 2px 0;
  }
  .log-label { font-weight: 600; color: var(--sg-fg, #0f172a); }
  .log-item strong { color: var(--sg-fg, #0f172a); text-transform: uppercase; font-size: 10.5px; }
  .log-item em { font-style: normal; color: var(--sg-fg, #0f172a); }
  .log-item.is-failed { color: var(--sg-danger, #b91c1c); }
</style>
