<!-- Documented in: docs/help/pivot.md -->
<script lang="ts">
  /**
   * 60. Sales pipeline - pivot analytics dashboard (Pro)
   * ----------------------------------------------------
   * Production-feel pivot view modelled on PowerBI / Tableau pivots:
   *
   *   - Page header with title, breadcrumbs, last-refresh timestamp,
   *     refresh / export actions.
   *   - 4 KPI tiles with sparkline trends per region.
   *   - Filter rail: region chips + measure toggles + density toggle.
   *   - Pivot grid in a "card" container with heat-map tinting, pinned
   *     row-header column, distinct subtotal / grand-total styling.
   *   - Toolbar tools: expand-all, collapse-all, export xlsx.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import {
    createPivotModel,
    filterCollapsedPivotRows,
    installEnterprise,
    setLicenseKey,
    type PivotRow,
    type EnterpriseGridApi,
    type PivotValueConfig,
  } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-DEMO')

  // ---- Fact data --------------------------------------------------------
  type Region = 'AMER' | 'EMEA' | 'APAC'
  type Quarter = '2026 Q1' | '2026 Q2' | '2026 Q3' | '2026 Q4'
  type Fact = { region: Region; salesPerson: string; quarter: Quarter; amount: number; units: number }

  let prng = 0xBADCAFE7
  function rand(): number { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }

  const REGIONS: Region[] = ['AMER', 'EMEA', 'APAC']
  const PEOPLE: Record<Region, string[]> = {
    AMER: ['Ada Lovelace',    'Linus Torvalds',  'Grace Hopper',   'Donald Knuth'],
    EMEA: ['Tim Berners-Lee', 'Linda Petersen',  'Sven Andersson', 'Anders Hejlsberg'],
    APAC: ['Yuki Tanaka',     'Mei Chen',        'Raj Patel',      'Jin Park'],
  }
  const QUARTERS: Quarter[] = ['2026 Q1', '2026 Q2', '2026 Q3', '2026 Q4']

  function makeFacts(): Fact[] {
    const out: Fact[] = []
    for (const region of REGIONS) {
      for (const salesPerson of PEOPLE[region]) {
        for (const quarter of QUARTERS) {
          const n = 4 + Math.floor(rand() * 4)
          for (let i = 0; i < n; i += 1) {
            out.push({
              region, salesPerson, quarter,
              amount: Math.round(800 + rand() * 18_200),
              units:  Math.round(1 + rand() * 25),
            })
          }
        }
      }
    }
    return out
  }
  const allFacts = makeFacts()

  // ---- UI state --------------------------------------------------------
  let activeRegions = $state<Set<Region>>(new Set(REGIONS))
  let activeQuarters = $state<Set<Quarter>>(new Set(QUARTERS))
  let repSearch = $state('')
  let topN = $state<number | null>(null)            // top-N reps per region; null = all
  let abbreviate = $state(true)                      // K / M abbreviated currency
  let showSales = $state(true)
  let showUnits = $state(true)
  let density = $state<'compact' | 'comfy'>('comfy')
  let lastRefresh = $state<Date>(new Date())

  // Reps that survive search + per-region top-N. Computed against the
  // FULL fact set so the top-N is stable when the user toggles regions.
  const allowedReps = $derived.by(() => {
    const q = repSearch.trim().toLowerCase()
    const allowed = new Set<string>()
    for (const region of REGIONS) {
      const totals = PEOPLE[region]
        .map((rep) => ({
          rep,
          total: allFacts.filter((f) => f.region === region && f.salesPerson === rep)
                          .reduce((a, f) => a + f.amount, 0),
        }))
        .sort((a, b) => b.total - a.total)
      const ranked = topN === null ? totals : totals.slice(0, topN)
      for (const t of ranked) {
        if (!q || t.rep.toLowerCase().includes(q)) allowed.add(t.rep)
      }
    }
    return allowed
  })

  const facts = $derived(allFacts.filter((f) =>
    activeRegions.has(f.region)
    && activeQuarters.has(f.quarter)
    && allowedReps.has(f.salesPerson),
  ))

  function toggleRegion(r: Region) {
    const next = new Set(activeRegions)
    if (next.has(r)) next.delete(r); else next.add(r)
    if (next.size === 0) next.add(r)
    activeRegions = next
  }
  function toggleQuarter(q: Quarter) {
    const next = new Set(activeQuarters)
    if (next.has(q)) next.delete(q); else next.add(q)
    if (next.size === 0) next.add(q)
    activeQuarters = next
  }
  function resetFilters() {
    activeRegions = new Set(REGIONS)
    activeQuarters = new Set(QUARTERS)
    repSearch = ''
    topN = null
  }

  /** Active-filter chips for the breadcrumb bar. */
  const activeFilterPills = $derived.by(() => {
    const pills: { kind: string; label: string; onclear: () => void }[] = []
    if (activeRegions.size < REGIONS.length) {
      for (const r of REGIONS) {
        if (!activeRegions.has(r)) continue
        pills.push({ kind: 'region', label: r, onclear: () => toggleRegion(r) })
      }
    }
    if (activeQuarters.size < QUARTERS.length) {
      for (const q of QUARTERS) {
        if (!activeQuarters.has(q)) continue
        pills.push({ kind: 'quarter', label: q, onclear: () => toggleQuarter(q) })
      }
    }
    if (topN !== null) pills.push({ kind: 'topn', label: `Top ${topN} reps`, onclear: () => (topN = null) })
    if (repSearch.trim()) pills.push({ kind: 'search', label: `"${repSearch}"`, onclear: () => (repSearch = '') })
    return pills
  })
  function refresh() {
    lastRefresh = new Date()
    // Real apps would re-fetch here; the deterministic seed makes this
    // a UI demonstration only.
  }

  // ---- Pivot model -----------------------------------------------------
  const features = tableFeatures({ rowSortingFeature })

  const values = $derived.by<PivotValueConfig<Fact>[]>(() => {
    const v: PivotValueConfig<Fact>[] = []
    if (showSales) v.push({
      field: 'amount', agg: 'sum', label: 'Sales',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
    })
    if (showUnits) v.push({ field: 'units', agg: 'sum', label: 'Units' })
    if (v.length === 0) v.push({ field: 'amount', agg: 'sum', label: 'Sales',
      format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } })
    return v
  })

  const pivot = $derived(
    createPivotModel<typeof features, Fact>(facts, {
      rows: ['region', 'salesPerson'],
      cols: ['quarter'],
      values,
    }),
  )

  // ---- KPIs + per-region sparkline trends ------------------------------
  const totalSales = $derived(
    facts.reduce((a, f) => a + f.amount, 0),
  )
  const totalUnits = $derived(
    facts.reduce((a, f) => a + f.units, 0),
  )
  const avgDeal = $derived(facts.length > 0 ? Math.round(totalSales / facts.length) : 0)
  const winRate = $derived(
    facts.length > 0
      ? Math.round((facts.filter((f) => f.amount > 8000).length / facts.length) * 100)
      : 0,
  )

  /** Quarter-over-quarter totals per region (for sparkline). */
  function trendFor(region: Region): number[] {
    return QUARTERS.map((q) =>
      allFacts.filter((f) => f.region === region && f.quarter === q).reduce((a, f) => a + f.amount, 0),
    )
  }
  function sparkPath(points: number[], w = 64, h = 22): string {
    if (points.length === 0) return ''
    const min = Math.min(...points)
    const max = Math.max(...points)
    const range = max - min || 1
    const stepX = points.length > 1 ? w / (points.length - 1) : w
    return points.map((p, i) => {
      const x = i * stepX
      const y = h - ((p - min) / range) * (h - 4) - 2
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }
  function pctChange(points: number[]): number {
    if (points.length < 2) return 0
    const first = points[0]!
    const last  = points[points.length - 1]!
    if (first === 0) return 0
    return Math.round(((last - first) / first) * 100)
  }

  // ---- Heatmap buckets per measure ------------------------------------
  const measureRanges = $derived.by(() => {
    const ranges: Record<string, { lo: number; hi: number }> = {}
    for (const r of pivot.rows) {
      if (r.__pivotKind !== 'leaf') continue
      for (const [k, v] of Object.entries(r)) {
        if (!k.startsWith('pv__')) continue
        const m = k.endsWith('__m0') ? 'm0' : k.endsWith('__m1') ? 'm1' : null
        if (!m) continue
        const n = Number(v)
        if (!Number.isFinite(n)) continue
        const cur = ranges[m] ?? { lo: Infinity, hi: -Infinity }
        if (n < cur.lo) cur.lo = n
        if (n > cur.hi) cur.hi = n
        ranges[m] = cur
      }
    }
    return ranges
  })
  function heatBucket(colId: string, value: unknown): string {
    const m = colId.endsWith('__m0') ? 'm0' : colId.endsWith('__m1') ? 'm1' : null
    if (!m) return ''
    const range = measureRanges[m]
    if (!range || range.lo === range.hi) return ''
    const n = Number(value)
    if (!Number.isFinite(n)) return ''
    const t = (n - range.lo) / (range.hi - range.lo)
    if (t < 0.20) return 'heat-1'
    if (t < 0.40) return 'heat-2'
    if (t < 0.60) return 'heat-3'
    if (t < 0.80) return 'heat-4'
    return 'heat-5'
  }

  // ---- Expansion state -------------------------------------------------
  const firstRegionId = $derived(
    pivot.rows.find((r) => r.__pivotKind === 'group' && r.__pivotDepth === 0)?.__pivotId,
  )
  let expanded = $state<Set<string>>(new Set())
  let didInitExpand = false
  $effect(() => {
    if (!didInitExpand && firstRegionId) {
      expanded = new Set([firstRegionId])
      didInitExpand = true
    }
  })

  const visibleRows = $derived(filterCollapsedPivotRows(pivot.rows, expanded))
  function toggle(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id); else next.add(id)
    expanded = next
  }
  const allGroupIds = $derived(
    pivot.rows.filter((r) => r.__pivotExpandable).map((r) => r.__pivotId),
  )
  function expandAll()   { expanded = new Set(allGroupIds) }
  function collapseAll() { expanded = new Set() }

  // ---- Columns: pin row header, heatmap on values ---------------------
  const columns = $derived(pivot.columns.map((c, i) => {
    if (i === 0) {
      return {
        ...c,
        width: 260,
        cell: (ctx) => renderSnippet(LabelCell, { row: ctx.row.original }),
      } as ColumnDef<typeof features, PivotRow>
    }
    const colId = c.id ?? ''
    return {
      ...c,
      align: 'right' as const,
      cellClass: (ctx) => {
        const row = ctx.row.original
        if (row.__pivotKind === 'grandTotal') return 'pv-cell pv-grand'
        if (row.__pivotKind === 'group')      return 'pv-cell pv-group'
        const heat = heatBucket(colId, ctx.getValue())
        return `pv-cell pv-leaf ${heat}`
      },
    } as ColumnDef<typeof features, PivotRow>
  }))

  // ---- Pro: pin first column + export ---------------------------------
  let api = $state<EnterpriseGridApi<typeof features, PivotRow> | null>(null)
  let exporting = $state(false)
  function onApiReady(next: SvGridApi<typeof features, PivotRow>) {
    api = installEnterprise(next)
    api.setColumnPinning({ left: ['__pivotRowHeader'] })
  }
  async function exportXlsx() {
    if (!api) return
    exporting = true
    try { await api.exportData({ format: 'xlsx', filename: 'sales-pivot' }) }
    catch (e) { console.error('[pivot export]', e) }
    finally { exporting = false }
  }

  const fmtCurrency = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  })
  const fmtNumber = new Intl.NumberFormat('en-US')
  /** Abbreviated currency: $1.2M / $84K / $920. */
  function fmtCurrencyShort(n: number): string {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
    return fmtCurrency.format(n)
  }
  function fmtMoney(n: number): string {
    return abbreviate ? fmtCurrencyShort(n) : fmtCurrency.format(n)
  }
  function fmtTime(d: Date): string {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
  }

  // ---- Drill-down popover --------------------------------------------
  // Click a leaf cell → show the top 5 deals at the intersection of
  // that row's (region, salesPerson) and the column's quarter.
  type DrillState = {
    region: Region
    rep: string
    quarter: Quarter | 'all'
    measure: 'Sales' | 'Units'
    total: number
    deals: Array<{ amount: number; units: number }>
    x: number; y: number
  } | null
  let drill = $state<DrillState>(null)
  function openDrill(row: PivotRow, colId: string, event: MouseEvent) {
    if (row.__pivotKind !== 'leaf') return
    const rep    = row.__pivotLabel
    // Walk the row's display label stack to find its region. Region is
    // the depth-0 ancestor; pivot.rows lists ancestors in their stable
    // ordering, so we can find the most recent group of depth 0.
    let region: Region | null = null
    for (const r of pivot.rows) {
      if (r.__pivotKind === 'group' && r.__pivotDepth === 0) region = r.__pivotLabel as Region
      if (r.__pivotId === row.__pivotId) break
    }
    if (!region) return
    // Decode quarter + measure from the leaf column id. Column ids have
    // the shape `pv__<axisValue>__m<i>` where axisValue is the quarter.
    const m = colId.match(/^pv__(.+)__m(\d+)$/)
    if (!m) return
    const quarter = m[1] as Quarter
    const measureIx = Number(m[2])
    const measure: 'Sales' | 'Units' = values[measureIx]?.label === 'Units' ? 'Units' : 'Sales'
    const matching = allFacts.filter((f) => f.region === region && f.salesPerson === rep && f.quarter === quarter)
    const deals = matching.slice().sort((a, b) => b.amount - a.amount).slice(0, 5)
    const total = measure === 'Sales'
      ? matching.reduce((a, f) => a + f.amount, 0)
      : matching.reduce((a, f) => a + f.units, 0)
    // Anchor near the click point but clamp to viewport.
    const W = 280, H = 240
    const vw = window.innerWidth, vh = window.innerHeight
    const x = Math.min(event.clientX, vw - W - 8)
    const y = Math.min(event.clientY, vh - H - 8)
    drill = { region, rep, quarter, measure, total, deals, x, y }
  }
  function closeDrill() { drill = null }
  $effect(() => {
    if (!drill) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('.drill-popover')) return
      closeDrill()
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDrill() }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onEsc)
    }
  })
