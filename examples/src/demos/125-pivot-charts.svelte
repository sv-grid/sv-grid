<script lang="ts">
  /**
   * 125. Pivot + linked charts (Pro)
   * --------------------------------
   * A pivot cube linked to two charts that always reflect the same
   * slice the grid renders. Click any row to focus the chart on that
   * row's subtree; click a value cell to highlight the bar / line
   * point. The charts are zero-dependency inline SVG so the demo
   * stays self-contained.
   *
   *   - **Bar chart** plots each row dimension value's total ARR.
   *     With no row selected: all top-level groups. With a region
   *     selected: every country inside it. With a country selected:
   *     every product family inside that country.
   *   - **Line chart** plots the quarterly trend for the active
   *     scope (full slice, region, country, or family) across every
   *     year in the dataset.
   *
   * Everything is driven by the same `createPivotModel` output the
   * other pivot demos use - this demo is about wiring the grid's
   * selection to the chart's data source.
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
    type PivotValueConfig,
  } from 'sv-grid-pro'

  setLicenseKey('SVPRO-DEV-DEMO')

  // ---- Domain --------------------------------------------------------
  type Region = 'AMER' | 'EMEA' | 'APAC'
  type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'
  type Family = 'Cloud Storage' | 'Data Pipeline' | 'AI Platform' | 'Security Suite'
  type Fact = {
    region: Region; country: string; family: Family
    year: number; quarter: Quarter
    arr: number; units: number
  }
  const TOPO: Record<Region, string[]> = {
    AMER: ['USA', 'Canada', 'Mexico'],
    EMEA: ['Germany', 'UK', 'France'],
    APAC: ['Japan', 'India', 'Australia'],
  }
  const FAMILIES: Family[] = ['Cloud Storage', 'Data Pipeline', 'AI Platform', 'Security Suite']
  const YEARS = [2024, 2025, 2026] as const
  const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4']

  const REGION_TINT: Record<Region, string> = {
    AMER: '#6366f1', EMEA: '#0ea5e9', APAC: '#10b981',
  }
  const REGION_GROWTH: Record<Region, number> = { AMER: 0.04, EMEA: 0.06, APAC: 0.12 }
  const REGION_BASE:   Record<Region, number> = { AMER: 1.0,  EMEA: 0.7,  APAC: 0.5  }
  const FAMILY_MIX: Record<Family, number> = {
    'Cloud Storage': 0.40, 'Data Pipeline': 0.25, 'AI Platform': 0.20, 'Security Suite': 0.15,
  }
  let prng = 0xC417A111 >>> 0
  function rnd(): number { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function seed(): Fact[] {
    const out: Fact[] = []
    for (const region of Object.keys(TOPO) as Region[]) {
      for (const country of TOPO[region]) {
        for (const family of FAMILIES) {
          for (const year of YEARS) {
            for (const q of QUARTERS) {
              const qIdx = (year - YEARS[0]) * 4 + (q === 'Q1' ? 0 : q === 'Q2' ? 1 : q === 'Q3' ? 2 : 3)
              const yoy = Math.pow(1 + REGION_GROWTH[region], qIdx / 4)
              const noise = 0.85 + rnd() * 0.30
              const arr = Math.round(380_000 * REGION_BASE[region] * FAMILY_MIX[family] * yoy * noise)
              out.push({
                region, country, family, year, quarter: q,
                arr, units: 8 + Math.floor(rnd() * 90),
              })
            }
          }
        }
      }
    }
    return out
  }
  const facts = seed()

  // ---- Pivot model ---------------------------------------------------
  const features = tableFeatures({})
  const values: PivotValueConfig<Fact>[] = [
    { field: 'arr',   agg: 'sum', label: 'ARR' },
    { field: 'units', agg: 'sum', label: 'Units' },
  ]
  const pivot = $derived(createPivotModel<typeof features, Fact>(facts, {
    rows: ['region', 'country', 'family'],
    cols: ['quarter'],
    values,
    grandTotalCol: true,
  }))

  // Default: expand AMER region.
  let expanded = $state<Set<string>>(new Set())
  let didInit = false
  $effect(() => {
    if (didInit) return
    const amer = pivot.rows.find((r) => r.__pivotKind === 'group' && r.__pivotLabel === 'AMER')
    if (!amer) return
    expanded = new Set([amer.__pivotId])
    didInit = true
  })
  function toggle(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id); else next.add(id)
    expanded = next
  }
  const visibleRows = $derived(filterCollapsedPivotRows(pivot.rows, expanded))

  // ---- Row selection (drives the charts) -----------------------------
  /** The row whose subtree the charts should focus on. null = whole
   *  cube (drives top-level groups in the bar chart). */
  let selectedRowId = $state<string | null>(null)
  const selectedRow = $derived(
    selectedRowId
      ? pivot.rows.find((r) => r.__pivotId === selectedRowId) ?? null
      : null,
  )

  /** Walk the clicked row's chain (region/country/family). Same
   *  pattern as demo 122's drill-through. Position-based not depth-
   *  based because the engine counts the synthetic root as level 0. */
  const ROW_FIELDS = ['region', 'country', 'family'] as const
  function chainOf(row: PivotRow): { region?: Region; country?: string; family?: Family } {
    if (row.__pivotKind === 'grandTotal') return {}
    const chain: PivotRow[] = []
    let cur: PivotRow | undefined = row
    while (cur) {
      chain.unshift(cur)
      const pid: string | null = cur.__pivotParentId
      cur = pid ? pivot.rows.find((r) => r.__pivotId === pid) : undefined
    }
    const out: { region?: Region; country?: string; family?: Family } = {}
    for (let i = 0; i < chain.length && i < ROW_FIELDS.length; i += 1) {
      const f = ROW_FIELDS[i]!
      const label = String(chain[i]!.__pivotLabel)
      if (f === 'region') out.region = label as Region
      else if (f === 'country') out.country = label
      else if (f === 'family') out.family = label as Family
    }
    return out
  }
  const scopeFilter = $derived(selectedRow ? chainOf(selectedRow) : {} as ReturnType<typeof chainOf>)

  /** Source facts matching the active scope (used by the charts and
   *  the scope KPI strip). When no row is selected, this is every fact. */
  const scopeFacts = $derived.by(() => {
    const sf = scopeFilter
    if (!sf.region && !sf.country && !sf.family) return facts
    return facts.filter((f) =>
      (sf.region  === undefined || f.region  === sf.region)
      && (sf.country === undefined || f.country === sf.country)
      && (sf.family  === undefined || f.family  === sf.family)
    )
  })

  // ---- Bar chart data (one bar per child of the selected scope) ------
  type Bar = { label: string; value: number; color: string }
  const barData = $derived.by<Bar[]>(() => {
    const sf = scopeFilter
    // Pick the next nesting level for the bar groups.
    let key: keyof Fact
    let scope = scopeFacts
    if (!sf.region) { key = 'region' }
    else if (!sf.country) { key = 'country' }
    else if (!sf.family)  { key = 'family' }
    else                  { key = 'quarter'; scope = scopeFacts }
    const sums = new Map<string, number>()
    for (const f of scope) {
      const k = String(f[key])
      sums.set(k, (sums.get(k) ?? 0) + f.arr)
    }
    const bars = Array.from(sums.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({
        label,
        value,
        color: sf.region ? REGION_TINT[sf.region] : (REGION_TINT[label as Region] ?? '#6366f1'),
      }))
    return bars
  })

  // ---- Line chart data (quarterly totals per year for the scope) -----
  type LineSeries = { year: number; points: number[]; color: string }
  const lineData = $derived.by<LineSeries[]>(() => {
    const series: LineSeries[] = []
    const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444']
    for (let i = 0; i < YEARS.length; i += 1) {
      const year = YEARS[i]!
      const pts = QUARTERS.map((q) =>
        scopeFacts.filter((f) => f.year === year && f.quarter === q).reduce((a, f) => a + f.arr, 0),
      )
      series.push({ year, points: pts, color: palette[i] ?? '#6366f1' })
    }
    return series
  })

  // ---- Scope KPIs ----------------------------------------------------
  const scopeKpis = $derived.by(() => {
    const totalArr = scopeFacts.reduce((a, f) => a + f.arr, 0)
    const units    = scopeFacts.reduce((a, f) => a + f.units, 0)
    const avgDeal  = scopeFacts.length > 0 ? totalArr / scopeFacts.length : 0
    return { totalArr, units, avgDeal, facts: scopeFacts.length }
  })

  // ---- Column tree ---------------------------------------------------
  const columns = $derived(pivot.columns.map((c, i) => {
    if (i === 0) {
      return {
        ...c,
        width: 260,
        header: 'Region / Country / Product family',
        cell: (ctx) => renderSnippet(LabelCell, { row: ctx.row.original }),
      } as ColumnDef<typeof features, PivotRow>
    }
    return decorate(c) as ColumnDef<typeof features, PivotRow>
  }))
  function decorate(c: ColumnDef<typeof features, PivotRow>): ColumnDef<typeof features, PivotRow> {
    if (c.columns?.length) return { ...c, columns: c.columns.map(decorate) }
    const id = c.id ?? ''
    return {
      ...c,
      width: 110,
      align: 'right',
      cell: (ctx) => fmtMoney(Number(ctx.row.original[id] ?? 0)),
      cellClass: (ctx) => kindClass(ctx.row.original),
    }
  }
  function kindClass(row: PivotRow): string {
    const sel = selectedRowId === row.__pivotId ? ' pv-row-selected' : ''
    if (row.__pivotKind === 'grandTotal') return `pv-row-grand${sel}`
    if (row.__pivotKind === 'group')      return `${row.__pivotDepth === 1 ? 'pv-row-l1' : 'pv-row-l2'}${sel}`
    return sel.trim()
  }

  function handleCellClick(e: { columnId: string; row: PivotRow }) {
    // Drill the chart: clicking any cell selects the row scope.
    selectedRowId = e.row.__pivotKind === 'grandTotal' ? null : e.row.__pivotId
  }
  function clearSelection() { selectedRowId = null }

  // ---- Formatters ----------------------------------------------------
  function fmtMoney(n: number): string {
    if (!Number.isFinite(n)) return '-'
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`
    return `$${Math.round(n)}`
  }
  function fmtNum(n: number): string { return n.toLocaleString('en-US') }

  // ---- Bar + line SVG geometry --------------------------------------
  const BAR_W = 460, BAR_H = 220, BAR_PAD_L = 80, BAR_PAD_R = 16, BAR_PAD_T = 12, BAR_PAD_B = 24
  const LINE_W = 460, LINE_H = 220, LINE_PAD_L = 50, LINE_PAD_R = 16, LINE_PAD_T = 12, LINE_PAD_B = 30

  const barGeom = $derived.by(() => {
    const max = Math.max(1, ...barData.map((b) => b.value))
    const innerW = BAR_W - BAR_PAD_L - BAR_PAD_R
    const innerH = BAR_H - BAR_PAD_T - BAR_PAD_B
    const rowH = barData.length > 0 ? innerH / barData.length : 0
    const barH = Math.max(8, rowH - 6)
    return barData.map((b, i) => {
      const y = BAR_PAD_T + i * rowH + (rowH - barH) / 2
      const w = (b.value / max) * innerW
      return { ...b, x: BAR_PAD_L, y, w, h: barH }
    })
  })

  const lineGeom = $derived.by(() => {
    const all = lineData.flatMap((s) => s.points)
    const max = Math.max(1, ...all)
    const min = Math.min(0, ...all)
    const range = max - min || 1
    const innerW = LINE_W - LINE_PAD_L - LINE_PAD_R
    const innerH = LINE_H - LINE_PAD_T - LINE_PAD_B
    const stepX = QUARTERS.length > 1 ? innerW / (QUARTERS.length - 1) : innerW
    return lineData.map((s) => ({
      ...s,
      path: s.points.map((p, i) => {
        const x = LINE_PAD_L + i * stepX
        const y = LINE_PAD_T + innerH - ((p - min) / range) * innerH
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      }).join(' '),
      dots: s.points.map((p, i) => ({
        x: LINE_PAD_L + i * stepX,
        y: LINE_PAD_T + innerH - ((p - min) / range) * innerH,
        value: p,
      })),
    }))
  })

  const scopeLabel = $derived.by(() => {
    const sf = scopeFilter
    const parts: string[] = []
    if (sf.region) parts.push(sf.region)
    if (sf.country) parts.push(sf.country)
    if (sf.family)  parts.push(sf.family)
    return parts.length > 0 ? parts.join(' › ') : 'All regions'
  })
  const barTitle = $derived.by(() => {
    const sf = scopeFilter
    if (!sf.region)  return 'ARR by region'
    if (!sf.country) return `ARR by country · ${sf.region}`
    if (!sf.family)  return `ARR by product · ${sf.country}`
    return `ARR by quarter · ${sf.family}`
  })
</script>

{#snippet LabelCell(props: { row: PivotRow })}
  {@const row = props.row}
  {@const isOpen = expanded.has(row.__pivotId)}
  <span class="pv-label" class:pv-label-grand={row.__pivotKind === 'grandTotal'}
        style={`padding-left: ${Math.max(0, row.__pivotDepth - 1) * 14 + 6}px`}>
    {#if row.__pivotExpandable}
      <button type="button" class="pv-chev" class:open={isOpen}
              aria-label={isOpen ? 'Collapse' : 'Expand'}
              onclick={(e) => { e.stopPropagation(); toggle(row.__pivotId) }}>▸</button>
    {:else}
      <span class="pv-chev-spacer" aria-hidden="true"></span>
    {/if}
    {#if row.__pivotKind === 'grandTotal'}
      <strong>Grand total</strong>
    {:else}
      <span class:pv-label-group={row.__pivotKind === 'group'}>{row.__pivotLabel}</span>
    {/if}
  </span>
{/snippet}

<section class="ch-shell flex flex-col flex-1 min-h-0 gap-3">
  <header class="ch-header">
    <h2>Pivot grid + linked charts</h2>
    <p>
      Click any row in the cube to focus the bar + line charts on that scope.
      The cube and charts always read the same fact slice - the bar chart
      drills one level deeper (region → country → product) as you click,
      and the line chart shows quarterly totals per year.
    </p>
  </header>

  <div class="ch-scope">
    <div>
      <span class="ch-scope-eyebrow">Active scope</span>
      <span class="ch-scope-label">{scopeLabel}</span>
    </div>
    <div class="ch-scope-kpis">
      <div class="ch-scope-kpi"><div class="ch-kpi-l">ARR</div><div class="ch-kpi-v">{fmtMoney(scopeKpis.totalArr)}</div></div>
      <div class="ch-scope-kpi"><div class="ch-kpi-l">Units</div><div class="ch-kpi-v">{fmtNum(scopeKpis.units)}</div></div>
      <div class="ch-scope-kpi"><div class="ch-kpi-l">Avg deal</div><div class="ch-kpi-v">{fmtMoney(scopeKpis.avgDeal)}</div></div>
      <div class="ch-scope-kpi"><div class="ch-kpi-l">Facts</div><div class="ch-kpi-v">{fmtNum(scopeKpis.facts)}</div></div>
    </div>
    <button type="button" class="ch-reset" disabled={!selectedRowId} onclick={clearSelection}>Clear selection</button>
  </div>

  <div class="ch-grid-split flex flex-1 min-h-0 gap-3">
    <div class="ch-pivot-wrap flex-1 min-w-0">
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

    <aside class="ch-charts">
      <div class="ch-chart-card">
        <div class="ch-chart-head">
          <span class="ch-chart-eyebrow">Bar</span>
          <span class="ch-chart-title">{barTitle}</span>
        </div>
        <div class="ch-chart-body">
          {#if barGeom.length === 0}
            <div class="ch-empty">No data for this scope.</div>
          {:else}
            <svg viewBox={`0 0 ${BAR_W} ${BAR_H}`} preserveAspectRatio="xMinYMin meet" class="ch-svg">
              {#each barGeom as b (b.label)}
                <text x={BAR_PAD_L - 6} y={b.y + b.h / 2} text-anchor="end" dominant-baseline="middle" class="ch-bar-name">{b.label}</text>
                <rect x={b.x} y={b.y} width={Math.max(2, b.w)} height={b.h} fill={b.color} rx="2" ry="2" />
                <text x={b.x + b.w + 4} y={b.y + b.h / 2} dominant-baseline="middle" class="ch-bar-value">{fmtMoney(b.value)}</text>
              {/each}
            </svg>
          {/if}
        </div>
      </div>

      <div class="ch-chart-card">
        <div class="ch-chart-head">
          <span class="ch-chart-eyebrow">Line</span>
          <span class="ch-chart-title">QoQ trend · {scopeLabel}</span>
        </div>
        <div class="ch-chart-body">
          <svg viewBox={`0 0 ${LINE_W} ${LINE_H}`} preserveAspectRatio="xMinYMin meet" class="ch-svg">
            <!-- x-axis quarter labels -->
            {#each QUARTERS as q, i (q)}
              <text
                x={LINE_PAD_L + i * ((LINE_W - LINE_PAD_L - LINE_PAD_R) / (QUARTERS.length - 1))}
                y={LINE_H - LINE_PAD_B + 16}
                text-anchor="middle"
                class="ch-axis-label"
              >{q}</text>
            {/each}
            <!-- Series -->
            {#each lineGeom as s (s.year)}
              <path d={s.path} fill="none" stroke={s.color} stroke-width="1.8" stroke-linejoin="round" />
              {#each s.dots as d, i (i)}
                <circle cx={d.x} cy={d.y} r="3" fill={s.color}><title>{s.year} {QUARTERS[i]}: {fmtMoney(d.value)}</title></circle>
              {/each}
            {/each}
          </svg>
          <div class="ch-legend">
            {#each lineGeom as s (s.year)}
              <span class="ch-legend-item">
                <span class="ch-legend-dot" style={`background:${s.color}`} aria-hidden="true"></span>
                {s.year}
              </span>
            {/each}
          </div>
        </div>
      </div>
    </aside>
  </div>
</section>

<style>
  .ch-header h2 { font-size: 16px; font-weight: 700; margin: 0; }
  .ch-header p  { margin: 4px 0 0; font-size: 12.5px; color: var(--sg-muted, #64748b); max-width: 80ch; }

  /* Scope strip */
  .ch-scope {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 10px 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(99,102,241,0.06), rgba(14,165,233,0.04));
    flex-shrink: 0;
  }
  :global([data-theme='dark']) .ch-scope {
    background: linear-gradient(135deg, rgba(99,102,241,0.18), rgba(14,165,233,0.10));
  }
  .ch-scope-eyebrow {
    display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b); font-weight: 700;
  }
  .ch-scope-label  { font-size: 14px; font-weight: 700; }
  .ch-scope-kpis { display: flex; gap: 12px; margin-left: auto; }
  .ch-scope-kpi { font-size: 11.5px; }
  .ch-kpi-l { color: var(--sg-muted, #64748b); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
  .ch-kpi-v { font-weight: 700; font-variant-numeric: tabular-nums; }
  .ch-reset {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    padding: 4px 10px; border-radius: 5px;
    font-size: 11.5px; cursor: pointer;
  }
  .ch-reset:disabled { opacity: 0.4; cursor: default; }
  .ch-reset:hover:not(:disabled) { background: var(--sg-header-bg, #f1f5f9); }

  /* Workspace */
  .ch-grid-split { min-height: 0; }
  .ch-pivot-wrap {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }
  .ch-charts {
    width: 520px;
    flex-shrink: 0;
    display: flex; flex-direction: column; gap: 12px;
    overflow: auto;
  }
  .ch-chart-card {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .ch-chart-head {
    display: flex; align-items: baseline; gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f8fafc);
  }
  :global([data-theme='dark']) .ch-chart-head { background: rgba(148,163,184,0.10); }
  .ch-chart-eyebrow {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b); font-weight: 700;
  }
  .ch-chart-title { font-size: 13px; font-weight: 700; }
  .ch-chart-body { padding: 8px 8px 12px; }
  .ch-svg { width: 100%; height: auto; display: block; }
  .ch-empty {
    height: 220px; display: flex; align-items: center; justify-content: center;
    color: var(--sg-muted, #64748b); font-size: 12px;
  }
  .ch-legend {
    display: flex; gap: 12px; padding-top: 6px;
    font-size: 11.5px; color: var(--sg-muted, #64748b);
  }
  .ch-legend-item { display: inline-flex; align-items: center; gap: 5px; }
  .ch-legend-dot {
    display: inline-block; width: 10px; height: 10px; border-radius: 999px;
  }

  /* SVG text */
  :global(.ch-bar-name)  { font-size: 11px; fill: var(--sg-fg, #1e293b); font-weight: 600; }
  :global(.ch-bar-value) { font-size: 10px; fill: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  :global(.ch-axis-label) { font-size: 10px; fill: var(--sg-muted, #64748b); }
  :global([data-theme='dark']) :global(.ch-bar-name)  { fill: #f1f5f9; }
  :global([data-theme='dark']) :global(.ch-bar-value) { fill: #94a3b8; }
  :global([data-theme='dark']) :global(.ch-axis-label) { fill: #94a3b8; }

  /* Pivot rows */
  :global(.pv-label) { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; cursor: pointer; }
  :global(.pv-label-group) { font-weight: 700; }
  :global(.pv-label-grand) { color: var(--sg-accent, #2563eb); font-weight: 700; }
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

  :global(.pv-row-l1)    { background: rgba(99,102,241,0.08) !important; font-weight: 700; }
  :global(.pv-row-l2)    { background: rgba(14,165,233,0.06) !important; font-weight: 600; }
  :global(.pv-row-grand) { background: rgba(99,102,241,0.18) !important; font-weight: 800; color: var(--sg-accent, #2563eb); }
  :global(.pv-row-selected) {
    box-shadow: inset 3px 0 0 var(--sg-accent, #2563eb);
    background: rgba(99,102,241,0.16) !important;
  }
</style>
