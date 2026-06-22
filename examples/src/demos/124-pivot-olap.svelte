<script lang="ts">
  /**
   * 124. OLAP cube - SaaS revenue intelligence (Pro)
   * ------------------------------------------------
   * A production-feel OLAP browser modelled on PowerBI / Tableau /
   * SSAS Cube browsers, with the pivot grid rendered in the classic
   * Tabular form: each row dimension (Region · Country · Product
   * family) gets its OWN column, expand chevrons live in the dim cell
   * of the level that owns the children, subtotals surface as
   * "<value> Total" within the dimension column.
   *
   * Around the cube:
   *   - Page header: title, crumbs, last-refresh timestamp, refresh +
   *     export actions.
   *   - 5 KPI tiles with QoQ sparkline trends.
   *   - Left rail "slicers" - the OLAP-standard side filter strip:
   *     region multi-select, year picker, search-by-country, density,
   *     heatmap toggle, view-mode (outline vs full).
   *   - Right rail "insights" - top movers QoQ, top-3 contributors,
   *     outlier callouts. Driven by the same fact slice the cube reads.
   *
   * The pivot engine + column tree are the same `createPivotModel`
   * output - this demo only changes how the row-header column is
   * remapped to N dim columns AND wraps the cube in the dashboard
   * chrome a real BI tool would ship.
   */
  import {
    SvGrid,
    tableFeatures,
    renderSnippet,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'
  import {
    createPivotModel,
    filterCollapsedPivotRows,
    installEnterprise,
    setLicenseKey,
    type EnterpriseGridApi,
    type PivotRow,
    type PivotValueConfig,
  } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-DEMO')

  // ---- Domain --------------------------------------------------------
  type Region = 'AMER' | 'EMEA' | 'APAC'
  type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'
  type ProductFamily = 'Cloud Storage' | 'Data Pipeline' | 'AI Platform' | 'Security Suite'
  type Fact = {
    region: Region
    country: string
    family: ProductFamily
    year: number
    quarter: Quarter
    arr: number          // annual recurring revenue (USD)
    customers: number
    nrr: number          // net revenue retention (0..1.5)
    margin: number       // gross margin (0..1)
  }
  const TOPO: Record<Region, string[]> = {
    AMER: ['USA', 'Canada', 'Mexico', 'Brazil'],
    EMEA: ['Germany', 'UK', 'France', 'Netherlands', 'Sweden'],
    APAC: ['Japan', 'India', 'Australia', 'Singapore'],
  }
  const FAMILIES: ProductFamily[] = ['Cloud Storage', 'Data Pipeline', 'AI Platform', 'Security Suite']
  const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4']
  const YEARS = [2024, 2025, 2026] as const

  // Per-region multiplier so AMER has the biggest ARR base but APAC
  // grows fastest QoQ - this is what BI dashboards demonstrate.
  const REGION_BASE: Record<Region, number> = { AMER: 1.0, EMEA: 0.65, APAC: 0.42 }
  const REGION_GROWTH: Record<Region, number> = { AMER: 0.04, EMEA: 0.06, APAC: 0.11 }
  const FAMILY_MIX: Record<ProductFamily, number> = {
    'Cloud Storage': 0.40,
    'Data Pipeline': 0.25,
    'AI Platform':   0.20,
    'Security Suite':0.15,
  }
  const COUNTRY_TINT: Record<string, string> = {
    USA: '#6366f1', Canada: '#8b5cf6', Mexico: '#f97316', Brazil: '#10b981',
    Germany: '#0ea5e9', UK: '#a855f7', France: '#ef4444', Netherlands: '#f59e0b', Sweden: '#22d3ee',
    Japan: '#ec4899', India: '#f97316', Australia: '#14b8a6', Singapore: '#8b5cf6',
  }

  let prng = 0xCABBA001 >>> 0
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
              const base = 320_000 * REGION_BASE[region] * FAMILY_MIX[family] * yoy * noise
              const customers = Math.max(2, Math.round(base / (4_000 + rnd() * 6_000)))
              out.push({
                region, country, family, year, quarter: q,
                arr: Math.round(base),
                customers,
                nrr: 0.85 + rnd() * 0.45,   // 85% .. 130%
                margin: 0.55 + rnd() * 0.28,
              })
            }
          }
        }
      }
    }
    return out
  }
  const facts = seed()

  // ---- UI state ------------------------------------------------------
  let activeRegions = $state<Set<Region>>(new Set(['AMER', 'EMEA', 'APAC']))
  let activeYear    = $state<number | 'all'>(2026)
  let countrySearch = $state('')
  let viewMode      = $state<'outline' | 'full'>('outline')
  let heatmapOn     = $state<boolean>(true)
  let density       = $state<'comfy' | 'compact'>('comfy')
  let lastRefresh   = $state<Date>(new Date())
  function refresh() { lastRefresh = new Date() }

  // Pro API hook - export needs api.exportData (Pro install).
  let api = $state<EnterpriseGridApi<typeof features, PivotRow> | null>(null)
  let exporting = $state(false)
  let exportNote = $state<string | null>(null)
  function onApiReady(next: SvGridApi<typeof features, PivotRow>) {
    api = installEnterprise(next)
  }
  /** Export the cube to xlsx. We flatten ONLY the leaf rows (no engine
   *  subtotal / grand rows) and ask the exporter to wrap them with
   *  Smart's native Excel outline grouping by Region → Country. The
   *  user opens the file in Excel and the row-header gutter shows
   *  +/- buttons to fold every region or country group. */
  async function exportXlsx() {
    if (!api) return
    exporting = true
    exportNote = null
    try {
      const exportRows = pivot.rows
        .filter((r) => r.__pivotKind === 'leaf')
        .map((r) => {
          const chain = chainForRow.get(r.__pivotId) ?? []
          const flat: Record<string, unknown> = {
            region:  chain[0] ?? '',
            country: chain[1] ?? '',
            family:  chain[2] ?? '',
          }
          for (const [k, v] of Object.entries(r)) {
            if (!k.startsWith('pv__')) continue
            const m = k.match(/^pv__(.+)__m(\d+)$/)
            if (!m) continue
            const q = m[1]!.replace(/_/g, ' ')
            const measureLabel = values[Number(m[2])]?.label ?? `m${m[2]}`
            flat[`${q} · ${measureLabel}`] = typeof v === 'number' ? Math.round(v * 1000) / 1000 : v
          }
          return flat
        })

      const firstKeys = exportRows.length > 0 ? Object.keys(exportRows[0]!) : []
      const dimOrder = ['region', 'country', 'family']
      const measureKeys = firstKeys.filter((k) => !dimOrder.includes(k))
      const exportCols = [
        { field: 'region',  header: 'Region'         },
        { field: 'country', header: 'Country'        },
        { field: 'family',  header: 'Product family' },
        ...measureKeys.map((k) => ({ field: k, header: k })),
      ]

      await api.exportData({
        format: 'xlsx',
        filename: `olap-cube-${typeof activeYear === 'number' ? activeYear : 'all'}.xlsx`,
        columns: exportCols,
        rows: exportRows as never,
        // Native Excel outline groups for Region → Country. Opens in
        // Excel with the +/- buttons in the row header gutter.
        groupBy: ['region', 'country'],
      })
      exportNote = `Exported ${exportRows.length} leaf rows with Excel outline groups`
    } catch (e) {
      exportNote = e instanceof Error ? e.message : String(e)
      console.error('[olap export]', e)
    } finally {
      exporting = false
      setTimeout(() => { if (!exporting) exportNote = null }, 3500)
    }
  }
  function toggleRegion(r: Region) {
    const next = new Set(activeRegions)
    if (next.has(r)) next.delete(r); else next.add(r)
    if (next.size === 0) next.add(r)
    activeRegions = next
  }

  // ---- Filtered fact slice (drives both the cube and insights) -------
  const slice = $derived.by(() => {
    const search = countrySearch.trim().toLowerCase()
    return facts.filter((f) =>
      activeRegions.has(f.region)
      && (activeYear === 'all' || f.year === activeYear)
      && (!search || f.country.toLowerCase().includes(search))
    )
  })

  // ---- Pivot model ---------------------------------------------------
  const features = tableFeatures({})

  const ROW_FIELDS = ['region', 'country', 'family'] as const
  const ROW_FIELD_LABELS = {
    region: 'Region',
    country: 'Country',
    family: 'Product family',
  } as const

  const values: PivotValueConfig<Fact>[] = [
    { field: 'arr',       agg: 'sum', label: 'ARR' },
    { field: 'customers', agg: 'sum', label: 'Customers' },
    { field: 'nrr',       agg: 'avg', label: 'NRR' },
    { field: 'margin',    agg: 'avg', label: 'Margin' },
  ]

  const pivot = $derived(createPivotModel<typeof features, Fact>(slice, {
    rows: ROW_FIELDS as unknown as ReadonlyArray<keyof Fact & string>,
    cols: ['quarter'],
    values,
    grandTotalCol: true,
  }))

  // ---- Expansion -----------------------------------------------------
  let expanded = $state<Set<string>>(new Set())
  let didInit = false
  $effect(() => {
    if (didInit) return
    const next = new Set<string>()
    for (const r of pivot.rows) {
      if (r.__pivotKind === 'group' && r.__pivotDepth === 1) next.add(r.__pivotId)
    }
    if (next.size === 0) return
    expanded = next
    didInit = true
  })
  function toggle(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id); else next.add(id)
    expanded = next
  }
  function expandAll() {
    const next = new Set<string>()
    for (const r of pivot.rows) if (r.__pivotExpandable) next.add(r.__pivotId)
    expanded = next
  }
  function collapseAll() { expanded = new Set() }
  const visibleRows = $derived(filterCollapsedPivotRows(pivot.rows, expanded))

  // ---- Per-row ancestor chain + outline-mode draw flags ---------------
  type RowChain = ReadonlyArray<string>
  const chainForRow = $derived.by(() => {
    const byId = new Map<string, PivotRow>()
    for (const r of pivot.rows) byId.set(r.__pivotId, r)
    const out = new Map<string, RowChain>()
    for (const r of pivot.rows) {
      const chain: string[] = []
      let cur: PivotRow | undefined = r
      while (cur) {
        chain.unshift(String(cur.__pivotLabel))
        const pid: string | null = cur.__pivotParentId
        cur = pid ? byId.get(pid) : undefined
      }
      out.set(r.__pivotId, chain)
    }
    return out
  })
  const drawAt = $derived.by(() => {
    const out = new Map<string, boolean[]>()
    const prev: (string | null)[] = ROW_FIELDS.map(() => null)
    for (const r of visibleRows) {
      const chain = chainForRow.get(r.__pivotId) ?? []
      const flags: boolean[] = []
      for (let i = 0; i < ROW_FIELDS.length; i += 1) {
        const label = chain[i] ?? null
        if (viewMode === 'full' || r.__pivotKind === 'grandTotal') {
          flags[i] = true
        } else {
          flags[i] = label !== prev[i]
        }
      }
      out.set(r.__pivotId, flags)
      for (let i = 0; i < ROW_FIELDS.length; i += 1) {
        const label = chain[i] ?? null
        if (label !== prev[i]) for (let j = i; j < ROW_FIELDS.length; j += 1) prev[j] = null
        prev[i] = label
      }
    }
    return out
  })

  // ---- Heatmap per measure -------------------------------------------
  /** Min / max per measure index across all LEAF rows for color scaling. */
  const measureRanges = $derived.by(() => {
    const ranges: Record<number, { lo: number; hi: number }> = {}
    for (const r of pivot.rows) {
      if (r.__pivotKind !== 'leaf') continue
      for (const [k, v] of Object.entries(r)) {
        const m = k.match(/__m(\d+)$/)
        if (!m) continue
        const idx = Number(m[1])
        const n = Number(v)
        if (!Number.isFinite(n)) continue
        const cur = ranges[idx] ?? { lo: Infinity, hi: -Infinity }
        if (n < cur.lo) cur.lo = n
        if (n > cur.hi) cur.hi = n
        ranges[idx] = cur
      }
    }
    return ranges
  })
  function heatBucket(measureIdx: number, value: number): string {
    if (!heatmapOn) return ''
    const r = measureRanges[measureIdx]
    if (!r || r.lo === r.hi) return ''
    const t = (value - r.lo) / (r.hi - r.lo)
    if (t < 0.20) return 'heat-1'
    if (t < 0.40) return 'heat-2'
    if (t < 0.60) return 'heat-3'
    if (t < 0.80) return 'heat-4'
    return 'heat-5'
  }

  // ---- Column tree: split row-header into N dim cols -----------------
  const columns = $derived.by(() => {
    const out: ColumnDef<typeof features, PivotRow>[] = []
    for (let i = 0; i < ROW_FIELDS.length; i += 1) {
      const field = ROW_FIELDS[i]!
      out.push({
        id: `__dim_${field}`,
        header: ROW_FIELD_LABELS[field],
        width: i === 0 ? 130 : i === 1 ? 170 : 180,
        editable: false,
        cell: (ctx) => renderSnippet(DimCell, { row: ctx.row.original, level: i }),
        cellClass: (ctx) => kindClass(ctx.row.original),
      } as ColumnDef<typeof features, PivotRow>)
    }
    for (let i = 1; i < pivot.columns.length; i += 1) {
      out.push(decorate(pivot.columns[i]!) as ColumnDef<typeof features, PivotRow>)
    }
    return out
  })
  function decorate(c: ColumnDef<typeof features, PivotRow>): ColumnDef<typeof features, PivotRow> {
    if (c.columns?.length) {
      // Replace the group header (e.g. "Q1") with a snippet so we get
      // a year subline + measure-icon strip beneath the quarter.
      return {
        ...c,
        header: () => renderSnippet(QuarterHeader, {
          quarter: String(c.header ?? ''),
          year: typeof activeYear === 'number' ? activeYear : null,
        }),
        columns: c.columns.map(decorate),
      }
    }
    const id = c.id ?? ''
    const measureIdx = (() => {
      const m = id.match(/__m(\d+)$/)
      return m ? Number(m[1]) : -1
    })()
    return {
      ...c,
      width: 110,
      align: 'right',
      header: () => renderSnippet(MeasureHeader, { idx: measureIdx }),
      cell: (ctx) => renderSnippet(ValueCell, {
        row: ctx.row.original,
        id,
        measureIdx,
      }),
      cellClass: (ctx) => {
        const k = kindClass(ctx.row.original)
        const v = Number(ctx.row.original[id] ?? 0)
        return `${k} ${ctx.row.original.__pivotKind === 'leaf' ? heatBucket(measureIdx, v) : ''}`.trim()
      },
    }
  }
  function kindClass(row: PivotRow): string {
    if (row.__pivotKind === 'grandTotal') return 'pv-row-grand'
    if (row.__pivotKind === 'group')      return row.__pivotDepth === 1 ? 'pv-row-l1' : 'pv-row-l2'
    return ''
  }

  // ---- Formatters ----------------------------------------------------
  const fmtCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  function fmtMoney(n: number): string {
    if (!Number.isFinite(n)) return '-'
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (Math.abs(n) >= 1_000)     return `$${Math.round(n / 1_000)}k`
    return fmtCurrency.format(n)
  }
  function fmtNum(n: number): string { return n.toLocaleString('en-US', { maximumFractionDigits: 0 }) }
  function fmtPct(n: number): string { return `${Math.round(n * 100)}%` }
  function measureField(idx: number): 'arr' | 'customers' | 'nrr' | 'margin' | null {
    return (values[idx]?.field as 'arr'|'customers'|'nrr'|'margin') ?? null
  }
  function fmtTime(d: Date): string {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  // ---- KPI strip -----------------------------------------------------
  const kpis = $derived.by(() => {
    const totalArr  = slice.reduce((a, f) => a + f.arr, 0)
    const custs     = slice.reduce((a, f) => a + f.customers, 0)
    const nrrMean   = slice.length > 0 ? slice.reduce((a, f) => a + f.nrr, 0) / slice.length : 0
    const marginAvg = slice.length > 0 ? slice.reduce((a, f) => a + f.margin, 0) / slice.length : 0
    const avgArr    = custs > 0 ? totalArr / custs : 0
    // YoY% = current year vs prior year ARR for the same regions.
    let yoy = 0
    if (activeYear !== 'all') {
      const yr: number = activeYear
      const cur = facts.filter((f) => f.year === yr && activeRegions.has(f.region))
                       .reduce((a, f) => a + f.arr, 0)
      const prev = facts.filter((f) => f.year === yr - 1 && activeRegions.has(f.region))
                        .reduce((a, f) => a + f.arr, 0)
      yoy = prev > 0 ? (cur - prev) / prev : 0
    }
    return { totalArr, custs, nrrMean, marginAvg, avgArr, yoy }
  })

  /** QoQ trend (per quarter total of the active year) for sparkline. */
  function quarterTrend(year: number): number[] {
    return QUARTERS.map((q) =>
      facts.filter((f) => f.year === year && f.quarter === q && activeRegions.has(f.region))
           .reduce((a, f) => a + f.arr, 0),
    )
  }
  const arrTrend = $derived(typeof activeYear === 'number' ? quarterTrend(activeYear) : [])
  function sparkPath(points: number[], w = 80, h = 24): string {
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

  // ---- Insights rail: top movers, top contributors, outliers ---------
  /** Per-country ARR for the active year + previous year. */
  function arrByCountry(year: number): Record<string, number> {
    const out: Record<string, number> = {}
    for (const f of facts) {
      if (f.year !== year || !activeRegions.has(f.region)) continue
      out[f.country] = (out[f.country] ?? 0) + f.arr
    }
    return out
  }
  type Mover = { name: string; cur: number; prev: number; delta: number }
  const movers = $derived.by<Mover[]>(() => {
    if (typeof activeYear !== 'number') return []
    const cur = arrByCountry(activeYear)
    const prev = arrByCountry(activeYear - 1)
    const all: Mover[] = []
    for (const country of Object.keys(cur)) {
      const c = cur[country] ?? 0
      const p = prev[country] ?? 0
      if (p === 0) continue
      all.push({ name: country, cur: c, prev: p, delta: (c - p) / p })
    }
    return all.sort((a, b) => b.delta - a.delta)
  })
  const topGainers = $derived(movers.slice(0, 3))
  const topDroppers = $derived(movers.slice().reverse().slice(0, 2))
  const topContributors = $derived.by(() => {
    const byCountry = new Map<string, number>()
    for (const f of slice) byCountry.set(f.country, (byCountry.get(f.country) ?? 0) + f.arr)
    return Array.from(byCountry.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, arr]) => ({ name, arr }))
  })
