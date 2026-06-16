<script lang="ts">
  /**
   * 121. Pivot - Conditional cells + custom header rendering (Pro)
   * --------------------------------------------------------------
   * Showcase of what the new function-valued `header` and `cell`
   * templates buy you on top of `createPivotModel`:
   *
   *   - Custom **value cell** renderers: traffic-light pills for revenue
   *     vs target, data-bars for units, signed arrows for variance %.
   *     The renderer reads the leaf's measure id off the column id and
   *     picks the right visual.
   *   - Custom **header cell** renderers: measure icon + units label,
   *     "click to sort" affordance, target-line annotation under each
   *     quarter.
   *   - Custom **row-header cell** with a colored dimension chip
   *     (region tint), depth-based indent, and chevron expand/collapse.
   *
   * The pivot engine is unchanged - this demo is purely about styling
   * the cells/headers the engine emits via the new function templates.
   */
  import {
    SvGrid,
    tableFeatures,
    renderSnippet,
    type ColumnDef,
  } from 'sv-grid-core'
  import {
    createPivotModel,
    filterCollapsedPivotRows,
    setLicenseKey,
    type PivotRow,
    type PivotValueConfig,
  } from 'sv-grid-pro'

  setLicenseKey('SVPRO-DEV-DEMO')

  // ---- Source facts ---------------------------------------------------
  type Region = 'AMER' | 'EMEA' | 'APAC'
  type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'
  type Fact = {
    region: Region
    country: string
    quarter: Quarter
    revenue: number
    target: number
    units: number
  }
  const COUNTRIES: Record<Region, string[]> = {
    AMER: ['USA', 'Canada', 'Brazil', 'Mexico'],
    EMEA: ['Germany', 'UK', 'France', 'Sweden'],
    APAC: ['Japan', 'India', 'Australia', 'Korea'],
  }
  const REGION_TINT: Record<Region, string> = {
    AMER: '#6366f1',
    EMEA: '#0ea5e9',
    APAC: '#10b981',
  }
  let prng = 0xC0FFEE17
  function rnd(): number { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }

  function seed(): Fact[] {
    const out: Fact[] = []
    for (const region of Object.keys(COUNTRIES) as Region[]) {
      for (const country of COUNTRIES[region]) {
        for (const quarter of ['Q1','Q2','Q3','Q4'] as Quarter[]) {
          const base = 40_000 + Math.floor(rnd() * 220_000)
          const variance = 0.65 + rnd() * 0.75
          out.push({
            region, country, quarter,
            revenue: Math.round(base * variance),
            target: base,
            units: 60 + Math.floor(rnd() * 940),
          })
        }
      }
    }
    return out
  }
  const facts = seed()

  // ---- Pivot model -----------------------------------------------------
  const features = tableFeatures({})
  const values: PivotValueConfig<Fact>[] = [
    { field: 'revenue', agg: 'sum', label: 'Revenue' },
    { field: 'target',  agg: 'sum', label: 'Target'  },
    { field: 'units',   agg: 'sum', label: 'Units'   },
  ]
  const pivot = $derived(createPivotModel<typeof features, Fact>(facts, {
    rows: ['region', 'country'],
    cols: ['quarter'],
    values,
    grandTotalCol: false,
  }))

  function findRegionLabel(parentId: string | null): Region | null {
    // Walk up to the top-most ancestor; that's the region (chain[0]).
    if (!parentId) return null
    let cur: PivotRow | undefined = pivot.rows.find((r) => r.__pivotId === parentId)
    while (cur) {
      const pid: string | null = cur.__pivotParentId
      if (!pid) {
        return cur.__pivotKind === 'group' ? (cur.__pivotLabel as Region) : null
      }
      cur = pivot.rows.find((r) => r.__pivotId === pid)
    }
    return null
  }

  // Expand all regions by default.
  let expanded = $state<Set<string>>(new Set())
  let didInit = false
  $effect(() => {
    if (didInit) return
    // Top-level groups have __pivotParentId === null. (Depth is 1-based
     // because the engine counts the synthetic root as level 0.)
    const regionIds = pivot.rows.filter((r) => r.__pivotKind === 'group' && r.__pivotParentId === null)
                                .map((r) => r.__pivotId)
    if (regionIds.length === 0) return
    expanded = new Set(regionIds)
    didInit = true
  })
  function toggle(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id); else next.add(id)
    expanded = next
  }
  const visibleRows = $derived(filterCollapsedPivotRows(pivot.rows, expanded))

  // ---- Cell value helpers ---------------------------------------------
  /** Measure index off the column id: `pv__Q1__m0` -> 0 */
  function measureIdx(colId: string): number {
    const m = colId.match(/__m(\d+)$/)
    return m ? Number(m[1]) : -1
  }
  function measureField(colId: string): 'revenue' | 'target' | 'units' | null {
    const i = measureIdx(colId)
    return i >= 0 ? (values[i]?.field as 'revenue' | 'target' | 'units' ?? null) : null
  }
  function quarterOf(colId: string): Quarter | null {
    const m = colId.match(/^pv__([^_]+)__m\d+$/)
    return m ? (m[1] as Quarter) : null
  }
  /** Look up the same-row Target cell for a Revenue cell in the same quarter. */
  function targetFor(row: PivotRow, q: Quarter | null): number {
    if (!q) return 0
    const idx = values.findIndex((v) => v.field === 'target')
    if (idx < 0) return 0
    const key = `pv__${q}__m${idx}`
    return Number(row[key] ?? 0)
  }
  /** Max units across the visible leaves (for data-bar normalization). */
  const maxUnits = $derived.by(() => {
    let m = 0
    for (const r of pivot.rows) {
      if (r.__pivotKind !== 'leaf') continue
      for (const k of Object.keys(r)) {
        if (!k.startsWith('pv__')) continue
        if (measureField(k) !== 'units') continue
        const n = Number(r[k])
        if (n > m) m = n
      }
    }
    return Math.max(1, m)
  })

  function fmtMoneyK(n: number): string {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (Math.abs(n) >= 1_000)     return `$${Math.round(n / 1_000)}k`
    return `$${Math.round(n)}`
  }

  // ---- Sorting (on the row-header column) -----------------------------
  type SortDir = 'asc' | 'desc' | null
  let labelSort = $state<SortDir>(null)
  function cycleLabelSort() {
    labelSort = labelSort === null ? 'asc' : labelSort === 'asc' ? 'desc' : null
  }

  const sortedVisible = $derived.by(() => {
    if (!labelSort) return visibleRows
    // Group sorting: order siblings by their label within each parent.
    const parentOf = new Map<string, string | null>()
    for (const r of visibleRows) parentOf.set(r.__pivotId, r.__pivotParentId)
    const childrenOf = new Map<string | null, PivotRow[]>()
    for (const r of visibleRows) {
      const list = childrenOf.get(r.__pivotParentId) ?? []
      list.push(r); childrenOf.set(r.__pivotParentId, list)
    }
    const dir = labelSort
    const cmp = (a: PivotRow, b: PivotRow) => {
      const x = String(a.__pivotLabel).localeCompare(String(b.__pivotLabel))
      return dir === 'desc' ? -x : x
    }
    const out: PivotRow[] = []
    function emit(pid: string | null) {
      const kids = (childrenOf.get(pid) ?? []).slice().sort(cmp)
      for (const k of kids) { out.push(k); emit(k.__pivotId) }
    }
    emit(null)
    return out
  })

  // ---- Column tree with custom headers + conditional cells ------------
  const columns = $derived(pivot.columns.map((c, i) => {
    if (i === 0) {
      return {
        ...c,
        width: 280,
        header: () => renderSnippet(RowHeaderCell, {}),
        cell: (ctx) => renderSnippet(LabelCell, { row: ctx.row.original }),
      } as ColumnDef<typeof features, PivotRow>
    }
    // The engine emits one group per quarter and three leaves per group.
    // Decorate both: the quarter group gets a header snippet, the leaf
    // columns get a value snippet that branches on measure.
    if (c.columns?.length) {
      const q = (c.id ?? '').replace(/^pv__|__group$/g, '') as Quarter
      return {
        ...c,
        header: () => renderSnippet(QuarterHeader, { quarter: q }),
        columns: c.columns.map((leaf) => {
          const leafId = leaf.id ?? ''
          const field = measureField(leafId)
          return {
            ...leaf,
            width: field === 'units' ? 130 : 140,
            header: () => renderSnippet(MeasureHeader, { field }),
            cell: (ctx) => renderSnippet(ValueCell, {
              row: ctx.row.original,
              colId: leafId,
              field,
            }),
          } as ColumnDef<typeof features, PivotRow>
        }),
      } as ColumnDef<typeof features, PivotRow>
    }
    return c as ColumnDef<typeof features, PivotRow>
  }))
