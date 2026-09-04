<script lang="ts">
  /**
   * 118. Range selection (Excel-style)
   * ----------------------------------
   * Companion to demo 90. This one focuses entirely on rectangular cell
   * ranges:
   *
   *   - Mouse: click + drag across cells to extend a range; Shift+click
   *     extends the existing anchor.
   *   - Multi-range: hold Ctrl/Cmd and drag to add ANOTHER rectangle -
   *     every range stays highlighted, and copy/getSelected span them all.
   *   - Keyboard: Shift+Arrow / Shift+Home / Shift+End / Shift+PgUp /
   *     Shift+PgDn grow the range from the anchor.
   *   - API: `api.selectCells([[r1, c1, r2, c2], ...])` / `api.getSelected()`
   *     drive one or many ranges from outside.
   *   - Events: `onCellSelectionChange` fires for every change with the
   *     new rectangle coords.
   *
   * The "Range stats" panel computes SUM / AVG / MIN / MAX / COUNT /
   * COUNT NUMERIC across the selected rectangle (Google Sheets status
   * bar style). The "Quick selects" toolbar issues common rectangle
   * shapes via the API.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  // Budget-by-quarter dataset - perfect for "select the Q3 column",
  // "select all expense rows", "select the Marketing × Q4 cell".
  type Line = {
    id: string
    category: string
    type: 'revenue' | 'expense'
    owner: string
    q1: number
    q2: number
    q3: number
    q4: number
    fy: number
  }

  function n(q1: number, q2: number, q3: number, q4: number, owner: string, category: string, type: Line['type'], id: string): Line {
    return { id, category, type, owner, q1, q2, q3, q4, fy: q1 + q2 + q3 + q4 }
  }
  let rows = $state<Line[]>([
    n(  280_000,  310_000,  345_000,  398_000, 'Ava T.',  'SaaS subscriptions',     'revenue',  'R-01'),
    n(  120_000,  145_000,  168_000,  195_000, 'Liam P.', 'Marketplace fees',       'revenue',  'R-02'),
    n(   58_000,   62_000,   71_000,   89_000, 'Noah S.', 'Professional services',  'revenue',  'R-03'),
    n(   42_000,   38_000,   45_000,   56_000, 'Emma G.', 'Training + workshops',   'revenue',  'R-04'),
    n(   18_000,   24_000,   31_000,   42_000, 'Olivia C.','Partner referrals',     'revenue',  'R-05'),
    n( -120_000, -128_000, -135_000, -148_000, 'Mason R.','Salaries - eng',         'expense',  'E-01'),
    n(  -68_000,  -72_000,  -78_000,  -85_000, 'Sophia B.','Salaries - go-to-market','expense', 'E-02'),
    n(  -32_000,  -34_000,  -36_000,  -38_000, 'Lucas P.','Cloud + infrastructure', 'expense',  'E-03'),
    n(  -18_000,  -22_000,  -28_000,  -34_000, 'Mia J.',  'Marketing campaigns',    'expense',  'E-04'),
    n(  -12_000,  -14_000,  -15_000,  -17_000, 'Ethan W.','Office + utilities',     'expense',  'E-05'),
    n(   -8_500,   -9_200,   -9_800,  -11_400, 'Aria K.', 'Software licenses',      'expense',  'E-06'),
    n(   -6_500,   -7_800,   -8_900,  -10_200, 'Henry M.','Legal + compliance',     'expense',  'E-07'),
  ])

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  let api = $state<SvGridApi<typeof features, Line> | null>(null)

  // ---- Track the selection rectangle reactively -----------------------
  type Range = [number, number, number, number]  // r1, c1, r2, c2
  let range = $state<Range | null>(null)

  // ---- Quick selects --------------------------------------------------
  // Column indices: 0=id, 1=category, 2=type, 3=owner, 4=q1, 5=q2, 6=q3, 7=q4, 8=fy
  const COL_INDEX = {
    id: 0, category: 1, type: 2, owner: 3, q1: 4, q2: 5, q3: 6, q4: 7, fy: 8,
  }
  function selectAll()       { api?.selectCells([[0, 0, rows.length - 1, COL_INDEX.fy]]) }
  function selectAllQs()     { api?.selectCells([[0, COL_INDEX.q1, rows.length - 1, COL_INDEX.q4]]) }
  function selectRevenue()   {
    // Revenue rows are R-01..R-05 - they live at indices 0..4
    api?.selectCells([[0, COL_INDEX.q1, 4, COL_INDEX.fy]])
  }
  function selectExpenses()  {
    // Expense rows start at index 5
    api?.selectCells([[5, COL_INDEX.q1, rows.length - 1, COL_INDEX.fy]])
  }
  function selectQ3()        { api?.selectCells([[0, COL_INDEX.q3, rows.length - 1, COL_INDEX.q3]]) }
  function selectFy()        { api?.selectCells([[0, COL_INDEX.fy, rows.length - 1, COL_INDEX.fy]]) }
  function selectOneCell()   { api?.selectCells([[0, COL_INDEX.q3, 0, COL_INDEX.q3]]) }
  function selectMarketing() { api?.selectCells([[8, COL_INDEX.q4, 8, COL_INDEX.q4]]) } // Marketing row × Q4
  // Two disjoint rectangles at once - the multi-range (Ctrl+drag) capability,
  // driven from the API. This is what the demo shows on open.
  function selectMultiple()  {
    api?.selectCells([
      [0, COL_INDEX.q1, 2, COL_INDEX.q2],   // top-left: first revenue rows, Q1-Q2
      [6, COL_INDEX.q3, 9, COL_INDEX.q4],   // bottom-right: some expense rows, Q3-Q4
    ])
  }
  function clearSel()        { api?.selectCells([]) }

  // ---- Cell metadata for the labels -----------------------------------
  const COL_LABELS = ['ID', 'Category', 'Type', 'Owner', 'Q1', 'Q2', 'Q3', 'Q4', 'FY']

  // ---- Range stats (Google Sheets-style status bar) --------------------
  const stats = $derived.by(() => {
    if (!range) return null
    const [r1, c1, r2, c2] = range
    const rowCount = r2 - r1 + 1
    const colCount = c2 - c1 + 1
    let total = rowCount * colCount
    let numericCount = 0
    let sum = 0
    let min = Infinity
    let max = -Infinity
    const colIds: (keyof Line)[] = ['id', 'category', 'type', 'owner', 'q1', 'q2', 'q3', 'q4', 'fy']
    for (let r = r1; r <= r2; r++) {
      const row = rows[r]
      if (!row) continue
      for (let c = c1; c <= c2; c++) {
        const v = row[colIds[c]!]
        if (typeof v === 'number' && Number.isFinite(v)) {
          numericCount++
          sum += v
          if (v < min) min = v
          if (v > max) max = v
        }
      }
    }
    return {
      total, rowCount, colCount, numericCount, sum,
      avg: numericCount > 0 ? sum / numericCount : null,
      min: numericCount > 0 ? min : null,
      max: numericCount > 0 ? max : null,
    }
  })

  // ---- Copy selected range as TSV ------------------------------------
  let copied = $state<string | null>(null)
  function copyAsTsv() {
    if (!range) return
    const [r1, c1, r2, c2] = range
    const colIds: (keyof Line)[] = ['id', 'category', 'type', 'owner', 'q1', 'q2', 'q3', 'q4', 'fy']
    const lines: string[] = []
    for (let r = r1; r <= r2; r++) {
      const row = rows[r]
      if (!row) continue
      const cells: string[] = []
      for (let c = c1; c <= c2; c++) cells.push(String(row[colIds[c]!] ?? ''))
      lines.push(cells.join('\t'))
    }
    const tsv = lines.join('\n')
    navigator.clipboard?.writeText(tsv).then(() => {
      copied = `${lines.length} rows × ${range![3] - range![1] + 1} cols`
      setTimeout(() => (copied = null), 1500)
    })
  }

  // ---- Range readout label --------------------------------------------
  function rangeLabel(r: Range | null): string {
    if (!r) return 'No selection'
    const [r1, c1, r2, c2] = r
    const a = `${COL_LABELS[c1] ?? c1}${r1 + 1}`
    const b = `${COL_LABELS[c2] ?? c2}${r2 + 1}`
    return r1 === r2 && c1 === c2 ? a : `${a}:${b}`
  }

  // ---- Columns ---------------------------------------------------------
  const moneyFmt = { type: 'number' as const, options: { style: 'currency' as const, currency: 'USD', maximumFractionDigits: 0 } }
  const columns: ColumnDef<typeof features, Line>[] = [
    { field: 'id',       header: 'ID',       width:  80, editable: false },
    { field: 'category', header: 'Category', width: 220, editable: false },
    { field: 'type',     header: 'Type',     width: 100, editable: false,
      cellClass: (ctx) => `type-${ctx.getValue()}` },
    { field: 'owner',    header: 'Owner',    width: 140, editable: false },
    { field: 'q1',       header: 'Q1',       width: 130, align: 'right', editable: false, format: moneyFmt,
      cellClass: (ctx) => Number(ctx.getValue()) < 0 ? 'neg' : 'pos' },
    { field: 'q2',       header: 'Q2',       width: 130, align: 'right', editable: false, format: moneyFmt,
      cellClass: (ctx) => Number(ctx.getValue()) < 0 ? 'neg' : 'pos' },
    { field: 'q3',       header: 'Q3',       width: 130, align: 'right', editable: false, format: moneyFmt,
      cellClass: (ctx) => Number(ctx.getValue()) < 0 ? 'neg' : 'pos' },
    { field: 'q4',       header: 'Q4',       width: 130, align: 'right', editable: false, format: moneyFmt,
      cellClass: (ctx) => Number(ctx.getValue()) < 0 ? 'neg' : 'pos' },
    { field: 'fy',       header: 'FY total', width: 150, align: 'right', editable: false, format: moneyFmt,
      cellClass: (ctx) => `fy ${Number(ctx.getValue()) < 0 ? 'neg' : 'pos'}` },
  ]

  // ---- Selection event log -------------------------------------------
  type LogEntry = { at: string; range: Range | null; label: string }
  let log = $state<LogEntry[]>([])
  function nowStr() {
    const d = new Date()
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}.${d.getMilliseconds().toString().padStart(3,'0')}`
  }

  const usd = (n: number) =>
    Math.abs(n) >= 1_000_000 ? `${n < 0 ? '-' : ''}$${(Math.abs(n) / 1_000_000).toFixed(2)}M`
    : Math.abs(n) >= 1_000   ? `${n < 0 ? '-' : ''}$${(Math.abs(n) / 1_000).toFixed(1)}k`
                             : `$${n.toFixed(0)}`
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <!-- Quick-selects ------------------------------------------------ -->
  <div class="quick-bar shrink-0">
    <span class="qb-label">Quick selects:</span>
    <button class="qb-btn" onclick={selectAll}>Whole sheet</button>
    <button class="qb-btn" onclick={selectRevenue}>Revenue (rows 1-5)</button>
    <button class="qb-btn" onclick={selectExpenses}>Expenses (rows 6-12)</button>
    <button class="qb-btn" onclick={selectAllQs}>All quarters</button>
    <button class="qb-btn" onclick={selectQ3}>Q3 column</button>
    <button class="qb-btn" onclick={selectFy}>FY column</button>
    <button class="qb-btn" onclick={selectMarketing}>Marketing × Q4 cell</button>
    <button class="qb-btn" onclick={selectMultiple}>Two ranges (Ctrl+drag)</button>
    <button class="qb-btn" onclick={selectOneCell}>Single cell</button>
    <button class="qb-btn danger" onclick={clearSel}>Clear</button>
    <button class="qb-btn primary" disabled={!range} onclick={copyAsTsv}>
      {copied ? `Copied (${copied})` : 'Copy as TSV'}
    </button>
  </div>

  <!-- Range stats (Google Sheets status bar) ----------------------- -->
  <div class="stats-bar shrink-0">
    <div class="sb-range">
      <span class="sb-label">Range</span>
      <code class="sb-readout">{rangeLabel(range)}</code>
    </div>
    {#if stats}
      <div class="sb-cell">
        <span class="sb-key">Cells</span>
        <span class="sb-val">{stats.total}</span>
        <span class="sb-sub">{stats.rowCount}r × {stats.colCount}c · {stats.numericCount} numeric</span>
      </div>
      {#if stats.sum !== null && stats.numericCount > 0}
        <div class="sb-cell"><span class="sb-key">SUM</span><span class="sb-val mono">{usd(stats.sum)}</span></div>
        <div class="sb-cell"><span class="sb-key">AVG</span><span class="sb-val mono">{usd(stats.avg!)}</span></div>
        <div class="sb-cell"><span class="sb-key">MIN</span><span class="sb-val mono">{usd(stats.min!)}</span></div>
        <div class="sb-cell"><span class="sb-key">MAX</span><span class="sb-val mono">{usd(stats.max!)}</span></div>
      {:else}
        <div class="sb-cell"><span class="sb-sub">No numeric cells in the range.</span></div>
      {/if}
    {:else}
      <div class="sb-cell"><span class="sb-sub">Click + drag in the grid, or pick a quick-select.</span></div>
    {/if}
  </div>

  <!-- Grid --------------------------------------------------------- -->
  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      columnResize
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      enableInlineEditing={false}
      enableCellSelection={true}
      rowHeight={32}
      containerHeight="100%"
      fitColumns={true}
      onApiReady={(next) => { api = next; selectMultiple() }}
      onCellSelectionChange={(ranges) => {
        range = ranges[0] ?? null
        const label = rangeLabel(range)
        log = [{ at: nowStr(), range, label }, ...log].slice(0, 10)
      }}
    />
  </div>

  <!-- Event log ---------------------------------------------------- -->
  <div class="ev-log shrink-0">
    <div class="ev-head"><strong>onCellSelectionChange</strong> <span class="ev-sub">last 10</span></div>
    {#if log.length === 0}
      <div class="ev-empty">Drag a range or click a quick-select to see events.</div>
    {:else}
      <ul>
        {#each log as e, i (e.at + i)}
          <li>
            <span class="ev-time">{e.at}</span>
            <code class="ev-coords">[{e.range ? e.range.join(', ') : '∅'}]</code>
            <span class="ev-label">{e.label}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

<style>
  /* Quick-selects bar */
  .quick-bar {
    display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 4%, transparent);
    border-radius: 8px; padding: 8px 12px;
  }
  .qb-label {
    font-size: 10px; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--sg-muted, #64748b);
    margin-right: 4px;
  }
  .qb-btn {
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px; padding: 4px 10px;
    font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .qb-btn:hover:not(:disabled) { background: color-mix(in oklab, var(--sg-accent, #6366f1) 8%, transparent); }
  .qb-btn:disabled { opacity: 0.4; cursor: default; }
  .qb-btn.primary { background: var(--sg-accent, #6366f1); color: var(--sg-on-accent, #fff); border-color: transparent; }
  .qb-btn.danger  { color: #b91c1c; border-color: #fecaca; }
  .qb-btn.danger:hover { background: #fef2f2; }

  /* Range stats bar */
  .stats-bar {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; padding: 8px 14px;
  }
  .sb-range { display: inline-flex; align-items: center; gap: 8px; min-width: 220px; }
  .sb-label { font-size: 10px; font-weight: 800; text-transform: uppercase;
              letter-spacing: 0.06em; color: var(--sg-muted, #64748b); }
  .sb-readout {
    font-family: ui-monospace, monospace; font-size: 14px; font-weight: 700;
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 10%, transparent);
    color: var(--sg-accent, #4338ca); padding: 3px 10px; border-radius: 5px;
  }
  .sb-cell { display: inline-flex; flex-direction: column; gap: 1px; min-width: 90px; }
  .sb-key {
    font-size: 9px; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--sg-muted, #64748b);
  }
  .sb-val { font-size: 16px; font-weight: 700; color: var(--sg-fg, #0f172a);
            font-variant-numeric: tabular-nums; line-height: 1.1; }
  .sb-val.mono { font-family: ui-monospace, monospace; }
  .sb-sub { font-size: 11px; color: var(--sg-muted, #94a3b8); font-style: italic; }

  /* Cell coloring */
  :global(td.pos)     { color: #16a34a; font-variant-numeric: tabular-nums; font-weight: 600; }
  :global(td.neg)     { color: #dc2626; font-variant-numeric: tabular-nums; font-weight: 600; }
  :global(td.fy)      { background: color-mix(in oklab, var(--sg-accent, #6366f1) 4%, transparent); font-weight: 800; }
  :global(td.type-revenue) { color: #166534; font-weight: 700; }
  :global(td.type-expense) { color: #991b1b; font-weight: 700; }

  /* Event log */
  .ev-log {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 8px; max-height: 180px; display: flex; flex-direction: column;
  }
  .ev-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 4%, transparent);
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--sg-muted, #64748b);
  }
  .ev-sub { font-weight: 500; }
  .ev-empty { padding: 14px; text-align: center; font-style: italic;
              color: var(--sg-muted, #94a3b8); font-size: 12px; }
  .ev-log ul { list-style: none; margin: 0; padding: 4px 0; overflow-y: auto; }
  .ev-log li {
    display: grid; grid-template-columns: 90px 160px 1fr; gap: 8px;
    padding: 3px 12px; font-size: 11.5px; align-items: center;
  }
  .ev-log li:first-child { background: color-mix(in oklab, var(--sg-accent, #6366f1) 5%, transparent); }
  .ev-time { font-family: ui-monospace, monospace; color: var(--sg-muted, #64748b); }
  .ev-coords {
    font-family: ui-monospace, monospace; font-size: 11px;
    color: var(--sg-accent, #6366f1); font-weight: 700;
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 8%, transparent);
    padding: 1px 6px; border-radius: 3px;
  }
  .ev-label { color: var(--sg-fg, #0f172a); font-weight: 600; }
</style>