</script>

<!-- ────────────────── PIVOT SNIPPETS ────────────────── -->

{#snippet QuarterHeader(props: { quarter: string; year: number | null })}
  <span class="cube-qhdr">
    <span class="cube-qhdr-q">{props.quarter}</span>
    {#if props.year !== null}<span class="cube-qhdr-y">{props.year}</span>{/if}
  </span>
{/snippet}

{#snippet MeasureHeader(props: { idx: number })}
  {@const f = measureField(props.idx)}
  <span class="cube-mhdr cube-mhdr-{f ?? 'unknown'}">
    {#if f === 'arr'}ARR
    {:else if f === 'customers'}Custs
    {:else if f === 'nrr'}NRR
    {:else if f === 'margin'}Margin
    {:else}?{/if}
  </span>
{/snippet}

{#snippet DimCell(props: { row: PivotRow; level: number })}
  {@const row = props.row}
  {@const flags = drawAt.get(row.__pivotId) ?? []}
  {@const chain = chainForRow.get(row.__pivotId) ?? []}
  {@const isOwnLevel = row.__pivotDepth - 1 === props.level}
  {@const isAncestorLevel = row.__pivotDepth - 1 > props.level}
  {@const isExpandable = isOwnLevel && row.__pivotExpandable}
  {@const isOpen = expanded.has(row.__pivotId)}
  {@const draw = flags[props.level]}
  {#if row.__pivotKind === 'grandTotal'}
    {#if props.level === 0}
      <span class="cube-dim cube-dim-grand">
        <span class="cube-chev-spacer"></span>
        <strong>Grand total</strong>
      </span>
    {/if}
  {:else if draw}
    <span class="cube-dim" class:cube-dim-own={isOwnLevel}>
      {#if isExpandable}
        <button
          type="button"
          class="cube-chev"
          class:open={isOpen}
          aria-label={isOpen ? 'Collapse' : 'Expand'}
          aria-expanded={isOpen}
          onclick={(e) => { e.stopPropagation(); toggle(row.__pivotId) }}
        >▸</button>
      {:else if isOwnLevel}
        <span class="cube-chev-spacer"></span>
      {/if}
      {#if isOwnLevel && row.__pivotKind === 'group'}
        <span class="cube-dim-label cube-dim-label-group">
          {#if props.level === 1}
            <span class="cube-country-dot" style={`background:${COUNTRY_TINT[chain[1] ?? ''] ?? '#94a3b8'}`} aria-hidden="true"></span>
          {/if}
          {chain[props.level]}
          <span class="cube-dim-total">Total</span>
        </span>
      {:else if isOwnLevel}
        <span class="cube-dim-label cube-dim-label-leaf">{chain[props.level]}</span>
      {:else if isAncestorLevel}
        <span class="cube-dim-label cube-dim-label-ancestor">{chain[props.level]}</span>
      {/if}
    </span>
  {/if}
{/snippet}

{#snippet ValueCell(props: { row: PivotRow; id: string; measureIdx: number })}
  {@const v = Number(props.row[props.id] ?? 0)}
  {@const f = measureField(props.measureIdx)}
  <span class="cube-val cube-val-{f ?? 'unknown'}">
    {#if !Number.isFinite(v) || v === 0}
      <span class="cube-val-empty">-</span>
    {:else if f === 'customers'}{fmtNum(v)}
    {:else if f === 'nrr' || f === 'margin'}
      <span class="cube-pct" class:good={v >= 1} class:warn={v < 1 && v >= 0.85} class:bad={v < 0.85 && f === 'nrr'}>
        {fmtPct(v)}
      </span>
    {:else}{fmtMoney(v)}{/if}
  </span>
{/snippet}

<!-- ────────────────── LAYOUT ────────────────── -->

<section class="cube-shell flex flex-1 min-h-0 flex-col gap-2" class:density-compact={density === 'compact'}>
  <header class="cube-page-head">
    <div class="cube-page-head-left">
      <div class="cube-crumbs">Analytics <span>›</span> Pivot cube <span>›</span> Revenue</div>
      <h2 class="cube-page-title">Revenue intelligence · OLAP cube</h2>
    </div>
    <div class="cube-page-head-right">
      <span class="cube-stale">
        <span class="cube-stale-dot"></span>
        Last refresh {fmtTime(lastRefresh)}
      </span>
      <button type="button" class="cube-tool" onclick={refresh}>↻ Refresh</button>
      <button
        type="button"
        class="cube-tool cube-tool-primary"
        onclick={exportXlsx}
        disabled={exporting || api === null}
        title="Export the visible cube to xlsx (Pro: api.exportData)"
      >
        {exporting ? 'Exporting…' : '⬇ Export xlsx'}
      </button>
      {#if exportNote}
        <span class="cube-export-note">{exportNote}</span>
      {/if}
    </div>
  </header>

  <!-- KPI strip -->
  <div class="cube-kpis">
    <div class="cube-kpi">
      <div class="cube-kpi-label">Total ARR</div>
      <div class="cube-kpi-value">{fmtMoney(kpis.totalArr)}</div>
      <div class="cube-kpi-foot">
        {#if typeof activeYear === 'number'}
          <svg class="cube-spark" viewBox="0 0 80 24" preserveAspectRatio="none">
            <path d={sparkPath(arrTrend)} fill="none" stroke="#6366f1" stroke-width="1.5" />
          </svg>
          <span class="cube-spark-foot">QoQ {activeYear}</span>
        {:else}
          <span>all years</span>
        {/if}
      </div>
    </div>
    <div class="cube-kpi">
      <div class="cube-kpi-label">YoY growth</div>
      <div class="cube-kpi-value cube-kpi-{kpis.yoy >= 0 ? 'up' : 'down'}">
        {kpis.yoy >= 0 ? '▲' : '▼'} {Math.round(Math.abs(kpis.yoy) * 100)}%
      </div>
      <div class="cube-kpi-foot">vs {typeof activeYear === 'number' ? activeYear - 1 : 'prior'}</div>
    </div>
    <div class="cube-kpi">
      <div class="cube-kpi-label">Customers</div>
      <div class="cube-kpi-value">{fmtNum(kpis.custs)}</div>
      <div class="cube-kpi-foot">{fmtMoney(kpis.avgArr)} avg ARR</div>
    </div>
    <div class="cube-kpi">
      <div class="cube-kpi-label">Net retention</div>
      <div class="cube-kpi-value cube-kpi-{kpis.nrrMean >= 1 ? 'up' : 'warn'}">{fmtPct(kpis.nrrMean)}</div>
      <div class="cube-kpi-foot">avg NRR across slice</div>
    </div>
    <div class="cube-kpi">
      <div class="cube-kpi-label">Gross margin</div>
      <div class="cube-kpi-value">{fmtPct(kpis.marginAvg)}</div>
      <div class="cube-kpi-foot">avg across slice</div>
    </div>
  </div>

  <!-- Three-pane workspace: slicers · cube · insights -->
  <div class="cube-workspace flex flex-1 min-h-0 gap-2">

    <!-- LEFT: slicer rail -->
    <aside class="cube-rail cube-rail-left">
      <div class="cube-rail-head">Slicers</div>

      <div class="cube-slicer">
        <div class="cube-slicer-title">Region</div>
        <div class="cube-chips">
          {#each (['AMER','EMEA','APAC'] as const) as r (r)}
            <button type="button" class="cube-chip" class:on={activeRegions.has(r)} onclick={() => toggleRegion(r)}>{r}</button>
          {/each}
        </div>
      </div>

      <div class="cube-slicer">
        <div class="cube-slicer-title">Year</div>
        <div class="cube-chips">
          <button type="button" class="cube-chip" class:on={activeYear === 'all'} onclick={() => (activeYear = 'all')}>All</button>
          {#each YEARS as y (y)}
            <button type="button" class="cube-chip" class:on={activeYear === y} onclick={() => (activeYear = y)}>{y}</button>
          {/each}
        </div>
      </div>

      <div class="cube-slicer">
        <div class="cube-slicer-title">Find country</div>
        <input class="cube-input" type="search" placeholder="e.g. Japan" bind:value={countrySearch} />
      </div>

      <div class="cube-slicer">
        <div class="cube-slicer-title">View mode</div>
        <div class="cube-seg">
          <button type="button" class:active={viewMode === 'outline'} onclick={() => (viewMode = 'outline')}>Outline</button>
          <button type="button" class:active={viewMode === 'full'}    onclick={() => (viewMode = 'full')}>Full repeat</button>
        </div>
      </div>

      <div class="cube-slicer">
        <div class="cube-slicer-title">Density</div>
        <div class="cube-seg">
          <button type="button" class:active={density === 'comfy'}    onclick={() => (density = 'comfy')}>Comfy</button>
          <button type="button" class:active={density === 'compact'}  onclick={() => (density = 'compact')}>Compact</button>
        </div>
      </div>

      <label class="cube-toggle">
        <input type="checkbox" bind:checked={heatmapOn} />
        <span>Heatmap tinting</span>
      </label>

      <div class="cube-slicer cube-slicer-tools">
        <button type="button" class="cube-link" onclick={expandAll}>Expand all</button>
        <button type="button" class="cube-link" onclick={collapseAll}>Collapse all</button>
      </div>
    </aside>

    <!-- CENTER: pivot cube -->
    <div class="cube-card flex-1 min-w-0">
      <div class="cube-card-head">
        <div class="cube-card-titles">
          <span class="cube-card-eyebrow">Pivot cube</span>
          <h3 class="cube-card-title">Region · Country · Product family<span class="cube-by"> by </span>Quarter</h3>
        </div>
        <div class="cube-card-meta">
          <span class="cube-card-pill">{visibleRows.length} visible</span>
          <span class="cube-card-pill">{slice.length.toLocaleString()} facts</span>
          <span class="cube-card-pill">{values.length} measures</span>
        </div>
      </div>
      <div class="cube-grid-wrap">
        <SvGrid
          data={visibleRows}
          {columns}
          {features}
          showRowSelection={false}
          showPagination={false}
          enableInlineEditing={false}
          enableCellSelection={false}
          rowHeight={density === 'compact' ? 28 : 34}
          containerHeight="100%"
          fitColumns={false}
          enableRowSummaries={false}
          onApiReady={onApiReady}
        />
      </div>
    </div>

    <!-- RIGHT: insights rail -->
    <aside class="cube-rail cube-rail-right">
      <div class="cube-rail-head">Insights</div>

      <div class="cube-insight">
        <div class="cube-insight-title">Top movers · YoY</div>
        {#if typeof activeYear !== 'number'}
          <p class="cube-insight-muted">Pick a year in the left rail to see YoY movers.</p>
        {:else if movers.length === 0}
          <p class="cube-insight-muted">No YoY signal in this slice.</p>
        {:else}
          <div class="cube-mover-list">
            {#each topGainers as m (m.name)}
              <div class="cube-mover">
                <span class="cube-mover-arrow up">▲</span>
                <span class="cube-mover-name">{m.name}</span>
                <span class="cube-mover-pct up">+{Math.round(m.delta * 100)}%</span>
              </div>
            {/each}
            {#if topDroppers.length > 0}
              <div class="cube-mover-sep" aria-hidden="true"></div>
              {#each topDroppers as m (m.name)}
                {#if m.delta < 0}
                  <div class="cube-mover">
                    <span class="cube-mover-arrow down">▼</span>
                    <span class="cube-mover-name">{m.name}</span>
                    <span class="cube-mover-pct down">{Math.round(m.delta * 100)}%</span>
                  </div>
                {/if}
              {/each}
            {/if}
          </div>
        {/if}
      </div>

      <div class="cube-insight">
        <div class="cube-insight-title">Top contributors</div>
        <ol class="cube-rank">
          {#each topContributors as c, i (c.name)}
            <li>
              <span class="cube-rank-pos">{i + 1}</span>
              <span class="cube-country-dot small" style={`background:${COUNTRY_TINT[c.name] ?? '#94a3b8'}`} aria-hidden="true"></span>
              <span class="cube-rank-name">{c.name}</span>
              <span class="cube-rank-val">{fmtMoney(c.arr)}</span>
            </li>
          {/each}
        </ol>
      </div>

      <div class="cube-insight">
        <div class="cube-insight-title">Notes</div>
        <p class="cube-note">
          Heatmap tinting compares the cell against the min / max across every
          LEAF row in the cube. Subtotal + grand-total rows are excluded so the
          color scale tracks signal, not aggregation magnitude.
        </p>
      </div>
    </aside>
  </div>
</section>

<style>
  /* Layout shell */
  .cube-shell { min-height: 0; }
  .cube-page-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-shrink: 0;
  }
  .cube-crumbs { font-size: 11px; color: var(--sg-muted, #64748b); }
  .cube-crumbs span { opacity: 0.5; margin: 0 4px; }
  .cube-page-title { font-size: 18px; font-weight: 800; margin: 2px 0 0; letter-spacing: -0.01em; }
  .cube-page-head-right { display: flex; align-items: center; gap: 8px; }
  .cube-stale {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 11.5px; color: var(--sg-muted, #64748b);
  }
  .cube-stale-dot {
    width: 7px; height: 7px; border-radius: 999px;
    background: #22c55e;
    box-shadow: 0 0 0 3px rgba(34,197,94,0.18);
  }
  .cube-tool {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    padding: 4px 10px; border-radius: 5px;
    font-size: 12px; cursor: pointer;
  }
  .cube-tool:hover { background: var(--sg-header-bg, #f1f5f9); }
  .cube-tool-primary {
    background: var(--sg-accent, #2563eb);
    border-color: var(--sg-accent, #2563eb);
    color: #fff; font-weight: 600;
  }
  .cube-tool-primary:hover { filter: brightness(1.07); background: var(--sg-accent, #2563eb); }
  .cube-tool:disabled { opacity: 0.5; cursor: default; }
  .cube-export-note {
    font-size: 11.5px;
    color: #16a34a;
    font-weight: 600;
  }
  :global([data-theme='dark']) .cube-export-note { color: #4ade80; }

  /* KPI strip */
  .cube-kpis {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
    flex-shrink: 0;
  }
  .cube-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 10px 12px;
  }
  .cube-kpi-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sg-muted, #64748b); }
  .cube-kpi-value { font-size: 19px; font-weight: 800; margin-top: 4px; font-variant-numeric: tabular-nums; line-height: 1.1; }
  .cube-kpi-foot {
    margin-top: 4px;
    display: flex; align-items: center; gap: 6px;
    font-size: 10.5px; color: var(--sg-muted, #64748b);
  }
  .cube-spark { width: 80px; height: 24px; }
  .cube-spark-foot { letter-spacing: 0.04em; }
  .cube-kpi-up   { color: #16a34a; }
  .cube-kpi-down { color: #dc2626; }
  .cube-kpi-warn { color: #b45309; }
  :global([data-theme='dark']) .cube-kpi-up   { color: #4ade80; }
  :global([data-theme='dark']) .cube-kpi-down { color: #f87171; }
  :global([data-theme='dark']) .cube-kpi-warn { color: #fcd34d; }

  /* Workspace columns */
  .cube-workspace { min-height: 0; }
  .cube-rail {
    width: 220px;
    flex-shrink: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    padding: 10px 12px;
    overflow: auto;
    display: flex; flex-direction: column; gap: 12px;
  }
  .cube-rail-right { width: 260px; }
  .cube-rail-head {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b); font-weight: 700;
  }

  /* Slicers */
  .cube-slicer-title { font-size: 11px; font-weight: 700; color: var(--sg-fg, #1e293b); margin-bottom: 4px; }
  .cube-chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .cube-chip {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    padding: 3px 9px; border-radius: 999px;
    font-size: 11px; cursor: pointer;
  }
  .cube-chip.on {
    background: var(--sg-accent, #2563eb);
    border-color: var(--sg-accent, #2563eb);
    color: #fff;
  }
  .cube-input {
    width: 100%;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    border-radius: 5px;
    padding: 5px 8px;
    font-size: 12px;
  }
  .cube-seg {
    display: inline-flex;
    border: 1px solid var(--sg-border, #cbd5e1);
    border-radius: 5px; overflow: hidden;
    width: 100%;
  }
  .cube-seg button {
    flex: 1;
    border: 0; background: transparent;
    padding: 4px 8px; font-size: 11px;
    cursor: pointer; color: var(--sg-fg, #1e293b);
  }
  .cube-seg button.active { background: var(--sg-accent, #2563eb); color: #fff; font-weight: 700; }
  .cube-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; }
  .cube-slicer-tools { display: flex; gap: 8px; }
  .cube-link {
    border: 0; background: transparent;
    color: var(--sg-accent, #2563eb);
    font-size: 11.5px; padding: 0; cursor: pointer;
    text-decoration: underline;
  }

  /* Cube card */
  .cube-card {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .cube-card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(135deg, rgba(99,102,241,0.06), rgba(14,165,233,0.04));
  }
  :global([data-theme='dark']) .cube-card-head {
    background: linear-gradient(135deg, rgba(99,102,241,0.18), rgba(14,165,233,0.10));
  }
  .cube-card-eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sg-muted, #64748b); font-weight: 700; }
  .cube-card-title { margin: 2px 0 0; font-size: 14px; font-weight: 700; }
  .cube-by { color: var(--sg-muted, #64748b); font-weight: 500; }
  .cube-card-meta { display: flex; gap: 4px; flex-wrap: wrap; }
  .cube-card-pill {
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 10.5px;
    color: var(--sg-muted, #64748b);
    font-variant-numeric: tabular-nums;
  }
  .cube-grid-wrap { flex: 1; min-height: 0; }

  /* Insights rail */
  .cube-insight {
    background: var(--sg-header-bg, #f8fafc);
    border-radius: 8px;
    padding: 8px 10px;
  }
  :global([data-theme='dark']) .cube-insight { background: rgba(148,163,184,0.10); }
  .cube-insight-title { font-size: 10.5px; font-weight: 700; color: var(--sg-fg, #1e293b); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
  .cube-insight-muted { font-size: 11.5px; color: var(--sg-muted, #64748b); margin: 0; }
  .cube-mover-list { display: flex; flex-direction: column; gap: 4px; }
  .cube-mover {
    display: grid; grid-template-columns: 14px 1fr auto;
    align-items: center; gap: 6px; font-size: 12px;
  }
  .cube-mover-arrow { font-size: 10px; }
  .cube-mover-arrow.up { color: #16a34a; }
  .cube-mover-arrow.down { color: #dc2626; }
  .cube-mover-name { font-weight: 600; }
  .cube-mover-pct.up { color: #16a34a; font-variant-numeric: tabular-nums; }
  .cube-mover-pct.down { color: #dc2626; font-variant-numeric: tabular-nums; }
  .cube-mover-sep { height: 1px; background: var(--sg-border, #e2e8f0); margin: 4px 0; }
  .cube-rank { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
  .cube-rank li {
    display: grid; grid-template-columns: 16px 10px 1fr auto; gap: 6px;
    align-items: center; font-size: 12px;
  }
  .cube-rank-pos { color: var(--sg-muted, #64748b); font-weight: 700; font-variant-numeric: tabular-nums; }
  .cube-rank-name { font-weight: 600; }
  .cube-rank-val  { font-variant-numeric: tabular-nums; color: var(--sg-muted, #64748b); }
  .cube-note { font-size: 11px; color: var(--sg-muted, #64748b); margin: 0; line-height: 1.4; }

  /* OLAP dim cells */
  :global(.cube-dim) {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12.5px;
    white-space: nowrap;
  }
  :global(.cube-dim-own) { color: var(--sg-fg, #1e293b); }
  :global(.cube-dim-grand) { font-weight: 800; color: var(--sg-accent, #2563eb); }
  :global(.cube-dim-label-group) { font-weight: 700; }
  :global(.cube-dim-label-leaf)  { font-weight: 500; }
  :global(.cube-dim-label-ancestor) {
    color: var(--sg-muted, #64748b);
    font-style: italic; font-weight: 400;
  }
  :global(.cube-dim-total) {
    display: inline-block;
    margin-left: 4px; padding: 1px 6px;
    border-radius: 999px;
    background: rgba(14, 165, 233, 0.18);
    color: #0369a1;
    font-size: 10px; font-weight: 700;
    letter-spacing: 0.04em; text-transform: uppercase;
  }
  :global([data-theme='dark']) :global(.cube-dim-total) { color: #7dd3fc; }
  :global(.cube-country-dot) {
    width: 9px; height: 9px; border-radius: 999px; flex-shrink: 0;
    box-shadow: 0 0 0 2px rgba(15,23,42,0.06);
  }
  :global(.cube-country-dot.small) { width: 8px; height: 8px; }

  :global(.cube-chev) {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px;
    border: 0; background: transparent; padding: 0;
    color: var(--sg-muted, #64748b);
    cursor: pointer; border-radius: 3px;
    font-size: 13px; line-height: 1;
    transition: transform 120ms ease, background 120ms ease;
    flex-shrink: 0;
  }
  :global(.cube-chev:hover) { background: rgba(148,163,184,0.18); color: var(--sg-fg, #1e293b); }
  :global(.cube-chev.open)  { transform: rotate(90deg); }
  :global(.cube-chev-spacer) { display: inline-block; width: 18px; height: 18px; flex-shrink: 0; }

  /* Headers + values */
  :global(.cube-qhdr)   { display: inline-flex; flex-direction: column; line-height: 1.1; }
  :global(.cube-qhdr-q) { font-weight: 700; font-size: 12px; }
  :global(.cube-qhdr-y) { font-size: 10px; color: var(--sg-muted, #64748b); letter-spacing: 0.04em; }
  :global(.cube-mhdr) {
    font-size: 10.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.03em;
  }
  :global(.cube-mhdr-arr)       { color: #2563eb; }
  :global(.cube-mhdr-customers) { color: #0d9488; }
  :global(.cube-mhdr-nrr)       { color: #db2777; }
  :global(.cube-mhdr-margin)    { color: #b45309; }
  :global([data-theme='dark']) :global(.cube-mhdr-arr)       { color: #93c5fd; }
  :global([data-theme='dark']) :global(.cube-mhdr-customers) { color: #5eead4; }
  :global([data-theme='dark']) :global(.cube-mhdr-nrr)       { color: #f9a8d4; }
  :global([data-theme='dark']) :global(.cube-mhdr-margin)    { color: #fcd34d; }

  :global(.cube-val) { font-variant-numeric: tabular-nums; font-size: 12.5px; }
  :global(.cube-val-empty) { color: var(--sg-muted, #94a3b8); opacity: 0.5; }
  :global(.cube-pct.good) { color: #16a34a; font-weight: 700; }
  :global(.cube-pct.warn) { color: #b45309; font-weight: 700; }
  :global(.cube-pct.bad)  { color: #dc2626; font-weight: 700; }
  :global([data-theme='dark']) :global(.cube-pct.good) { color: #4ade80; }
  :global([data-theme='dark']) :global(.cube-pct.warn) { color: #fcd34d; }
  :global([data-theme='dark']) :global(.cube-pct.bad)  { color: #f87171; }

  /* Row level tints */
  :global(.pv-row-l1) {
    background: rgba(99,102,241,0.09) !important;
    font-weight: 700;
  }
  :global(.pv-row-l2) {
    background: rgba(14,165,233,0.06) !important;
    font-weight: 600;
  }
  :global(.pv-row-grand) {
    background: rgba(99,102,241,0.22) !important;
    font-weight: 800;
    color: var(--sg-accent, #2563eb);
  }

  /* Heatmap tint buckets - layered ABOVE the row tint */
  :global(.heat-1) { box-shadow: inset 4px 0 0 rgba(56,189,248,0.55); }
  :global(.heat-2) { box-shadow: inset 4px 0 0 rgba(96,165,250,0.65); }
  :global(.heat-3) { box-shadow: inset 4px 0 0 rgba(168,85,247,0.65); }
  :global(.heat-4) { box-shadow: inset 4px 0 0 rgba(236,72,153,0.70); background: rgba(236,72,153,0.05) !important; }
  :global(.heat-5) { box-shadow: inset 4px 0 0 rgba(239,68,68,0.85); background: rgba(239,68,68,0.10) !important; }

  /* Compact density */
  .density-compact :global(.cube-val),
  .density-compact :global(.cube-dim) { font-size: 11.5px; }
  .density-compact :global(.cube-mhdr) { font-size: 10px; }
</style>
