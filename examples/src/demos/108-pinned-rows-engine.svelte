<script lang="ts">
  /**
   * 108. Pinned rows - engine-level (`pinnedTopRows` / `pinnedBottomRows`)
   * ---------------------------------------------------------------------
   * Pass arrays of `TData` to the grid's `pinnedTopRows` and
   * `pinnedBottomRows` props and the rows render inside the same table
   * with `position: sticky` cells. They share the column schema (widths,
   * pin, cellClass, format) with the regular rows; no second grid, no
   * stacking, no DOM gymnastics.
   *
   * Different from demo 107 (which stacks three SvGrid instances - the
   * pure user-land pattern). This is the engine feature.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Row = {
    id: string
    account: string
    region: 'Americas' | 'EMEA' | 'APAC'
    industry: 'SaaS' | 'Retail' | 'Manufacturing' | 'Healthcare' | 'Finance'
    arr: number
    seats: number
    expansion: number
    healthScore: number
  }

  let prng = 0xBADA55
  function rand() { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(a: readonly T[]): T { return a[Math.floor(rand() * a.length)]! }
  function int(min: number, max: number) { return Math.floor(min + rand() * (max - min + 1)) }

  const REGIONS = ['Americas', 'EMEA', 'APAC'] as const
  const INDUSTRIES = ['SaaS', 'Retail', 'Manufacturing', 'Healthcare', 'Finance'] as const
  const NAMES = ['Helios', 'Vertex', 'Atlas', 'Quantum', 'Stellar', 'Apex', 'Crescent', 'Sigma',
                 'Pioneer', 'Aurora', 'Granite', 'Cobalt', 'Meridian', 'Polaris', 'Sentinel',
                 'Tessera', 'Cascade', 'Beacon', 'Wavelength', 'Lumen', 'Echo', 'Cipher', 'Nimbus']

  let rows = $state<Row[]>(Array.from({ length: 200 }, (_, i) => ({
    id: `ACC-${(3000 + i).toString()}`,
    account: `${pick(NAMES)} ${pick(['Labs', 'Group', 'Industries', 'Networks', 'Systems'])}`,
    region: pick(REGIONS),
    industry: pick(INDUSTRIES),
    arr: int(8_000, 520_000),
    seats: int(3, 240),
    expansion: int(0, 180_000),
    healthScore: int(18, 99),
  })))

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Row> | null>(null)

  // ---- Pinned-top rows: live aggregates over the whole dataset ---------
  const totals = $derived.by<Row[]>(() => {
    const arr = rows.reduce((s, r) => s + r.arr, 0)
    const seats = rows.reduce((s, r) => s + r.seats, 0)
    const expansion = rows.reduce((s, r) => s + r.expansion, 0)
    const avgHealth = rows.length ? rows.reduce((s, r) => s + r.healthScore, 0) / rows.length : 0
    const benchmark: Row = {
      id: '- BENCHMARK',
      account: 'Industry benchmark (Q2 2026)',
      region: 'EMEA', industry: 'SaaS',
      arr: 180_000, seats: 95, expansion: 45_000, healthScore: 72,
    }
    const total: Row = {
      id: '⌃ TOTALS',
      account: `All ${rows.length} accounts`,
      region: 'Americas', industry: 'SaaS',
      arr, seats, expansion, healthScore: Math.round(avgHealth),
    }
    return [total, benchmark]
  })

  // ---- Pinned-bottom rows: filter-aware page totals --------------------
  let displayedSnapshot = $state<readonly Row[]>([])
  $effect(() => { displayedSnapshot = rows })
  $effect(() => {
    const id = setInterval(() => {
      displayedSnapshot = api?.getDisplayedRows() ?? rows
    }, 400)
    return () => clearInterval(id)
  })
  const pageTotals = $derived.by<Row[]>(() => {
    const set = displayedSnapshot
    const arr = set.reduce((s, r) => s + r.arr, 0)
    const seats = set.reduce((s, r) => s + r.seats, 0)
    const expansion = set.reduce((s, r) => s + r.expansion, 0)
    const avgHealth = set.length ? set.reduce((s, r) => s + r.healthScore, 0) / set.length : 0
    return [{
      id: '⌄ PAGE',
      account: `Visible page (n = ${set.length})`,
      region: 'Americas', industry: 'SaaS',
      arr, seats, expansion, healthScore: Math.round(avgHealth),
    }]
  })

  // ---- Toggle UI -------------------------------------------------------
  let showTop = $state(true)
  let showBottom = $state(true)
  const pinnedTopRows    = $derived(showTop    ? totals     : [])
  const pinnedBottomRows = $derived(showBottom ? pageTotals : [])

  const cellHealthClass = (ctx: { getValue: () => unknown }) => {
    const v = Number(ctx.getValue())
    return v >= 75 ? 'health-good' : v >= 50 ? 'health-warn' : 'health-bad'
  }

  const columns: ColumnDef<typeof features, Row>[] = [
    { field: 'id',          header: 'Account',   width: 130, editable: false },
    { field: 'account',     header: 'Name',      width: 230, editable: false },
    { field: 'region',      header: 'Region',    width: 100, editable: false },
    { field: 'industry',    header: 'Industry',  width: 130, editable: false },
    { field: 'arr',         header: 'ARR',       width: 140, align: 'right', editable: false,
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
    { field: 'seats',       header: 'Seats',     width:  90, align: 'right', editable: false },
    { field: 'expansion',   header: 'Expansion', width: 130, align: 'right', editable: false,
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
    { field: 'healthScore', header: 'Health',    width: 100, align: 'right', editable: false,
      cellClass: cellHealthClass },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="info shrink-0">
    <p>
      Pass <code>pinnedTopRows</code> and <code>pinnedBottomRows</code> to <code>&lt;SvGrid&gt;</code> -
      they render inside the same table with sticky cells. <strong>Try scrolling</strong> the grid:
      the <span class="tag-top">↑ TOTALS</span> and <span class="tag-top">↑ BENCHMARK</span> rows stay
      anchored at the top, and the <span class="tag-bot">↓ PAGE</span> row sticks to the bottom and
      updates as filters narrow the visible set.
    </p>
    <div class="toggles">
      <label><input type="checkbox" bind:checked={showTop} /> Top pinned (totals + benchmark)</label>
      <label><input type="checkbox" bind:checked={showBottom} /> Bottom pinned (page totals)</label>
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      pinnedTopRows={pinnedTopRows}
      pinnedBottomRows={pinnedBottomRows}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={32}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => (api = next)}
    />
  </div>
</section>

<style>
  .info {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(135deg, rgba(99,102,241,0.04), rgba(16,185,129,0.04));
    border-radius: 8px; padding: 10px 14px;
    font-size: 13px; color: var(--sg-fg, #0f172a);
  }
  .info p { margin: 0 0 6px; }
  .info code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: rgba(99,102,241,0.12); color: #4338ca;
    padding: 1px 5px; border-radius: 3px; font-size: 12px;
  }
  .toggles { display: flex; gap: 14px; font-size: 12px; }
  .toggles label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
  .toggles input { accent-color: #6366f1; }
  .tag-top, .tag-bot {
    display: inline-block; padding: 0 6px; border-radius: 3px;
    font-size: 11px; font-weight: 800; font-family: ui-monospace, monospace;
  }
  .tag-top { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; }
  .tag-bot { background: linear-gradient(135deg, #10b981, #059669); color: #fff; }

  :global(td.health-good) { color: #059669; font-weight: 700; }
  :global(td.health-warn) { color: #d97706; font-weight: 600; }
  :global(td.health-bad)  { color: #dc2626; font-weight: 700; }
</style>