</script>

{#snippet RowHeaderCell()}
  <span class="pv-rowhdr">
    <span class="pv-rowhdr-label">Region / Country</span>
    <button
      type="button"
      class="pv-rowhdr-sort"
      class:asc={labelSort === 'asc'}
      class:desc={labelSort === 'desc'}
      onclick={cycleLabelSort}
      title="Click to sort row labels"
      aria-label="Sort row labels"
    >
      {labelSort === 'asc' ? '↑' : labelSort === 'desc' ? '↓' : '↕'}
    </button>
  </span>
{/snippet}

{#snippet QuarterHeader(props: { quarter: Quarter })}
  <span class="pv-qhdr">
    <span class="pv-qhdr-q">{props.quarter}</span>
    <span class="pv-qhdr-yr">2026</span>
  </span>
{/snippet}

{#snippet MeasureHeader(props: { field: 'revenue' | 'target' | 'units' | null })}
  {@const f = props.field}
  <span class="pv-mhdr pv-mhdr-{f ?? 'unknown'}">
    {#if f === 'revenue'}
      <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" fill="currentColor"><path d="M8 2v12M5 4h4.5a2 2 0 0 1 0 4H6a2 2 0 0 0 0 4h5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>
      <span>Revenue</span>
    {:else if f === 'target'}
      <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r="0.8" fill="currentColor"/></svg>
      <span>Target</span>
    {:else if f === 'units'}
      <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="9" width="2.5" height="5"/><rect x="6.75" y="6" width="2.5" height="8"/><rect x="11.5" y="3" width="2.5" height="11"/></svg>
      <span>Units</span>
    {:else}
      <span>?</span>
    {/if}
  </span>
{/snippet}

{#snippet LabelCell(props: { row: PivotRow })}
  {@const row = props.row}
  {@const isOpen = expanded.has(row.__pivotId)}
  {@const region = (row.__pivotKind === 'group' && row.__pivotParentId === null)
                    ? (row.__pivotLabel as Region)
                  : row.__pivotKind === 'leaf'
                    ? findRegionLabel(row.__pivotParentId)
                  : null}
  <span class="pv-label" class:pv-label-grand={row.__pivotKind === 'grandTotal'}
        style={`padding-left: ${Math.max(0, row.__pivotDepth - 1) * 14 + 6}px`}>
    {#if row.__pivotExpandable}
      <button
        type="button"
        class="pv-chev"
        class:open={isOpen}
        onclick={() => toggle(row.__pivotId)}
        aria-label={isOpen ? 'Collapse' : 'Expand'}
      >▸</button>
    {:else}
      <span class="pv-chev-spacer"></span>
    {/if}
    {#if region}
      <span class="pv-region-dot" style={`background:${REGION_TINT[region]}`} aria-hidden="true"></span>
    {/if}
    {#if row.__pivotKind === 'grandTotal'}
      <span class="pv-label-text pv-label-grand-text">Grand total</span>
    {:else}
      <span class="pv-label-text" class:pv-label-group={row.__pivotKind === 'group'}>{row.__pivotLabel}</span>
    {/if}
  </span>
{/snippet}

{#snippet ValueCell(props: { row: PivotRow; colId: string; field: 'revenue'|'target'|'units'|null })}
  {@const row = props.row}
  {@const field = props.field}
  {@const v = Number(row[props.colId] ?? 0)}
  {@const q = quarterOf(props.colId)}
  {#if field === 'revenue'}
    {@const tgt = targetFor(row, q)}
    {@const ratio = tgt > 0 ? v / tgt : 1}
    {@const tone = ratio >= 1 ? 'good' : ratio >= 0.9 ? 'warn' : 'bad'}
    <span class="pv-cell pv-cell-rev tone-{tone}">
      <span class="pv-pill tone-{tone}">{fmtMoneyK(v)}</span>
      <span class="pv-pct">{Math.round(ratio * 100)}%</span>
    </span>
  {:else if field === 'target'}
    <span class="pv-cell pv-cell-tgt">
      <span class="pv-tgt-text">{fmtMoneyK(v)}</span>
    </span>
  {:else if field === 'units'}
    {@const pct = (v / maxUnits) * 100}
    <span class="pv-cell pv-cell-units">
      <span class="pv-units-num">{v.toLocaleString('en-US')}</span>
      <span class="pv-bar"><span class="pv-bar-fill" style={`width:${pct.toFixed(1)}%`}></span></span>
    </span>
  {:else}
    <span class="pv-cell">{v}</span>
  {/if}
{/snippet}

<section class="flex flex-1 min-h-0 flex-col gap-3">
  <header class="pv121-header">
    <h2>Pivot - Conditional cells + custom headers</h2>
    <p>
      The grid table is the same <code>createPivotModel</code> output as demo 52.
      Everything below the headers is plain SvGrid <code>cell</code> / <code>header</code>
      snippets reading the engine's column ids and switching on measure.
    </p>
  </header>

  <div class="pv121-legend">
    <span class="pv-pill tone-good">≥ target</span>
    <span class="pv-pill tone-warn">90-99% target</span>
    <span class="pv-pill tone-bad">&lt; 90% target</span>
    <span class="pv-legend-sep">·</span>
    <span class="pv-legend-bar"><span class="pv-bar"><span class="pv-bar-fill" style="width:65%"></span></span> units share</span>
  </div>

  <div class="pv121-wrap flex-1 min-h-0">
    <SvGrid
      data={sortedVisible}
      {columns}
      {features}
      showRowSelection={false}
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={false}
    />
  </div>
</section>

<style>
  .pv121-header h2 { font-size: 16px; font-weight: 700; margin: 0; }
  .pv121-header p  { font-size: 12.5px; color: var(--sg-muted, #64748b); margin: 4px 0 0; max-width: 70ch; }
  .pv121-header code {
    background: var(--sg-header-bg, #f1f5f9);
    padding: 1px 4px;
    border-radius: 3px;
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 12px;
  }

  .pv121-legend {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
  }
  .pv-legend-sep { opacity: 0.5; }
  .pv-legend-bar { display: inline-flex; align-items: center; gap: 6px; }

  .pv121-wrap {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }

  /* Row header */
  :global(.pv-rowhdr) {
    display: inline-flex; align-items: center; gap: 6px; width: 100%;
  }
  :global(.pv-rowhdr-label) { font-weight: 700; }
  :global(.pv-rowhdr-sort) {
    margin-left: auto;
    border: 0; background: transparent; cursor: pointer;
    color: var(--sg-muted, #64748b); font-size: 13px; line-height: 1;
    padding: 2px 6px; border-radius: 4px;
  }
  :global(.pv-rowhdr-sort:hover) { background: rgba(99,102,241,0.12); color: var(--sg-fg, #1e293b); }
  :global(.pv-rowhdr-sort.asc),
  :global(.pv-rowhdr-sort.desc) { color: var(--sg-accent, #2563eb); font-weight: 700; }

  /* Quarter header */
  :global(.pv-qhdr) { display: inline-flex; flex-direction: column; line-height: 1.1; }
  :global(.pv-qhdr-q)  { font-weight: 700; font-size: 12.5px; }
  :global(.pv-qhdr-yr) { font-size: 10px; color: var(--sg-muted, #64748b); letter-spacing: 0.04em; }

  /* Measure header */
  :global(.pv-mhdr) {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.02em;
  }
  :global(.pv-mhdr-revenue) { color: #2563eb; }
  :global(.pv-mhdr-target)  { color: #94a3b8; }
  :global(.pv-mhdr-units)   { color: #0d9488; }
  :global([data-theme='dark']) :global(.pv-mhdr-revenue) { color: #93c5fd; }
  :global([data-theme='dark']) :global(.pv-mhdr-target)  { color: #cbd5e1; }
  :global([data-theme='dark']) :global(.pv-mhdr-units)   { color: #5eead4; }

  /* Row label */
  :global(.pv-label) { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; }
  :global(.pv-label-text) { line-height: 1.2; }
  :global(.pv-label-group) { font-weight: 700; }
  :global(.pv-label-grand-text) { font-weight: 700; color: var(--sg-accent, #2563eb); }
  :global(.pv-region-dot) {
    width: 9px; height: 9px; border-radius: 999px;
    flex-shrink: 0;
    box-shadow: 0 0 0 2px rgba(15,23,42,0.06);
  }
  :global(.pv-chev) {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px;
    border: 0; background: transparent; padding: 0;
    color: var(--sg-muted, #64748b); cursor: pointer; border-radius: 3px;
    font-size: 13px; line-height: 1;
    transition: transform 120ms ease, background 120ms ease;
  }
  :global(.pv-chev:hover) { background: rgba(148,163,184,0.18); }
  :global(.pv-chev.open) { transform: rotate(90deg); }
  :global(.pv-chev-spacer) { display: inline-block; width: 18px; height: 18px; flex-shrink: 0; }

  /* Value cells */
  :global(.pv-cell) {
    display: inline-flex; align-items: center; gap: 8px; width: 100%;
    font-variant-numeric: tabular-nums; font-size: 12.5px;
  }
  :global(.pv-cell-rev) { justify-content: flex-end; }
  :global(.pv-pill) {
    display: inline-flex; align-items: center;
    padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;
    line-height: 1.4;
  }
  :global(.pv-pill.tone-good) { background: rgba(34,197,94,0.18);  color: #15803d; }
  :global(.pv-pill.tone-warn) { background: rgba(245,158,11,0.20); color: #b45309; }
  :global(.pv-pill.tone-bad)  { background: rgba(239,68,68,0.18);  color: #b91c1c; }
  :global([data-theme='dark']) :global(.pv-pill.tone-good) { color: #86efac; }
  :global([data-theme='dark']) :global(.pv-pill.tone-warn) { color: #fcd34d; }
  :global([data-theme='dark']) :global(.pv-pill.tone-bad)  { color: #fca5a5; }
  :global(.pv-pct)        { font-size: 10.5px; color: var(--sg-muted, #64748b); min-width: 36px; text-align: right; }
  :global(.pv-tgt-text)   { color: var(--sg-muted, #64748b); margin-left: auto; }
  :global(.pv-units-num)  { min-width: 44px; text-align: right; }
  :global(.pv-bar) {
    flex: 1;
    height: 6px; border-radius: 999px; background: rgba(148,163,184,0.20);
    overflow: hidden; max-width: 70px;
  }
  :global(.pv-bar-fill) {
    display: block; height: 100%;
    background: linear-gradient(90deg, #0d9488, #14b8a6);
  }
</style>