</script>

{#snippet LabelCell(props: { row: PivotRow })}
  {@const row = props.row}
  {@const isExpanded = expanded.has(row.__pivotId)}
  <span class="pv-label" class:pv-label-grand={row.__pivotKind === 'grandTotal'}
        style="padding-left: {row.__pivotDepth * 16 + 6}px">
    {#if row.__pivotExpandable}
      <button type="button" class="pv-chev" class:is-open={isExpanded}
        onclick={() => toggle(row.__pivotId)}
        aria-label={isExpanded ? `Collapse ${row.__pivotLabel}` : `Expand ${row.__pivotLabel}`}
      >▸</button>
    {:else}
      <span class="pv-chev-spacer"></span>
    {/if}
    {#if row.__pivotKind === 'grandTotal'}
      <span>Grand total</span>
    {:else}
      <span class:pv-label-group={row.__pivotKind === 'group'}>{row.__pivotLabel}</span>
    {/if}
  </span>
{/snippet}

{#snippet RegionKpi(props: { region: Region; color: string })}
  {@const data  = trendFor(props.region)}
  {@const total = data.reduce((a, b) => a + b, 0)}
  {@const delta = pctChange(data)}
  <div class="kpi-card">
    <div class="kpi-card-head">
      <span class="kpi-region-dot" style="background: {props.color}"></span>
      <span class="kpi-region-name">{props.region}</span>
    </div>
    <div class="kpi-value">{fmtMoney(total)}</div>
    <div class="kpi-row">
      <svg class="spark" viewBox="0 0 64 22" preserveAspectRatio="none">
        <path d={sparkPath(data)} fill="none" stroke={props.color} stroke-width="1.5" stroke-linejoin="round" />
      </svg>
      <span class="kpi-delta" class:up={delta > 0} class:down={delta < 0}>
        {delta > 0 ? '▲' : delta < 0 ? '▼' : '•'} {Math.abs(delta)}%
      </span>
    </div>
  </div>
{/snippet}

<section class="dash flex flex-col flex-1 min-h-0 gap-3">
  <!-- Header strip -->
  <header class="dash-header shrink-0">
    <div class="dash-header-left">
      <div class="dash-crumbs">Analytics <span>›</span> Pivot</div>
      <h2 class="dash-title">Sales pipeline · 2026</h2>
    </div>
    <div class="dash-header-right">
      <span class="dash-stale">
        <span class="dash-stale-dot"></span>
        Last refresh {fmtTime(lastRefresh)}
      </span>
      <button type="button" class="dash-tool" onclick={refresh}>↻ Refresh</button>
      <button type="button" class="dash-tool dash-tool-primary" onclick={exportXlsx} disabled={exporting}>
        {exporting ? 'Exporting…' : '⬇ Export xlsx'}
      </button>
    </div>
  </header>

  <!-- Active-filter chip bar -->
  {#if activeFilterPills.length > 0}
    <div class="filter-pills shrink-0">
      <span class="filter-pills-label">Active filters:</span>
      {#each activeFilterPills as p (p.kind + p.label)}
        <span class="filter-pill" data-kind={p.kind}>
          {p.label}
          <button type="button" class="filter-pill-x" onclick={p.onclear} aria-label={`Clear ${p.label}`}>×</button>
        </span>
      {/each}
      <button type="button" class="filter-clear" onclick={resetFilters}>Clear all</button>
    </div>
  {/if}

  <!-- KPI tiles -->
  <div class="kpi-row-summary shrink-0">
    <div class="kpi-summary">
      <div class="kpi-summary-label">Total revenue</div>
      <div class="kpi-summary-value">{fmtMoney(totalSales)}</div>
      <div class="kpi-summary-foot">{facts.length} deals · {allowedReps.size} reps</div>
    </div>
    <div class="kpi-summary">
      <div class="kpi-summary-label">Units shipped</div>
      <div class="kpi-summary-value">{fmtNumber.format(totalUnits)}</div>
      <div class="kpi-summary-foot">across {QUARTERS.length} quarters</div>
    </div>
    <div class="kpi-summary">
      <div class="kpi-summary-label">Average deal</div>
      <div class="kpi-summary-value">{fmtMoney(avgDeal)}</div>
      <div class="kpi-summary-foot">revenue ÷ deals</div>
    </div>
    <div class="kpi-summary kpi-accent">
      <div class="kpi-summary-label">Win rate (&gt; $8k)</div>
      <div class="kpi-summary-value">{winRate}<span class="kpi-pct">%</span></div>
      <div class="kpi-summary-foot">deals above the bar</div>
    </div>
  </div>

  <!-- Region trend cards -->
  <div class="region-row shrink-0">
    {@render RegionKpi({ region: 'AMER', color: '#6366f1' })}
    {@render RegionKpi({ region: 'EMEA', color: '#0ea5e9' })}
    {@render RegionKpi({ region: 'APAC', color: '#10b981' })}
  </div>

  <!-- Pivot card -->
  <div class="pivot-card flex-1 min-h-0">
    <!-- Filter bar (row 1) -->
    <div class="pivot-toolbar shrink-0">
      <div class="pivot-filters">
        <span class="pivot-filter-label">Regions</span>
        {#each REGIONS as r (r)}
          <button type="button" class="pv-chip" class:is-active={activeRegions.has(r)}
            onclick={() => toggleRegion(r)}>{r}</button>
        {/each}
        <span class="pivot-filter-divider"></span>
        <span class="pivot-filter-label">Quarters</span>
        {#each QUARTERS as q (q)}
          <button type="button" class="pv-chip pv-chip-q" class:is-active={activeQuarters.has(q)}
            onclick={() => toggleQuarter(q)}>{q.replace('2026 ', '')}</button>
        {/each}
        <span class="pivot-filter-divider"></span>
        <span class="pivot-filter-label">Measures</span>
        <label class="pv-toggle">
          <input type="checkbox" bind:checked={showSales} />
          <span>Sales</span>
        </label>
        <label class="pv-toggle">
          <input type="checkbox" bind:checked={showUnits} />
          <span>Units</span>
        </label>
      </div>
      <div class="pivot-tools">
        <button type="button" class="dash-tool" onclick={expandAll}>Expand all</button>
        <button type="button" class="dash-tool" onclick={collapseAll}>Collapse all</button>
      </div>
    </div>

    <!-- Filter bar (row 2) -->
    <div class="pivot-toolbar pivot-toolbar-sub shrink-0">
      <div class="pivot-filters">
        <label class="pv-search">
          <span class="pv-search-icon" aria-hidden="true">⌕</span>
          <input type="search" placeholder="Search reps…" bind:value={repSearch} />
        </label>
        <span class="pivot-filter-divider"></span>
        <span class="pivot-filter-label">Top N reps</span>
        <div class="pv-density">
          <button type="button" class:is-active={topN === null} onclick={() => (topN = null)}>All</button>
          <button type="button" class:is-active={topN === 5}    onclick={() => (topN = 5)}>Top 5</button>
          <button type="button" class:is-active={topN === 3}    onclick={() => (topN = 3)}>Top 3</button>
          <button type="button" class:is-active={topN === 2}    onclick={() => (topN = 2)}>Top 2</button>
        </div>
      </div>
      <div class="pivot-tools">
        <span class="pivot-filter-label">Density</span>
        <div class="pv-density">
          <button type="button" class:is-active={density === 'compact'} onclick={() => (density = 'compact')}>Compact</button>
          <button type="button" class:is-active={density === 'comfy'}   onclick={() => (density = 'comfy')}>Comfy</button>
        </div>
        <span class="pivot-filter-divider"></span>
        <label class="pv-toggle">
          <input type="checkbox" bind:checked={abbreviate} />
          <span>K/M abbreviations</span>
        </label>
      </div>
    </div>

    <!-- Pivot grid -->
    <div class="pivot-host flex-1 min-h-0"
      class:is-compact={density === 'compact'}
      onclick={(event) => {
        const td = (event.target as HTMLElement | null)?.closest('td.sv-grid-cell') as HTMLElement | null
        if (!td) return
        const colId = td.dataset.colId ?? ''
        // Only leaf value cells open the drill-down. The row-header
        // column carries chevrons; we don't want to fight those.
        if (!colId.startsWith('pv__')) return
        const rowIx = Number(td.dataset.svgridRow)
        const row = visibleRows[rowIx]
        if (!row) return
        openDrill(row, colId, event)
      }}
      role="presentation"
    >
      <SvGrid responsive={true}
        data={visibleRows}
        columns={columns}
        features={features}
        filterMode="none"
        selectionMode="cell"
        enableInlineEditing={false}
        enableCellSelection={true}
        rowClass={({ row }) => {
          const k = (row as PivotRow).__pivotKind
          return {
            'pv-row-grand': k === 'grandTotal',
            'pv-row-group': k === 'group',
            'pv-row-leaf':  k === 'leaf',
          }
        }}
        rowHeight={density === 'compact' ? 28 : 36}
        containerHeight="100%"
        fitColumns={true}
        onApiReady={onApiReady}
      />
    </div>

    <!-- Drill-down popover -->
    {#if drill}
      <div class="drill-popover" style="left: {drill.x}px; top: {drill.y}px;"
           role="dialog" aria-label="Deal drill-down">
        <header class="drill-head">
          <div>
            <div class="drill-eyebrow">{drill.region} · {drill.quarter}</div>
            <div class="drill-title">{drill.rep}</div>
          </div>
          <button type="button" class="drill-close" onclick={closeDrill} aria-label="Close">×</button>
        </header>
        <div class="drill-summary">
          <span class="drill-summary-label">{drill.measure} total</span>
          <span class="drill-summary-value">
            {drill.measure === 'Sales' ? fmtMoney(drill.total) : fmtNumber.format(drill.total)}
          </span>
        </div>
        <div class="drill-deal-list">
          <div class="drill-deal-head">
            <span>Top {drill.deals.length} deal{drill.deals.length === 1 ? '' : 's'}</span>
            <span>Amount · Units</span>
          </div>
          {#each drill.deals as deal, i (i)}
            <div class="drill-deal">
              <span class="drill-deal-rank">#{i + 1}</span>
              <span class="drill-deal-amt">{fmtMoney(deal.amount)}</span>
              <span class="drill-deal-units">{deal.units} units</span>
            </div>
          {/each}
          {#if drill.deals.length === 0}
            <div class="drill-empty">No deals at this intersection.</div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Footer strip -->
    <div class="pivot-foot shrink-0">
      <div>
        Showing <strong>{visibleRows.length}</strong> of {pivot.rows.length} rows
      </div>
      <div class="pv-legend">
        Heat-map:
        <span class="pv-legend-low"></span> low
        <span class="pv-legend-mid"></span> mid
        <span class="pv-legend-high"></span> high
      </div>
    </div>
  </div>
</section>

<style>
  .dash {
    font-family: var(--sg-font, inherit);
    /* Heat-map text stays red/green (it carries meaning) but needs a
     * lighter pair on a dark ground to stay legible. */
    --heat-low-fg: #b91c1c;
    --heat-high-fg: #047857;
  }
  :global([data-theme="dark"]) .dash {
    --heat-low-fg: #fca5a5;
    --heat-high-fg: #6ee7b7;
  }

  /* ---- Header strip ---- */
  .dash-header {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 12px; flex-wrap: wrap;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .dash-crumbs   { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sg-muted, #94a3b8); }
  .dash-crumbs span { margin: 0 4px; opacity: 0.5; }
  .dash-title    { margin: 2px 0 0; font-size: 22px; font-weight: 700; color: var(--sg-fg, #0f172a); line-height: 1.1; }
  .dash-header-right { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .dash-stale    { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .dash-stale-dot {
    width: 8px; height: 8px; border-radius: 999px;
    background: #10b981;
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.12);
    animation: pulse 2.5s infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
  .dash-tool {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border-radius: 6px;
    padding: 5px 12px; font-size: 12px; font-weight: 500; cursor: pointer;
  }
  .dash-tool:hover         { background: var(--sg-row-hover-bg, rgba(148,163,184,0.10)); }
  .dash-tool-primary       {
    background: var(--sg-accent, #4338ca);
    border-color: var(--sg-accent, #4338ca);
    color: var(--sg-on-accent, #fff);
  }
  .dash-tool-primary:hover { filter: brightness(1.08); }
  .dash-tool-primary:disabled { opacity: 0.55; cursor: default; }

  /* ---- Top KPI strip ---- */
  .kpi-row-summary {
    display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;
  }
  .kpi-summary {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .kpi-accent { border-left: 3px solid var(--sg-accent, #4338ca); }
  .kpi-summary-label { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sg-muted, #64748b); }
  .kpi-summary-value { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--sg-fg, #0f172a); line-height: 1.1; }
  .kpi-pct           { font-size: 14px; font-weight: 600; color: var(--sg-muted, #64748b); margin-left: 2px; }
  .kpi-summary-foot  { font-size: 11px; color: var(--sg-muted, #94a3b8); }

  /* ---- Region trend cards ---- */
  .region-row {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px;
  }
  .kpi-card {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .kpi-card-head    { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; color: var(--sg-muted, #64748b); text-transform: uppercase; }
  .kpi-region-dot   { width: 8px; height: 8px; border-radius: 999px; }
  .kpi-region-name  { color: var(--sg-fg, #0f172a); }
  .kpi-value        { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--sg-fg, #0f172a); line-height: 1.1; }
  .kpi-row          { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .spark            { width: 64px; height: 22px; }
  .kpi-delta        { font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--sg-muted, #64748b); }
  .kpi-delta.up     { color: #047857; }
  .kpi-delta.down   { color: #b91c1c; }

  /* ---- Pivot card ---- */
  .pivot-card {
    display: flex; flex-direction: column; min-height: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    border-radius: 10px;
    overflow: hidden;
  }
  .pivot-toolbar {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; flex-wrap: wrap;
    padding: 10px 14px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc);
  }
  .pivot-filters       { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .pivot-filter-label  { font-size: 11px; color: var(--sg-muted, #64748b); letter-spacing: 0.04em; text-transform: uppercase; margin: 0 2px 0 4px; }
  .pivot-filter-divider {
    width: 1px; height: 18px; background: var(--sg-border, #cbd5e1); margin: 0 6px;
  }
  .pv-chip {
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    color: var(--sg-muted, #64748b);
    border-radius: 999px;
    padding: 3px 12px;
    font-size: 12px; font-weight: 600; letter-spacing: 0.02em;
    cursor: pointer;
  }
  .pv-chip:hover     { color: var(--sg-fg, #0f172a); }
  .pv-chip.is-active {
    background: var(--sg-accent, #4338ca);
    border-color: var(--sg-accent, #4338ca);
    color: var(--sg-on-accent, #fff);
  }
  .pv-toggle {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 12px; color: var(--sg-fg, #0f172a); cursor: pointer;
  }
  .pv-toggle input { accent-color: var(--sg-accent, #4338ca); }
  .pv-density {
    display: inline-flex; align-items: center;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff);
    border-radius: 6px; padding: 1px;
  }
  .pv-density button {
    background: transparent; border: 0;
    color: var(--sg-muted, #64748b);
    padding: 3px 10px; font-size: 11px; font-weight: 500; border-radius: 4px;
    cursor: pointer;
  }
  .pv-density button.is-active { background: var(--sg-row-alt-bg, #f1f5f9); color: var(--sg-fg, #0f172a); }
  .pivot-tools { display: inline-flex; align-items: center; gap: 6px; }

  /* ---- Pivot grid - row + cell styling ---- */
  :global(.pivot-host td.pv-cell)         { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; }
  :global(.pivot-host tr.pv-row-group td) {
    background: color-mix(in srgb, var(--sg-accent, #6366f1) 10%, transparent);
    font-weight: 600;
    border-bottom: 1px solid color-mix(in srgb, var(--sg-accent, #6366f1) 18%, transparent);
  }
  :global(.pivot-host tr.pv-row-grand td) {
    background: color-mix(in srgb, var(--sg-accent, #4338ca) 10%, transparent) !important;
    font-weight: 700; color: var(--sg-fg, #0f172a);
    border-top: 2px solid var(--sg-accent, #4338ca);
  }
  :global(.pivot-host tr.pv-row-leaf:hover td) { background: var(--sg-row-hover-bg, rgba(148, 163, 184, 0.10)); }

  /* Heat tinting */
  :global(.pivot-host td.pv-leaf.heat-1) { background: rgba(239, 68, 68, 0.16); color: var(--heat-low-fg, #b91c1c); }
  :global(.pivot-host td.pv-leaf.heat-2) { background: rgba(239, 68, 68, 0.06); }
  :global(.pivot-host td.pv-leaf.heat-3) { background: transparent; }
  :global(.pivot-host td.pv-leaf.heat-4) { background: rgba(16, 185, 129, 0.06); }
  :global(.pivot-host td.pv-leaf.heat-5) { background: rgba(16, 185, 129, 0.18); color: var(--heat-high-fg, #047857); font-weight: 600; }

  /* Pinned first column */
  :global(.pivot-host [data-col-id="__pivotRowHeader"]) {
    background: var(--sg-bg, #fff) !important;
    border-right: 2px solid var(--sg-border, #cbd5e1) !important;
    box-shadow: 2px 0 4px -2px rgba(15, 23, 42, 0.08);
  }
  :global(.pivot-host th[data-svgrid-header-col="__pivotRowHeader"]) {
    background: var(--sg-header-bg, #f8fafc) !important;
    border-right: 2px solid var(--sg-border, #cbd5e1) !important;
  }

  /* Header tracking */
  :global(.pivot-host thead th) {
    font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--sg-muted, #64748b);
    background: var(--sg-header-bg, #f8fafc);
    border-bottom: 1px solid var(--sg-border, #e2e8f0) !important;
  }
  :global(.pivot-host thead th[colspan]) {
    text-align: center; font-weight: 700; color: var(--sg-fg, #0f172a);
    background: color-mix(in srgb, var(--sg-accent, #6366f1) 10%, transparent);
  }
  :global(.pivot-host tbody td) {
    border-color: var(--sg-border, rgba(148, 163, 184, 0.18)) !important;
    padding: 6px 10px !important;
  }
  :global(.pivot-host.is-compact tbody td) { padding: 3px 8px !important; font-size: 12px; }

  /* Row label first column */
  .pv-label        { display: inline-flex; align-items: center; gap: 4px; min-width: 0; }
  .pv-chev {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px;
    background: none; border: 0; padding: 0; cursor: pointer;
    color: var(--sg-muted, #94a3b8);
    transform: rotate(0deg);
    transition: transform 100ms ease, color 100ms ease;
    font-size: 12px;
  }
  .pv-chev.is-open { transform: rotate(90deg); color: var(--sg-fg, #0f172a); }
  .pv-chev-spacer  { display: inline-block; width: 16px; }
  .pv-label-group  { font-weight: 600; }
  .pv-label-grand  { font-weight: 700; color: var(--sg-fg, #0f172a); }

  /* Footer */
  .pivot-foot {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 14px;
    border-top: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc);
    font-size: 11px; color: var(--sg-muted, #64748b);
  }
  .pv-legend { display: inline-flex; align-items: center; gap: 4px; }
  .pv-legend-low, .pv-legend-mid, .pv-legend-high {
    display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-left: 6px;
  }
  .pv-legend-low  { background: rgba(239, 68, 68, 0.30); }
  .pv-legend-mid  { background: rgba(148, 163, 184, 0.30); }
  .pv-legend-high { background: rgba(16, 185, 129, 0.30); }

  /* ---- New enterprise pieces ---- */
  .filter-pills {
    display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
    padding: 6px 10px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: color-mix(in srgb, var(--sg-accent, #4338ca) 4%, transparent);
    border-radius: 8px;
  }
  .filter-pills-label {
    font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--sg-muted, #64748b);
  }
  .filter-pill {
    display: inline-flex; align-items: center; gap: 4px;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 999px;
    padding: 2px 4px 2px 10px;
    font-size: 11.5px; font-weight: 600;
    color: var(--sg-fg, #0f172a);
  }
  .filter-pill[data-kind="region"]  { box-shadow: inset 0 0 0 1px rgba(99,102,241,0.4); }
  .filter-pill[data-kind="quarter"] { box-shadow: inset 0 0 0 1px rgba(14,165,233,0.4); }
  .filter-pill[data-kind="topn"]    { box-shadow: inset 0 0 0 1px rgba(67,56,202,0.4); }
  .filter-pill[data-kind="search"]  { box-shadow: inset 0 0 0 1px rgba(245,158,11,0.4); }
  .filter-pill-x {
    border: 0; background: transparent;
    color: var(--sg-muted, #94a3b8);
    cursor: pointer; padding: 0 4px;
    font-size: 14px; line-height: 1;
  }
  .filter-pill-x:hover { color: var(--sg-fg, #0f172a); }
  .filter-clear {
    margin-left: auto;
    border: 0; background: transparent;
    color: var(--sg-accent, #4338ca); cursor: pointer;
    font-size: 11.5px; font-weight: 600;
    padding: 2px 8px; border-radius: 4px;
  }
  .filter-clear:hover { background: color-mix(in srgb, var(--sg-accent, #4338ca) 10%, transparent); }

  .pivot-toolbar-sub {
    background: transparent;
    border-top: 1px dashed var(--sg-border, #e2e8f0);
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .pv-chip-q {
    font-family: ui-monospace, Menlo, monospace;
    letter-spacing: 0;
  }
  .pv-search {
    display: inline-flex; align-items: center; gap: 4px;
    background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 6px;
    padding: 2px 8px;
  }
  .pv-search-icon { color: var(--sg-muted, #94a3b8); font-size: 13px; }
  .pv-search input {
    border: 0; outline: none; background: transparent;
    color: var(--sg-fg, #0f172a);
    font-size: 12px; padding: 3px 0;
    width: 160px;
  }
  .pv-search input::placeholder { color: var(--sg-muted, #94a3b8); }

  /* Make leaf value cells look clickable. */
  :global(.pivot-host tr.pv-row-leaf td.pv-leaf) {
    cursor: pointer;
    transition: background 80ms ease;
  }
  :global(.pivot-host tr.pv-row-leaf td.pv-leaf:hover) {
    box-shadow: inset 0 0 0 2px var(--sg-accent, #4338ca);
  }

  /* ---- Drill-down popover ---- */
  .drill-popover {
    position: fixed; z-index: 80;
    width: 280px;
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 10px;
    box-shadow: 0 12px 36px rgba(15, 23, 42, 0.20);
    padding: 12px;
    animation: drillIn 120ms ease-out;
  }
  @keyframes drillIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
  .drill-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .drill-eyebrow { font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sg-muted, #64748b); }
  .drill-title   { font-size: 14px; font-weight: 700; color: var(--sg-fg, #0f172a); margin-top: 2px; }
  .drill-close   {
    border: 0; background: transparent;
    color: var(--sg-muted, #94a3b8); font-size: 18px; line-height: 1; cursor: pointer;
    padding: 0 4px;
  }
  .drill-close:hover { color: var(--sg-fg, #0f172a); }
  .drill-summary {
    margin: 8px 0;
    padding: 8px 10px;
    background: color-mix(in srgb, var(--sg-accent, #4338ca) 8%, transparent);
    border-radius: 6px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .drill-summary-label { font-size: 11px; color: var(--sg-muted, #64748b); letter-spacing: 0.04em; text-transform: uppercase; }
  .drill-summary-value { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--sg-accent, #4338ca); }
  .drill-deal-list   { display: flex; flex-direction: column; gap: 4px; }
  .drill-deal-head   {
    display: flex; justify-content: space-between;
    font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--sg-muted, #94a3b8);
    padding-bottom: 4px;
    border-bottom: 1px dashed var(--sg-border, #e2e8f0);
    margin-bottom: 4px;
  }
  .drill-deal {
    display: grid;
    grid-template-columns: 30px 1fr auto;
    gap: 8px; align-items: center;
    padding: 4px 0;
    font-size: 12px;
  }
  .drill-deal-rank   { font-size: 10px; color: var(--sg-muted, #94a3b8); }
  .drill-deal-amt    { font-weight: 600; font-variant-numeric: tabular-nums; }
  .drill-deal-units  { font-size: 11px; color: var(--sg-muted, #64748b); }
  .drill-empty       { font-size: 12px; color: var(--sg-muted, #64748b); padding: 6px 0; text-align: center; }
  /* Phone: the card is a flex-basis-0 pane, so it stayed at the 360px floor while its
     toolbar + grid + footer needed ~470 and the footer was clipped. Size it to content. */
  @media (max-width: 639px), (max-height: 500px) and (pointer: coarse) {
    .pivot-card { flex: 1 0 auto; }
  }
</style>
