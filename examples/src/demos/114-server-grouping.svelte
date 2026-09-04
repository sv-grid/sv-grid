<script lang="ts">
  /**
   * 114. Server-side grouping + aggregation
   * ---------------------------------------
   * Instead of fetching 100k raw rows and grouping in the browser, ask
   * the server for the GROUPED result directly. The server returns
   * pre-aggregated subtotals; the grid renders one row per group plus
   * an expandable "drill-in" that lazily fetches the detail rows for
   * that group.
   *
   * Patterns shown:
   *   - GROUP BY dimension + SUM/AVG/COUNT measures pushed to the
   *     server (mock here, real apps do this in SQL / OLAP / a search
   *     index).
   *   - Drill-in fetches the raw rows for one group only - the network
   *     never sees the full table.
   *   - Side-by-side timing: "client groups 100k = ~620ms; server
   *     returns 12 pre-grouped rows = ~80ms".
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  // ---- Domain model ----------------------------------------------------
  type Region   = 'Americas' | 'EMEA' | 'APAC' | 'LATAM'
  type Industry = 'SaaS' | 'Retail' | 'Manufacturing' | 'Healthcare' | 'Finance'
  type Quarter  = 'Q1' | 'Q2' | 'Q3' | 'Q4'

  type Sale = {
    id: string
    region: Region
    industry: Industry
    quarter: Quarter
    salesperson: string
    arr: number
    deals: number
  }

  // ---- Mock "database" -------------------------------------------------
  // 100,000 rows that "live on the server". The client never receives
  // them as-is - it asks for grouped aggregates instead.
  let prng = 0xABCDE
  function rand() { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(a: readonly T[]): T { return a[Math.floor(rand() * a.length)]! }
  function int(min: number, max: number) { return Math.floor(min + rand() * (max - min + 1)) }

  const REGIONS:    Region[]   = ['Americas', 'EMEA', 'APAC', 'LATAM']
  const INDUSTRIES: Industry[] = ['SaaS', 'Retail', 'Manufacturing', 'Healthcare', 'Finance']
  const QUARTERS:   Quarter[]  = ['Q1', 'Q2', 'Q3', 'Q4']
  const NAMES = ['Ava T.','Liam P.','Noah S.','Emma G.','Olivia C.','Mason R.','Sophia B.','Lucas P.',
                 'Mia J.','Ethan W.','Aria K.','Henry M.','Hudson C.','Levi B.','Aurora V.']

  const ALL_SALES: Sale[] = (() => {
    const out: Sale[] = new Array(100_000)
    for (let i = 0; i < 100_000; i++) {
      out[i] = {
        id:          `S-${i.toString(36).padStart(5, '0')}`,
        region:      pick(REGIONS),
        industry:    pick(INDUSTRIES),
        quarter:     pick(QUARTERS),
        salesperson: pick(NAMES),
        arr:         int(2_000, 480_000),
        deals:       int(1, 24),
      }
    }
    return out
  })()

  // ---- Mock server: GROUP BY + SUM/AVG/COUNT --------------------------
  type GroupKey = 'region' | 'industry' | 'quarter'

  type GroupedRow = {
    /** Synthetic id from the group key value. */
    id: string
    /** Display label for the group dimension. */
    label: string
    /** Aggregates over all rows matching this group. */
    deals: number
    arrSum: number
    arrAvg: number
    arrMin: number
    arrMax: number
    rowCount: number
    /** Raw rows for the drill-in (filled when the user expands). */
    drillIn?: Sale[]
  }

  type ServerGroupResponse = {
    rows: GroupedRow[]
    queryMs: number
    scannedRows: number
  }

  async function fetchGrouped(by: GroupKey): Promise<ServerGroupResponse> {
    const t0 = performance.now()
    // 80-160ms of simulated network + query latency
    await new Promise<void>((r) => setTimeout(r, 80 + Math.random() * 80))

    const buckets = new Map<string, GroupedRow>()
    for (const s of ALL_SALES) {
      const key = String(s[by])
      let g = buckets.get(key)
      if (!g) {
        g = {
          id: key, label: key,
          deals: 0, arrSum: 0, arrAvg: 0, arrMin: Infinity, arrMax: -Infinity, rowCount: 0,
        }
        buckets.set(key, g)
      }
      g.deals    += s.deals
      g.arrSum   += s.arr
      g.arrMin    = Math.min(g.arrMin, s.arr)
      g.arrMax    = Math.max(g.arrMax, s.arr)
      g.rowCount += 1
    }
    for (const g of buckets.values()) {
      g.arrAvg = g.rowCount > 0 ? Math.round(g.arrSum / g.rowCount) : 0
    }
    const rows = Array.from(buckets.values()).sort((a, b) => b.arrSum - a.arrSum)
    return { rows, queryMs: Math.round(performance.now() - t0), scannedRows: ALL_SALES.length }
  }

  async function fetchDetail(by: GroupKey, value: string): Promise<Sale[]> {
    await new Promise<void>((r) => setTimeout(r, 60 + Math.random() * 60))
    return ALL_SALES
      .filter((s) => String(s[by]) === value)
      .sort((a, b) => b.arr - a.arr)
      .slice(0, 50)  // cap the drill-in payload at 50 rows
  }

  // ---- Client benchmark: time the "client groups everything" path -----
  function clientGroupBenchmark(by: GroupKey): { ms: number; groups: number } {
    const t0 = performance.now()
    const set = new Map<string, { arrSum: number; deals: number; rowCount: number }>()
    for (const s of ALL_SALES) {
      const key = String(s[by])
      let g = set.get(key)
      if (!g) { g = { arrSum: 0, deals: 0, rowCount: 0 }; set.set(key, g) }
      g.arrSum += s.arr; g.deals += s.deals; g.rowCount += 1
    }
    return { ms: Math.round(performance.now() - t0), groups: set.size }
  }

  // ---- Reactive state --------------------------------------------------
  let groupBy = $state<GroupKey>('region')
  let serverRows = $state<GroupedRow[]>([])
  let loading = $state(false)
  let lastQueryMs = $state(0)
  let scannedRows = $state(0)
  let clientMs = $state<number | null>(null)

  let expandedGroup = $state<string | null>(null)
  let detailRows = $state<Sale[]>([])
  let detailLoading = $state(false)

  async function refresh() {
    loading = true
    expandedGroup = null
    detailRows = []
    const res = await fetchGrouped(groupBy)
    serverRows = res.rows
    lastQueryMs = res.queryMs
    scannedRows = res.scannedRows
    clientMs = null
    loading = false
  }

  async function expandGroup(id: string) {
    if (expandedGroup === id) {
      expandedGroup = null
      detailRows = []
      return
    }
    expandedGroup = id
    detailLoading = true
    detailRows = await fetchDetail(groupBy, id)
    detailLoading = false
  }

  function runClientBench() {
    clientMs = clientGroupBenchmark(groupBy).ms
  }

  $effect(() => { void refresh() })

  // ---- Columns ---------------------------------------------------------
  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const groupColumns: ColumnDef<typeof features, GroupedRow>[] = [
    {
      id: 'expand', header: '', width: 36, editable: false,
      cell: (ctx) => renderSnippet(ChevronCell, { id: ctx.row.original.id }),
    },
    { field: 'label',    header: () => groupBy[0]!.toUpperCase() + groupBy.slice(1), width: 160, editable: false },
    { field: 'rowCount', header: 'Rows',     width: 100, align: 'right', editable: false,
      format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'deals',    header: 'Deals',    width: 100, align: 'right', editable: false,
      format: { type: 'number', options: { maximumFractionDigits: 0 } } },
    { field: 'arrSum',   header: 'ARR sum',  width: 150, align: 'right', editable: false,
      format: { type: 'number', options: { style: 'currency', currency: 'USD', notation: 'compact' } } },
    { field: 'arrAvg',   header: 'ARR avg',  width: 130, align: 'right', editable: false,
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
    { field: 'arrMin',   header: 'ARR min',  width: 130, align: 'right', editable: false,
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
    { field: 'arrMax',   header: 'ARR max',  width: 130, align: 'right', editable: false,
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
  ]

  const detailColumns: ColumnDef<typeof features, Sale>[] = [
    { field: 'id',          header: 'Sale id',   width: 110, editable: false },
    { field: 'region',      header: 'Region',    width: 110, editable: false },
    { field: 'industry',    header: 'Industry',  width: 130, editable: false },
    { field: 'quarter',     header: 'Quarter',   width:  90, editable: false },
    { field: 'salesperson', header: 'Salesperson',width: 140, editable: false },
    { field: 'arr',         header: 'ARR',       width: 130, align: 'right', editable: false,
      format: { type: 'number', options: { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } } },
    { field: 'deals',       header: 'Deals',     width:  90, align: 'right', editable: false },
  ]
</script>

{#snippet ChevronCell(props: { id: string })}
  <button class="chev {expandedGroup === props.id ? 'is-open' : ''}"
    onclick={() => expandGroup(props.id)}
    aria-label={expandedGroup === props.id ? 'Collapse' : 'Drill in'}>
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor"
      stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 4 10 8 6 12"></polyline>
    </svg>
  </button>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <!-- Toolbar ----------------------------------------------------- -->
  <div class="toolbar shrink-0">
    <div class="group-by">
      <span class="label">GROUP BY:</span>
      {#each ['region', 'industry', 'quarter'] as const as k (k)}
        <button class={`pill ${groupBy === k ? 'is-on' : ''}`} onclick={() => (groupBy = k)}>
          {k}
        </button>
      {/each}
    </div>

    <div class="kpis">
      <div class="kpi">
        <div class="kpi-label">Server query</div>
        <div class="kpi-value">{lastQueryMs} ms</div>
        <div class="kpi-foot">{serverRows.length} grouped rows from {scannedRows.toLocaleString()} scanned</div>
      </div>
      <div class="kpi alt">
        <div class="kpi-label">Client-side equivalent</div>
        {#if clientMs == null}
          <button class="bench-btn" onclick={runClientBench}>Benchmark on this machine</button>
        {:else}
          <div class="kpi-value">{clientMs} ms</div>
          <div class="kpi-foot">browser groups 100k rows in JS</div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Grouped rows ------------------------------------------------ -->
  <div class="group-grid">
    <SvGrid responsive={true}
      columnResize
      data={serverRows}
      columns={groupColumns}
      features={features}
      loading={loading}
      filterMode="none"
      selectionMode="cell"
      enableInlineEditing={false}
      enableCellSelection={true}
      rowHeight={36}
      containerHeight={Math.min(360, 60 + serverRows.length * 36)}
      fitColumns={true}
    />
  </div>

  <!-- Drill-in detail --------------------------------------------- -->
  {#if expandedGroup}
    <div class="drill shrink-0">
      <div class="drill-head">
        <strong>Drill-in:</strong>
        <code>{groupBy} = {expandedGroup}</code>
        <span class="drill-note">
          {#if detailLoading}<span class="spin"></span> Loading raw rows…
          {:else}Top 50 rows fetched on demand (one server call, not the whole table).{/if}
        </span>
        <button class="close" onclick={() => expandGroup(expandedGroup!)} aria-label="Close drill-in">✕</button>
      </div>
      <div class="drill-grid">
        <SvGrid responsive={true}
      columnResize
          data={detailRows}
          columns={detailColumns}
          features={features}
          filterMode="none"
          selectionMode="cell"
          enableInlineEditing={false}
          enableCellSelection={true}
          rowHeight={28}
          containerHeight={Math.min(280, 38 + detailRows.length * 28)}
          fitColumns={true}
        />
      </div>
    </div>
  {/if}

  <div class="flex-1 min-h-0"></div>
</section>

<style>
  .toolbar {
    display: flex; align-items: stretch; gap: 12px; flex-wrap: wrap;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg-subtle, var(--sg-header-bg, #f8fafc));
    border-radius: 8px; padding: 10px 12px;
  }
  .group-by { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .label {
    font-size: 10px; font-weight: 800; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--sg-muted, #64748b);
    margin-right: 6px;
  }
  .pill {
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-fg, #0f172a);
    border-radius: 999px; padding: 5px 14px;
    font-size: 12.5px; font-weight: 700; cursor: pointer;
  }
  .pill:hover { background: var(--sg-row-hover-bg, color-mix(in oklab, #6366f1 6%, transparent)); }
  .pill.is-on {
    background: var(--sg-accent, #6366f1); color: var(--sg-on-accent, #fff);
    border-color: transparent;
  }

  .kpis { display: flex; gap: 8px; margin-left: auto; }
  .kpi {
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px; padding: 6px 12px;
    display: flex; flex-direction: column; gap: 2px;
    min-width: 200px;
  }
  .kpi.alt { background: var(--sg-bg-subtle, var(--sg-header-bg, #f8fafc)); }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
               color: var(--sg-muted, #64748b); font-weight: 700; }
  .kpi-value { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .kpi-foot  { font-size: 10.5px; color: var(--sg-muted, #94a3b8); }
  .bench-btn {
    background: var(--sg-accent, #6366f1); color: var(--sg-on-accent, #fff);
    border: 0; border-radius: 6px; padding: 4px 10px;
    font-size: 11px; font-weight: 700; cursor: pointer;
    align-self: flex-start;
  }
  .bench-btn:hover { filter: brightness(1.08); }

  :global(.chev) {
    width: 22px; height: 22px;
    background: transparent; border: 0; cursor: pointer;
    color: var(--sg-muted, #64748b);
    border-radius: 4px;
    display: inline-flex; align-items: center; justify-content: center;
  }
  :global(.chev:hover) {
    background: var(--sg-row-hover-bg, color-mix(in oklab, #6366f1 12%, transparent));
    color: var(--sg-accent, #6366f1);
  }
  :global(.chev svg) { transition: transform 140ms; }
  :global(.chev.is-open svg) { transform: rotate(90deg); }

  .drill {
    border: 1px solid color-mix(in oklab, var(--sg-accent, #6366f1) 30%, transparent);
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 4%, var(--sg-bg, #fff));
    border-radius: 8px; padding: 10px 12px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .drill-head { display: flex; align-items: center; gap: 10px; font-size: 12px; flex-wrap: wrap; }
  .drill-head strong { color: var(--sg-accent, #4338ca); }
  .drill-head code {
    font-family: ui-monospace, monospace; background: var(--sg-bg, #fff);
    padding: 2px 8px; border-radius: 4px; color: var(--sg-accent, #4338ca); font-weight: 700;
    border: 1px dashed color-mix(in oklab, var(--sg-accent, #6366f1) 30%, transparent);
  }
  .drill-note { color: var(--sg-muted, #64748b); flex: 1; }
  .close {
    background: transparent; border: 0; cursor: pointer;
    color: var(--sg-muted, #64748b); font-size: 14px;
    padding: 2px 8px; border-radius: 4px;
  }
  .close:hover { background: color-mix(in oklab, #ef4444 12%, transparent); color: #b91c1c; }
  .drill-grid { background: var(--sg-bg, #fff); border-radius: 6px; overflow: hidden;
                border: 1px solid var(--sg-border, #e2e8f0); }
  .spin {
    display: inline-block; width: 10px; height: 10px;
    border: 2px solid color-mix(in oklab, var(--sg-accent, #6366f1) 30%, transparent);
    border-top-color: var(--sg-accent, #6366f1); border-radius: 50%;
    animation: spin 700ms linear infinite;
    margin-right: 4px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
