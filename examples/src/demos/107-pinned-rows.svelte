<script lang="ts">
  /**
   * 107. Pinned rows (top + bottom)
   * -------------------------------
   * Excel-style "freeze rows": specific records stay anchored to the top
   * or bottom of the viewport while the user scrolls the rest of the
   * dataset. Two classic uses on screen here:
   *
   *   - TOP: a sticky "Account totals" header row showing the running
   *     SUM / AVG / COUNT for the entire dataset.
   *   - BOTTOM: a sticky "Page totals" row showing SUM / AVG just for
   *     the currently-filtered visible rows. Reacts to column filters.
   *
   * Pattern: render three `<SvGrid responsive={true}>` instances stacked vertically -
   * pinned-top (1 row), main (scrollable), pinned-bottom (1 row). They
   * share the same column widths and the same row schema. Right-click
   * any data row to pin it; pinned rows show a small badge.
   *
   * This is a pure user-land pattern - no library work needed.
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
    industry: 'SaaS' | 'Retail' | 'Healthcare' | 'Manufacturing' | 'Finance'
    arr: number
    seats: number
    expansion: number     // additional ARR opportunity
    healthScore: number
    isUserPinned: boolean // shown in the pinned-bottom strip when true
  }

  // Seeded data
  let prng = 0xC0FFEE
  function rand() { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(a: readonly T[]): T { return a[Math.floor(rand() * a.length)]! }
  function int(min: number, max: number) { return Math.floor(min + rand() * (max - min + 1)) }

  const REGIONS = ['Americas', 'EMEA', 'APAC'] as const
  const INDUSTRIES = ['SaaS', 'Retail', 'Healthcare', 'Manufacturing', 'Finance'] as const
  const NAMES = ['Helios', 'Vertex', 'Atlas', 'Quantum', 'Stellar', 'Apex', 'Crescent', 'Sigma',
                 'Pioneer', 'Aurora', 'Granite', 'Cobalt', 'Meridian', 'Polaris', 'Sentinel',
                 'Tessera', 'Cascade', 'Beacon', 'Wavelength', 'Lumen', 'Echo', 'Cipher', 'Nimbus']

  let rows = $state<Row[]>(Array.from({ length: 80 }, (_, i) => ({
    id: `ACC-${(2000 + i).toString()}`,
    account: `${pick(NAMES)} ${pick(['Labs', 'Group', 'Industries', 'Networks', 'Systems'])}`,
    region: pick(REGIONS),
    industry: pick(INDUSTRIES),
    arr: int(8_000, 520_000),
    seats: int(3, 240),
    expansion: int(0, 180_000),
    healthScore: int(18, 99),
    isUserPinned: i === 7 || i === 19,   // start with 2 user-pinned
  })))

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Row> | null>(null)

  // ---- Filter-aware "page" snapshot. We poll on each render via the
  // api's `getDisplayedRows`; whenever the user filters / sorts the main
  // grid, this updates and the bottom pinned row recomputes.
  let displayedSnapshot = $state<readonly Row[]>([])
  let bumpTick = $state(0)
  $effect(() => { displayedSnapshot = rows })   // seed + react to outer updates
  function refreshSnapshot() { displayedSnapshot = api?.getDisplayedRows() ?? rows }

  // ---- Aggregations ---------------------------------------------------
  function agg(set: readonly Row[]) {
    const arr = set.reduce((s, r) => s + r.arr, 0)
    const seats = set.reduce((s, r) => s + r.seats, 0)
    const expansion = set.reduce((s, r) => s + r.expansion, 0)
    const avgHealth = set.length > 0 ? set.reduce((s, r) => s + r.healthScore, 0) / set.length : 0
    return { count: set.length, arr, seats, expansion, avgHealth }
  }
  const totals = $derived.by(() => agg(rows))         // for the top-pinned "all accounts" strip
  const pageTotals = $derived.by(() => { bumpTick; return agg(displayedSnapshot) })
  const userPinned = $derived(rows.filter((r) => r.isUserPinned))

  // ---- Synthetic "pinned-top" row: an aggregate, rendered as a single
  // row in its own SvGrid instance so columns/widths line up perfectly.
  const topPinnedData = $derived<Row[]>([{
    id: '⌃ ALL',
    account: `ALL ACCOUNTS  (n = ${totals.count})`,
    region: 'Americas',           // unused for display - replaced by cellRenderer
    industry: 'SaaS',
    arr: totals.arr,
    seats: totals.seats,
    expansion: totals.expansion,
    healthScore: Math.round(totals.avgHealth),
    isUserPinned: false,
  }])

  // ---- Bottom: user-pinned rows + page-total row ----------------------
  const bottomPinnedData = $derived<Row[]>([
    ...userPinned,
    {
      id: '⌄ PAGE',
      account: `VISIBLE PAGE  (n = ${pageTotals.count})`,
      region: 'Americas',
      industry: 'SaaS',
      arr: pageTotals.arr,
      seats: pageTotals.seats,
      expansion: pageTotals.expansion,
      healthScore: Math.round(pageTotals.avgHealth),
      isUserPinned: false,
    },
  ])

  // ---- Toggle row-pin via right-click ---------------------------------
  function toggleUserPin(rowIndex: number) {
    rows = rows.map((r, i) => i === rowIndex ? { ...r, isUserPinned: !r.isUserPinned } : r)
  }

  function onCtx(e: MouseEvent) {
    const cell = (e.target as HTMLElement | null)?.closest<HTMLElement>('td[data-svgrid-row]')
    if (!cell) return
    const idx = Number(cell.dataset.svgridRow)
    if (Number.isFinite(idx)) {
      e.preventDefault()
      toggleUserPin(idx)
    }
  }

  // Cell class helpers
  const cellHealthClass = (ctx: { getValue: () => unknown }) => {
    const v = Number(ctx.getValue())
    return v >= 75 ? 'health-good' : v >= 50 ? 'health-warn' : 'health-bad'
  }

  // ---- Column defs (shared schema, three instances) -------------------
  const baseColumns: ColumnDef<typeof features, Row>[] = [
    { field: 'id',          header: 'Account',   width: 110, editable: false },
    { field: 'account',     header: 'Name',      width: 220, editable: false },
    { field: 'region',      header: 'Region',    width: 100, editable: false },
    { field: 'industry',    header: 'Industry',  width: 130, editable: false },
    { field: 'arr',         header: 'ARR',       width: 130, align: 'right', editable: false,
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
    { field: 'seats',       header: 'Seats',     width:  90, align: 'right', editable: false },
    { field: 'expansion',   header: 'Expansion', width: 120, align: 'right', editable: false,
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
    { field: 'healthScore', header: 'Health',    width: 100, align: 'right', editable: false,
      cellClass: cellHealthClass },
  ]

  // Re-render bottom strip when the user types in filter inputs.
  $effect(() => {
    const id = setInterval(() => { refreshSnapshot(); bumpTick++ }, 500)
    return () => clearInterval(id)
  })
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="info shrink-0">
    <p>
      Three stacked grids share the same column schema. The
      <strong style="color:var(--sg-accent, #6366f1)">top strip</strong> shows all-accounts totals;
      the <strong style="color:#10b981">bottom strip</strong> shows totals for the visible / filtered set,
      plus any user-pinned rows.
      <span class="info-tip">Right-click any data row to pin it to the bottom.</span>
    </p>
  </div>

  <!-- TOP pinned row ----------------------------------------------- -->
  <div class="pin-strip pin-top">
    <div class="pin-tag pin-tag-top">TOP · ALL ACCOUNTS</div>
    <div class="pin-grid">
      <SvGrid responsive={true}
        data={topPinnedData}
        columns={baseColumns}
        features={features}
        filterMode="none"
        selectionMode="none"
        enableInlineEditing={false}
        enableCellSelection={false}
        rowHeight={36}
        containerHeight={70}
        fitColumns={true}
      />
    </div>
  </div>

  <!-- Main (scrollable) grid -------------------------------------- -->
  <div class="flex-1 min-h-0 grid-host"
    oncontextmenu={onCtx}
    role="presentation"
  >
    <SvGrid responsive={true}
      data={rows}
      columns={baseColumns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      enableInlineEditing={false}
      enableCellSelection={true}
      rowHeight={32}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => { api = next; refreshSnapshot() }}
      rowClass={(ctx) => ctx.row.isUserPinned ? 'is-user-pinned' : ''}
    />
  </div>

  <!-- BOTTOM pinned: user-pinned + page totals ------------------ -->
  <div class="pin-strip pin-bottom hide-header">
    <div class="pin-tag pin-tag-bottom">
      BOTTOM · {userPinned.length > 0 ? `${userPinned.length} PINNED + PAGE` : 'PAGE TOTALS'}
    </div>
    <div class="pin-grid">
      <SvGrid responsive={true}
        data={bottomPinnedData}
        columns={baseColumns}
        features={features}
        filterMode="none"
        selectionMode="none"
        enableInlineEditing={false}
        enableCellSelection={false}
        rowHeight={36}
        containerHeight={Math.min(220, 36 * bottomPinnedData.length + 12)}
        fitColumns={true}
      />
    </div>
  </div>
</section>

<style>
  .info {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 5%, transparent);
    border-radius: 8px; padding: 10px 14px;
    font-size: 13px; color: var(--sg-fg, #0f172a);
  }
  .info p { margin: 0; }
  .info-tip { color: var(--sg-muted, #64748b); font-style: italic; margin-left: 4px; }

  .pin-strip {
    position: relative;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    overflow: hidden;
    background: var(--sg-bg, #fff);
  }
  .pin-strip.pin-top    { border-top: 3px solid var(--sg-accent, #6366f1); }
  .pin-strip.pin-bottom { border-bottom: 3px solid #10b981; }
  .pin-tag {
    position: absolute; top: 8px; left: 8px; z-index: 10;
    padding: 2px 8px; border-radius: 4px;
    font-size: 9px; font-weight: 800; letter-spacing: 0.08em;
    text-transform: uppercase;
    pointer-events: none;
  }
  .pin-tag-top    { background: var(--sg-accent, #6366f1); color: var(--sg-on-accent, #fff); }
  .pin-tag-bottom { background: linear-gradient(135deg, #10b981, #059669); color: #fff; }
  .pin-grid { overflow: hidden; }
  /* Bottom strip hides the duplicated header - the top strip's header
     already serves as the column reference. */
  .hide-header .pin-grid :global(thead) { display: none; }

  /* Visual highlight for the rows the USER pinned (still in the main grid). */
  :global(tr.is-user-pinned) {
    background: color-mix(in oklab, #10b981 4%, transparent) !important;
  }
  :global(tr.is-user-pinned td:first-child::before) {
    content: '📌';
    margin-right: 4px; font-size: 10px;
    vertical-align: middle;
  }

  /* Health column tint -------------------------------------------- */
  :global(td.health-good) { color: #059669; font-weight: 700; }
  :global(td.health-warn) { color: #d97706; font-weight: 600; }
  :global(td.health-bad)  { color: #dc2626; font-weight: 700; }

  /* Aggregator rows: bold the pinned-row's "summary" feel. */
  .pin-strip :global(td) {
    background: linear-gradient(180deg, color-mix(in oklab, var(--sg-accent, #6366f1) 4%, transparent), transparent) !important;
    font-weight: 600;
  }
  .pin-strip.pin-bottom :global(td) {
    background: linear-gradient(180deg, color-mix(in oklab, #10b981 4%, transparent), transparent) !important;
  }
  /* Phone: the strips hide overflow (rounded corners), so as flex items of the
     stage they shrank to what the floored middle grid left and clipped their
     own small grids. Keep their heights; the page scrolls. */
  @media (max-width: 639px), (max-height: 500px) and (pointer: coarse) {
    .pin-strip { flex-shrink: 0; }
  }
</style>
