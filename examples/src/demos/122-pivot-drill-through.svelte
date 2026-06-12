<script lang="ts">
  /**
   * 122. Pivot - Drill-through (Pro)
   * --------------------------------
   * Click any aggregated pivot cell, the right rail opens with the exact
   * source rows that contributed to that aggregation. The drill-through
   * is computed against the raw fact table by walking the clicked row's
   * ancestor labels (Region → Country → City for the row axis) and
   * decoding the column id into (Year, Quarter, Measure) for the column
   * axis. The numbers on the right always agree with the cell on the
   * left because both summarise the same filtered fact slice.
   *
   * Works for leaf cells AND subtotals AND the grand-total row: drilling
   * a region row returns every fact across that region, drilling the
   * grand-total returns the entire dataset.
   */
  import {
    SvGrid,
    tableFeatures,
    renderSnippet,
    type ColumnDef,
  } from 'sv-grid-community'
  import {
    createPivotModel,
    filterCollapsedPivotRows,
    setLicenseKey,
    type PivotRow,
  } from 'sv-grid-pro'

  setLicenseKey('SVPRO-DEV-DEMO')

  // ---- Domain ---------------------------------------------------------
  type Region = 'AMER' | 'EMEA' | 'APAC'
  type Channel = 'Online' | 'Retail' | 'Wholesale'
  type Fact = {
    id: number
    date: string         // ISO yyyy-mm-dd
    year: number
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
    region: Region
    country: string
    city: string
    channel: Channel
    customer: string
    revenue: number
    units: number
  }

  const TOPO: Record<Region, Record<string, string[]>> = {
    AMER: { USA: ['New York', 'Austin', 'Seattle'], Canada: ['Toronto', 'Vancouver'] },
    EMEA: { Germany: ['Berlin', 'Munich'], UK: ['London', 'Manchester'], France: ['Paris'] },
    APAC: { Japan: ['Tokyo', 'Osaka'], India: ['Mumbai', 'Bangalore'] },
  }
  const CHANNELS: Channel[] = ['Online', 'Retail', 'Wholesale']
  const CUSTOMERS = [
    'Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Vandelay', 'Pied Piper',
    'Hooli', 'Stark Industries', 'Tyrell', 'Wayne Ent.', 'Wonka', 'Cyberdyne',
  ]
  let prng = 0xDA7A101
  function rnd(): number { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function pick<T>(a: readonly T[]): T { return a[Math.floor(rnd() * a.length)]! }

  function seed(): Fact[] {
    const out: Fact[] = []
    let id = 1
    for (let i = 0; i < 1800; i += 1) {
      const region = pick(['AMER','EMEA','APAC'] as const)
      const country = pick(Object.keys(TOPO[region]))
      const city = pick(TOPO[region][country]!)
      const year = pick([2025, 2026] as const)
      const q = pick(['Q1','Q2','Q3','Q4'] as const)
      const monthBase = q === 'Q1' ? 1 : q === 'Q2' ? 4 : q === 'Q3' ? 7 : 10
      const month = monthBase + Math.floor(rnd() * 3)
      const day = 1 + Math.floor(rnd() * 27)
      const revenue = Math.round(1500 + rnd() * 38_500)
      out.push({
        id: id++,
        date: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
        year, quarter: q,
        region, country, city,
        channel: pick(CHANNELS),
        customer: pick(CUSTOMERS),
        revenue,
        units: 1 + Math.floor(rnd() * 60),
      })
    }
    return out
  }
  const facts: Fact[] = seed()

  // ---- Pivot model ----------------------------------------------------
  const features = tableFeatures({})
  const pivot = $derived(createPivotModel<typeof features, Fact>(facts, {
    rows: ['region', 'country', 'city'],
    cols: ['year', 'quarter'],
    values: [
      { field: 'revenue', agg: 'sum',   label: 'Revenue' },
      { field: 'units',   agg: 'sum',   label: 'Units'   },
    ],
    grandTotalCol: false,
  }))

  // Expand the first region by default.
  let expanded = $state<Set<string>>(new Set())
  let didInit = false
  $effect(() => {
    if (didInit) return
    const first = pivot.rows.find((r) => r.__pivotKind === 'group' && r.__pivotDepth === 0)
    if (!first) return
    expanded = new Set([first.__pivotId])
    didInit = true
  })
  function toggle(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id); else next.add(id)
    expanded = next
  }
  const visibleRows = $derived(filterCollapsedPivotRows(pivot.rows, expanded))

  // ---- Row-axis ancestor walk -----------------------------------------
  /**
   * Walk the clicked row up the parent chain and return the active
   * (region, country, city) filter. A row at depth 0 (region) gives
   * just `region`; a leaf at depth 2 gives all three.
   */
  function rowFilterFor(row: PivotRow): {
    region?: Region
    country?: string
    city?: string
  } {
    if (row.__pivotKind === 'grandTotal') return {}
    const chain: PivotRow[] = []
    let cur: PivotRow | undefined = row
    while (cur) {
      chain.unshift(cur)
      const pid: string | null = cur.__pivotParentId
      cur = pid ? pivot.rows.find((r) => r.__pivotId === pid) : undefined
    }
    const out: { region?: Region; country?: string; city?: string } = {}
    // Depth 0 = region, depth 1 = country, depth 2 = city.
    for (const r of chain) {
      const label = String(r.__pivotLabel)
      if (r.__pivotDepth === 0) out.region = label as Region
      else if (r.__pivotDepth === 1) out.country = label
      else if (r.__pivotDepth === 2) out.city = label
    }
    return out
  }
  /** Decode column id "pv__2026__Q2__m0" -> { year, quarter, measure }. */
  function colFilterFor(colId: string): { year?: number; quarter?: string; measure: 'revenue'|'units' } {
    const m = colId.match(/^pv__(\d+)__([^_]+)__m(\d+)$/)
    const i = m ? Number(m[3]) : 0
    return {
      year: m ? Number(m[1]) : undefined,
      quarter: m ? m[2] : undefined,
      measure: i === 1 ? 'units' : 'revenue',
    }
  }

  // ---- Drill state ----------------------------------------------------
  type Drill = {
    row: PivotRow
    colId: string
    rowFilter: ReturnType<typeof rowFilterFor>
    colFilter: ReturnType<typeof colFilterFor>
    facts: Fact[]
    total: number
  }
  let drill = $state<Drill | null>(null)

  function openDrill(row: PivotRow, colId: string) {
    const rf = rowFilterFor(row)
    const cf = colFilterFor(colId)
    const matched = facts.filter((f) =>
      (rf.region  === undefined || f.region  === rf.region)
      && (rf.country === undefined || f.country === rf.country)
      && (rf.city    === undefined || f.city    === rf.city)
      && (cf.year    === undefined || f.year    === cf.year)
      && (cf.quarter === undefined || f.quarter === cf.quarter)
    )
    const total = cf.measure === 'units'
      ? matched.reduce((a, f) => a + f.units, 0)
      : matched.reduce((a, f) => a + f.revenue, 0)
    drill = { row, colId, rowFilter: rf, colFilter: cf, facts: matched, total }
  }
  function closeDrill() { drill = null }

  function fmtMoney(n: number): string {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }
  function fmtMoneyK(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`
    return `$${Math.round(n)}`
  }
  function fmtNum(n: number): string { return n.toLocaleString('en-US') }

  const drillBreadcrumb = $derived.by(() => {
    if (!drill) return ''
    const parts: string[] = []
    const { rowFilter: rf, colFilter: cf } = drill
    if (rf.region)  parts.push(rf.region)
    if (rf.country) parts.push(rf.country)
    if (rf.city)    parts.push(rf.city)
    if (cf.year !== undefined && cf.quarter) parts.push(`${cf.year} ${cf.quarter}`)
    return parts.length > 0 ? parts.join(' · ') : 'All facts'
  })

  // ---- Pivot columns + click handlers ---------------------------------
  const columns = $derived(pivot.columns.map((c, i) => {
    if (i === 0) {
      return {
        ...c,
        width: 220,
        cell: (ctx) => renderSnippet(LabelCell, { row: ctx.row.original }),
      } as ColumnDef<typeof features, PivotRow>
    }
    return decorate(c) as ColumnDef<typeof features, PivotRow>
  }))
  function decorate(c: ColumnDef<typeof features, PivotRow>): ColumnDef<typeof features, PivotRow> {
    if (c.columns?.length) {
      return { ...c, columns: c.columns.map(decorate) }
    }
    const colId = c.id ?? ''
    const cf = colFilterFor(colId)
    return {
      ...c,
      width: 120,
      cell: (ctx) => renderSnippet(ValueCell, { row: ctx.row.original, colId, measure: cf.measure }),
    }
  }

  /** SvGrid's onCellClick fires for every data cell with the column id and
   *  source row. Drill on every non-label column; ignore the row-header. */
  function handleCellClick(e: { columnId: string; row: PivotRow }): void {
    if (e.columnId === '__pivotRowHeader') return
    openDrill(e.row, e.columnId)
  }

  // ---- Drill-table columns (right rail) -------------------------------
  const drillFeatures = tableFeatures({})
  const drillCols: Array<ColumnDef<typeof drillFeatures, Fact>> = [
    { field: 'date',     header: 'Date',     width: 100, editable: false },
    { field: 'customer', header: 'Customer', width: 150, editable: false },
    { field: 'channel',  header: 'Channel',  width: 90, editable: false },
    { field: 'revenue',  header: 'Revenue',  width: 110, editable: false, align: 'right',
      cell: (ctx) => fmtMoney(Number(ctx.getValue() ?? 0)) },
    { field: 'units',    header: 'Units',    width: 70, editable: false, align: 'right' },
  ]
</script>

{#snippet LabelCell(props: { row: PivotRow })}
  {@const row = props.row}
  {@const isOpen = expanded.has(row.__pivotId)}
  <span class="pv-label" class:pv-label-grand={row.__pivotKind === 'grandTotal'}
        style={`padding-left: ${row.__pivotDepth * 14 + 6}px`}>
    {#if row.__pivotExpandable}
      <button type="button" class="pv-chev" class:open={isOpen}
              onclick={() => toggle(row.__pivotId)} aria-label={isOpen ? 'Collapse' : 'Expand'}>▸</button>
    {:else}
      <span class="pv-chev-spacer"></span>
    {/if}
    {#if row.__pivotKind === 'grandTotal'}
      <strong>Grand total</strong>
    {:else}
      <span class:pv-label-group={row.__pivotKind === 'group'}>{row.__pivotLabel}</span>
    {/if}
  </span>
{/snippet}

{#snippet ValueCell(props: { row: PivotRow; colId: string; measure: 'revenue'|'units' })}
  {@const v = Number(props.row[props.colId] ?? 0)}
  {@const isActive = drill !== null && drill.row.__pivotId === props.row.__pivotId && drill.colId === props.colId}
  <span
    class="pv-vcell"
    class:is-active={isActive}
    class:pv-vcell-grand={props.row.__pivotKind === 'grandTotal'}
    class:pv-vcell-group={props.row.__pivotKind === 'group'}
    title="Click to drill through to source rows"
  >
    {props.measure === 'units' ? fmtNum(v) : fmtMoneyK(v)}
  </span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <header class="dt-header">
    <h2>Pivot - Drill-through</h2>
    <p>
      Click any value cell. The right rail shows the source facts behind the
      aggregation - the cell value equals the rail's total, always. Try a
      leaf, a subtotal, or the grand total row.
    </p>
  </header>

  <div class="dt-split flex flex-1 min-h-0 gap-3">
    <div class={`dt-pivot-wrap flex-1 min-w-0 ${drill ? 'has-drill' : ''}`}>
      <SvGrid
        data={visibleRows}
        {columns}
        {features}
        showRowSelection={false}
        showPagination={false}
        enableInlineEditing={false}
        enableCellSelection={false}
        rowHeight={32}
        containerHeight="100%"
        fitColumns={false}
        onCellClick={handleCellClick}
      />
    </div>

    {#if drill}
      <aside class="dt-rail" aria-label="Drill-through panel">
        <div class="dt-rail-head">
          <div class="dt-rail-titles">
            <span class="dt-rail-eyebrow">Drill-through</span>
            <h3 class="dt-rail-title">{drillBreadcrumb}</h3>
          </div>
          <button type="button" class="dt-rail-close" onclick={closeDrill} aria-label="Close">×</button>
        </div>

        <div class="dt-rail-kpis">
          <div class="dt-kpi">
            <div class="dt-kpi-label">{drill.colFilter.measure === 'units' ? 'Units' : 'Revenue'}</div>
            <div class="dt-kpi-value">{drill.colFilter.measure === 'units' ? fmtNum(drill.total) : fmtMoney(drill.total)}</div>
          </div>
          <div class="dt-kpi">
            <div class="dt-kpi-label">Facts</div>
            <div class="dt-kpi-value">{fmtNum(drill.facts.length)}</div>
          </div>
          <div class="dt-kpi">
            <div class="dt-kpi-label">Avg / fact</div>
            <div class="dt-kpi-value">
              {#if drill.facts.length === 0}-
              {:else if drill.colFilter.measure === 'units'}{fmtNum(Math.round(drill.total / drill.facts.length))}
              {:else}{fmtMoney(Math.round(drill.total / drill.facts.length))}
              {/if}
            </div>
          </div>
        </div>

        <div class="dt-rail-grid">
          <SvGrid
            data={drill.facts}
            columns={drillCols}
            features={drillFeatures}
            showRowSelection={false}
            showPagination={false}
            enableInlineEditing={false}
            enableCellSelection={false}
            rowHeight={28}
            containerHeight="100%"
            fitColumns={false}
          />
        </div>

        <div class="dt-rail-foot">
          Showing every source fact at this intersection. Toggle row groups
          on the left to compare aggregates against the rail.
        </div>
      </aside>
    {/if}
  </div>
</section>

<style>
  .dt-header h2 { font-size: 16px; font-weight: 700; margin: 0; }
  .dt-header p  { margin: 4px 0 0; font-size: 12.5px; color: var(--sg-muted, #64748b); max-width: 70ch; }

  .dt-split { min-height: 0; }
  .dt-pivot-wrap {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
    transition: flex-basis 200ms ease;
  }
  .dt-pivot-wrap.has-drill { flex: 1; }

  .dt-rail {
    width: 420px;
    flex-shrink: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .dt-rail-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(14,165,233,0.06));
  }
  :global([data-theme='dark']) .dt-rail-head {
    background: linear-gradient(135deg, rgba(99,102,241,0.20), rgba(14,165,233,0.12));
  }
  .dt-rail-titles { display: flex; flex-direction: column; min-width: 0; }
  .dt-rail-eyebrow {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b); font-weight: 700;
  }
  .dt-rail-title {
    margin: 2px 0 0; font-size: 14px; font-weight: 700;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .dt-rail-close {
    border: 0; background: transparent;
    font-size: 18px; line-height: 1; cursor: pointer; padding: 0 4px;
    color: var(--sg-muted, #64748b);
  }
  .dt-rail-close:hover { color: var(--sg-fg, #1e293b); }

  .dt-rail-kpis {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 8px; padding: 12px 14px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    flex-shrink: 0;
  }
  .dt-kpi {
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 6px;
    padding: 8px 10px;
  }
  .dt-kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sg-muted, #64748b); }
  .dt-kpi-value { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 3px; }

  .dt-rail-grid { flex: 1; min-height: 0; }
  .dt-rail-foot {
    padding: 8px 14px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    font-size: 11px; color: var(--sg-muted, #64748b);
  }

  /* Label + value cells */
  :global(.pv-label) { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; }
  :global(.pv-label-group) { font-weight: 700; }
  :global(.pv-label-grand)  { color: var(--sg-accent, #2563eb); font-weight: 700; }
  :global(.pv-chev) {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; border: 0; background: transparent; padding: 0;
    color: var(--sg-muted, #64748b); cursor: pointer; border-radius: 3px;
    font-size: 13px; line-height: 1;
    transition: transform 120ms ease, background 120ms ease;
  }
  :global(.pv-chev:hover) { background: rgba(148,163,184,0.18); }
  :global(.pv-chev.open) { transform: rotate(90deg); }
  :global(.pv-chev-spacer) { display: inline-block; width: 18px; height: 18px; flex-shrink: 0; }

  :global(.pv-vcell) {
    display: inline-block;
    width: 100%;
    text-align: right; cursor: pointer;
    padding: 2px 4px;
    font-variant-numeric: tabular-nums; font-size: 12.5px;
    border-radius: 4px;
  }
  :global(.sv-grid-row:hover .pv-vcell) {
    background: rgba(99,102,241,0.10);
    color: var(--sg-accent, #2563eb);
  }
  :global(.pv-vcell.is-active) {
    background: rgba(99,102,241,0.22) !important;
    color: var(--sg-accent, #2563eb);
    font-weight: 700;
    box-shadow: inset 0 0 0 1.5px rgba(99,102,241,0.6);
  }
  :global(.pv-vcell-group) { font-weight: 700; }
  :global(.pv-vcell-grand) { font-weight: 700; color: var(--sg-accent, #2563eb); }
</style>
