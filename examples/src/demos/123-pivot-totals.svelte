<script lang="ts">
  /**
   * 123. Pivot - Totals / Subtotals / Grand totals (Pro)
   * ----------------------------------------------------
   * `createPivotModel` emits three kinds of rollup rows:
   *
   *   - **Subtotal rows** - one per row-axis group (region subtotal,
   *     country subtotal). Toggle with the `rowSubtotals` config flag,
   *     and expand / collapse with the chevron in the row header.
   *   - **Grand-total row** - the bottom-most row, "total of everything".
   *     Toggle with `grandTotalRow`.
   *   - **Grand-total column** - a right-most column with the "total of
   *     this row across every column". Toggle with `grandTotalCol`.
   *
   * This demo lets you flip each toggle independently and watch the
   * pivot reshape. The legend on the right keeps the colour-coding in
   * sync with what's on screen.
   */
  import {
    SvGrid,
    tableFeatures,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'
  import {
    createPivotModel,
    filterCollapsedPivotRows,
    setLicenseKey,
    type PivotRow,
  } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-DEMO')

  // ---- Source data ----------------------------------------------------
  type Region = 'AMER' | 'EMEA' | 'APAC'
  type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'
  type Fact = {
    region: Region
    country: string
    quarter: Quarter
    year: number
    revenue: number
    units: number
  }
  const TOPO: Record<Region, string[]> = {
    AMER: ['USA', 'Canada', 'Mexico'],
    EMEA: ['Germany', 'UK', 'France'],
    APAC: ['Japan', 'India', 'Australia'],
  }
  let prng = 0xAB1E07A1
  function rnd(): number { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 0xFFFFFFFF }
  function seed(): Fact[] {
    const out: Fact[] = []
    for (const region of Object.keys(TOPO) as Region[]) {
      for (const country of TOPO[region]) {
        for (const year of [2025, 2026]) {
          for (const q of ['Q1','Q2','Q3','Q4'] as Quarter[]) {
            // Several facts per (country × year × quarter)
            for (let i = 0; i < 8; i += 1) {
              out.push({
                region, country, quarter: q, year,
                revenue: Math.round(1500 + rnd() * 22_000),
                units:   1 + Math.floor(rnd() * 60),
              })
            }
          }
        }
      }
    }
    return out
  }
  const facts = seed()

  // ---- Toggle state ---------------------------------------------------
  let showGrandRow  = $state(true)
  let showGrandCol  = $state(true)
  let showSubtotals = $state(true)
  let measure       = $state<'revenue' | 'units'>('revenue')

  // ---- Pivot model ----------------------------------------------------
  const features = tableFeatures({})
  const pivot = $derived(createPivotModel<typeof features, Fact>(facts, {
    rows: ['region', 'country'],
    cols: ['year', 'quarter'],
    values: [
      { field: measure, agg: 'sum',
        label: measure === 'revenue' ? 'Revenue' : 'Units' },
    ],
    grandTotalRow: showGrandRow,
    grandTotalCol: showGrandCol,
    rowSubtotals: showSubtotals,
  }))

  // Expansion - default everything expanded.
  let collapsed = $state<Set<string>>(new Set())
  function toggle(id: string) {
    const next = new Set(collapsed)
    if (next.has(id)) next.delete(id); else next.add(id)
    collapsed = next
  }
  function collapseAll() {
    const next = new Set<string>()
    for (const r of pivot.rows) if (r.__pivotExpandable) next.add(r.__pivotId)
    collapsed = next
  }
  function expandAll() { collapsed = new Set() }

  // Visible rows: hide descendants whose ancestor is in `collapsed`.
  const visibleRows = $derived.by(() => {
    if (collapsed.size === 0) return pivot.rows
    // Build expanded set: every expandable id NOT in collapsed.
    const expanded = new Set<string>()
    for (const r of pivot.rows) if (r.__pivotExpandable && !collapsed.has(r.__pivotId)) expanded.add(r.__pivotId)
    return filterCollapsedPivotRows(pivot.rows, expanded)
  })

  // ---- Counts for the legend / status bar -----------------------------
  const counts = $derived.by(() => {
    let leaf = 0, group = 0, sub = 0, grand = 0
    for (const r of pivot.rows) {
      if      (r.__pivotKind === 'leaf')        leaf++
      else if (r.__pivotKind === 'group')       group++
      else if (r.__pivotKind === 'subtotal')    sub++
      else if (r.__pivotKind === 'grandTotal')  grand++
    }
    return { leaf, group, sub, grand }
  })

  // ---- Formatting -----------------------------------------------------
  function fmt(n: number): string {
    if (measure === 'units') return n.toLocaleString('en-US')
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`
    return `$${Math.round(n)}`
  }

  // ---- Column tree ----------------------------------------------------
  const columns = $derived(pivot.columns.map((c, i) => {
    if (i === 0) {
      return {
        ...c,
        width: 240,
        cell: (ctx) => renderSnippet(LabelCell, { row: ctx.row.original }),
        cellClass: (ctx) => kindClass(ctx.row.original, 'label'),
      } as ColumnDef<typeof features, PivotRow>
    }
    return decorate(c) as ColumnDef<typeof features, PivotRow>
  }))
  function decorate(c: ColumnDef<typeof features, PivotRow>): ColumnDef<typeof features, PivotRow> {
    if (c.columns?.length) {
      return { ...c, columns: c.columns.map(decorate) }
    }
    const colId = c.id ?? ''
    const isGrandCol = colId === '__pivotGrandCol' || colId.endsWith('__grand')
    return {
      ...c,
      width: isGrandCol ? 130 : 110,
      align: 'right',
      // Group headers carry null value cells when subtotals are off - render
      // those blank instead of "$0" so a label-only group row reads cleanly.
      cell: (ctx) => { const v = ctx.getValue(); return v == null ? '' : fmt(Number(v)) },
      cellClass: (ctx) => kindClass(ctx.row.original, isGrandCol ? 'grandCol' : 'value'),
    }
  }
  function kindClass(row: PivotRow, pos: 'label'|'value'|'grandCol'): string {
    const base =
      row.__pivotKind === 'grandTotal' ? 'pv-row-grand'
      : row.__pivotKind === 'subtotal' ? 'pv-row-sub'
      : row.__pivotKind === 'group'    ? 'pv-row-group'
      :                                  'pv-row-leaf'
    return pos === 'grandCol' ? `${base} pv-cell-grandcol` : base
  }
</script>

{#snippet LabelCell(props: { row: PivotRow })}
  {@const row = props.row}
  {@const isCollapsed = collapsed.has(row.__pivotId)}
  <span class="pv-label" class:pv-label-grand={row.__pivotKind === 'grandTotal'}
        style={`padding-left: ${Math.max(0, row.__pivotDepth - 1) * 14 + 6}px`}>
    {#if row.__pivotExpandable}
      <button type="button" class="pv-chev" class:open={!isCollapsed}
              onclick={() => toggle(row.__pivotId)}
              aria-label={isCollapsed ? 'Expand' : 'Collapse'}>▸</button>
    {:else}
      <span class="pv-chev-spacer"></span>
    {/if}
    {#if row.__pivotKind === 'grandTotal'}
      <strong>Grand total</strong>
    {:else if row.__pivotKind === 'subtotal'}
      <span class="pv-subbadge">Σ</span>
      <span>{row.__pivotLabel} <span class="pv-label-dim">total</span></span>
    {:else}
      <span class:pv-label-group={row.__pivotKind === 'group'}>{row.__pivotLabel}</span>
    {/if}
  </span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <header class="tot-header">
    <h2>Pivot - Totals · Subtotals · Grand totals</h2>
    <p>
      Flip the engine's <code>grandTotalRow</code>, <code>grandTotalCol</code>, and
      <code>rowSubtotals</code> flags below; the grid reshapes live. Subtotals get a
      Σ badge, the grand-total row is tinted, the grand-total column is a
      subtle accent stripe on the right.
    </p>
  </header>

  <div class="tot-toolbar">
    <label class="tot-toggle">
      <input type="checkbox" bind:checked={showGrandRow} />
      <span>Grand total row</span>
    </label>
    <label class="tot-toggle">
      <input type="checkbox" bind:checked={showGrandCol} />
      <span>Grand total column</span>
    </label>
    <label class="tot-toggle">
      <input type="checkbox" bind:checked={showSubtotals} />
      <span>Row subtotals</span>
    </label>
    <span class="tot-divider"></span>
    <div class="tot-seg">
      <button type="button" class:active={measure === 'revenue'} onclick={() => (measure = 'revenue')}>Revenue</button>
      <button type="button" class:active={measure === 'units'}   onclick={() => (measure = 'units')}>Units</button>
    </div>
    <span class="tot-divider"></span>
    <button type="button" class="tot-btn" onclick={expandAll}>Expand all</button>
    <button type="button" class="tot-btn" onclick={collapseAll}>Collapse all</button>
  </div>

  <div class="tot-split flex flex-1 min-h-0 gap-3">
    <div class="tot-grid-wrap flex-1 min-w-0">
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
        enableRowSummaries={false}
      />
    </div>

    <aside class="tot-legend">
      <div class="tot-legend-head">Legend</div>
      <div class="tot-legend-row"><span class="tot-swatch sw-leaf"></span><div><strong>Leaf</strong><p>One source-fact aggregate.</p></div></div>
      <div class="tot-legend-row"><span class="tot-swatch sw-group"></span><div><strong>Group header</strong><p>Region or country label row.</p></div></div>
      <div class="tot-legend-row"><span class="tot-swatch sw-sub"></span><div><strong>Subtotal</strong><p>"Σ Region total" - aggregate of every country leaf under it.</p></div></div>
      <div class="tot-legend-row"><span class="tot-swatch sw-grand"></span><div><strong>Grand total</strong><p>The single bottom row - aggregate of the whole pivot.</p></div></div>
      <div class="tot-legend-row"><span class="tot-swatch sw-grandcol"></span><div><strong>Grand total column</strong><p>Right-most column - sum across all columns for the row.</p></div></div>

      <div class="tot-legend-head" style="margin-top: 12px">Pivot counts</div>
      <dl class="tot-counts">
        <dt>Leaves</dt><dd>{counts.leaf}</dd>
        <dt>Group rows</dt><dd>{counts.group}</dd>
        <dt>Subtotals</dt><dd>{counts.sub}</dd>
        <dt>Grand</dt><dd>{counts.grand}</dd>
      </dl>
    </aside>
  </div>
</section>

<style>
  .tot-header h2 { font-size: 16px; font-weight: 700; margin: 0; }
  .tot-header p  { margin: 4px 0 0; font-size: 12.5px; color: var(--sg-muted, #64748b); max-width: 70ch; }
  .tot-header code {
    background: var(--sg-header-bg, #f1f5f9);
    padding: 1px 4px; border-radius: 3px;
    font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px;
  }

  .tot-toolbar {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    padding: 8px 10px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px; background: var(--sg-bg, #ffffff);
    flex-shrink: 0;
  }
  .tot-toggle {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12px;
    cursor: pointer;
  }
  .tot-divider { width: 1px; height: 18px; background: var(--sg-border, #e2e8f0); }
  .tot-seg { display: inline-flex; border: 1px solid var(--sg-border, #cbd5e1); border-radius: 6px; overflow: hidden; }
  .tot-seg button {
    border: 0; background: transparent; padding: 4px 10px;
    font-size: 11.5px; cursor: pointer; color: var(--sg-fg, #1e293b);
  }
  .tot-seg button.active { background: var(--sg-accent, #2563eb); color: #fff; font-weight: 700; }
  .tot-btn {
    border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    padding: 4px 10px; border-radius: 5px; font-size: 11.5px; cursor: pointer;
  }
  .tot-btn:hover { background: var(--sg-header-bg, #f1f5f9); }

  .tot-split { min-height: 0; }
  .tot-grid-wrap {
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    overflow: hidden;
  }

  .tot-legend {
    width: 280px; flex-shrink: 0;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    background: var(--sg-bg, #ffffff);
    padding: 12px 14px;
    overflow: auto;
  }
  .tot-legend-head {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b); font-weight: 700; margin-bottom: 8px;
  }
  .tot-legend-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: flex-start; }
  .tot-legend-row p { margin: 2px 0 0; font-size: 11px; color: var(--sg-muted, #64748b); }
  .tot-legend-row strong { font-size: 12px; }
  .tot-swatch {
    width: 14px; height: 14px; border-radius: 3px; margin-top: 2px; flex-shrink: 0;
    border: 1px solid var(--sg-border, #cbd5e1);
  }
  .sw-leaf     { background: transparent; }
  .sw-group    { background: rgba(99,102,241,0.10); }
  .sw-sub      { background: rgba(14,165,233,0.18); }
  .sw-grand    { background: rgba(99,102,241,0.30); }
  .sw-grandcol { background: rgba(245,158,11,0.20); }
  .tot-counts {
    display: grid; grid-template-columns: 1fr auto; gap: 4px 12px;
    font-size: 12px; margin: 0;
  }
  .tot-counts dt { color: var(--sg-muted, #64748b); }
  .tot-counts dd { margin: 0; font-variant-numeric: tabular-nums; font-weight: 600; }

  /* Pivot rows */
  :global(.pv-label) { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; }
  :global(.pv-label-group) { font-weight: 700; }
  :global(.pv-label-dim) { color: var(--sg-muted, #64748b); font-weight: 500; font-size: 11.5px; }
  :global(.pv-subbadge) {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px;
    background: rgba(14,165,233,0.18);
    color: #0369a1;
    border-radius: 4px;
    font-size: 10.5px; font-weight: 800;
    line-height: 1;
  }
  :global([data-theme='dark']) :global(.pv-subbadge) { color: #7dd3fc; }
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

  /* Row class tints */
  :global(.pv-row-group) { background: rgba(99,102,241,0.06); }
  :global(.pv-row-sub) {
    background: rgba(14,165,233,0.12) !important;
    font-weight: 700;
  }
  :global(.pv-row-grand) {
    background: rgba(99,102,241,0.20) !important;
    font-weight: 800;
    color: var(--sg-accent, #2563eb);
  }
  :global(.pv-cell-grandcol) {
    background: rgba(245,158,11,0.12) !important;
    border-left: 2px solid rgba(245,158,11,0.45);
  }
  :global(.pv-row-grand.pv-cell-grandcol) {
    background: rgba(245,158,11,0.28) !important;
  }
</style>
