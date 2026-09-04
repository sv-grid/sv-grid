<script lang="ts">
  /**
   * 401. Alert rules: KPI & aggregate thresholds (Enterprise)
   * ---------------------------------------------------------
   * Alerts that watch a whole-table total, not just a row. An aggregate-scope
   * rule fires once when SUM(revenue) crosses the company target; a row rule
   * flags any region trailing its own target. Close a few deals and watch the
   * aggregate alert fire the moment the total clears the line.
   *
   * Engine + overlay: @svgrid/enterprise.
   */
  import { SvGrid, SvToaster, renderSnippet, type ColumnDef, type SvGridApi } from '@svgrid/grid'
  import type { ConditionalFormat } from '@svgrid/grid/format'
  import { SvGridAlerts, enableAlerts, setLicenseKey, type AlertRule, type ExprColumn } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableAlerts()

  type Region = { region: string; owner: string; revenue: number; target: number; deals: number }
  const TARGET_TOTAL = 900_000

  const seed: Region[] = [
    { region: 'US East', owner: 'A. Rivera', revenue: 148_000, target: 160_000, deals: 26 },
    { region: 'US West', owner: 'J. Chen', revenue: 132_000, target: 130_000, deals: 22 },
    { region: 'UK & Ireland', owner: 'S. Patel', revenue: 96_000, target: 90_000, deals: 18 },
    { region: 'DACH', owner: 'M. Weber', revenue: 71_000, target: 100_000, deals: 15 },
    { region: 'Nordics', owner: 'L. Berg', revenue: 54_000, target: 60_000, deals: 11 },
    { region: 'APAC North', owner: 'H. Tanaka', revenue: 88_000, target: 95_000, deals: 20 },
    { region: 'APAC South', owner: 'R. Kumar', revenue: 63_000, target: 90_000, deals: 17 },
    { region: 'LATAM', owner: 'C. Nunez', revenue: 41_000, target: 70_000, deals: 12 },
  ]

  let rows = $state.raw<Region[]>(seed)
  let alertFormats = $state<ConditionalFormat<Region>[]>([])
  let api = $state<SvGridApi<any, Region> | null>(null)

  const total = $derived(rows.reduce((s, r) => s + r.revenue, 0))
  const attainment = $derived(Math.min(100, Math.round((total / TARGET_TOTAL) * 100)))
  const underTarget = $derived(rows.filter((r) => r.revenue < r.target).length)
  const fmtK = (n: number) => `$${Math.round(n / 1000)}k`

  // Per-row attainment bar (revenue as a share of that row's target).
  const baseBars: ConditionalFormat<Region>[] = [
    { type: 'dataBar', columns: ['revenue'], color: '#4f46e5', compareColumn: 'target' },
  ]
  const formats = $derived([...baseBars, ...alertFormats])

  const columns: ColumnDef<any, Region>[] = [
    { id: 'region', header: 'Territory', field: 'region', width: 140 },
    { id: 'owner', header: 'Owner', field: 'owner', width: 120 },
    { id: 'revenue', header: 'Revenue', field: 'revenue', editorType: 'number', width: 150, format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { id: 'target', header: 'Target', field: 'target', editorType: 'number', width: 130, format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } } },
    { id: 'variance', header: 'vs Target', field: 'revenue', width: 110, cell: (ctx) => renderSnippet(VarianceCell, { row: ctx.row.original }) },
    { id: 'deals', header: 'Deals', field: 'deals', editorType: 'number', width: 80, format: { type: 'number' } },
  ]

  const exprColumns: ExprColumn[] = [
    { id: 'region', name: 'Territory', type: 'text' },
    { id: 'owner', name: 'Owner', type: 'text' },
    { id: 'revenue', name: 'Revenue', type: 'number' },
    { id: 'target', name: 'Target', type: 'number' },
    { id: 'deals', name: 'Deals', type: 'number' },
  ]

  const seededRules: AlertRule[] = [
    {
      id: 'company-target', name: 'Company target reached', enabled: true, severity: 'success', scope: 'aggregate',
      predicate: { kind: 'scalarCmp', left: { kind: 'agg', fn: 'sum', column: 'revenue' }, op: '>=', right: { kind: 'lit', value: TARGET_TOTAL } },
      trigger: { type: 'dataChange' },
      actions: [{ kind: 'toast', message: 'Company target of $900k reached!' }],
      createdAt: 0,
    },
    {
      id: 'under-target', name: 'Region below its target', enabled: true, severity: 'warning', scope: 'row',
      predicate: { kind: 'scalarCmp', left: { kind: 'col', id: 'revenue' }, op: '<', right: { kind: 'col', id: 'target' } },
      trigger: { type: 'dataChange' },
      actions: [{ kind: 'highlight', style: { background: '#fef3c7', color: '#92400e' } }],
      createdAt: 0,
    },
  ]

  function closeDeals() {
    rows = rows.map((r) => r.revenue < r.target ? { ...r, revenue: r.revenue + Math.round(15_000 + Math.random() * 25_000), deals: r.deals + Math.ceil(Math.random() * 4) } : r)
  }
  function reset() { rows = seed }
  function jumpTo(rowId: string | undefined) {
    if (!rowId) return
    const i = rows.findIndex((r) => r.region === rowId)
    if (i >= 0) { api?.scrollToRow?.(i); api?.selectRows?.([rowId]) }
  }
</script>

{#snippet VarianceCell(props: { row: Region })}
  {@const pct = Math.round(((props.row.revenue - props.row.target) / props.row.target) * 100)}
  {@const up = pct >= 0}
  <span class="chg" style={`color:${up ? '#16a34a' : '#dc2626'}`}>
    <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">{#if up}<path d="M6 2 L11 9 L1 9 Z" fill="currentColor" />{:else}<path d="M6 10 L1 3 L11 3 Z" fill="currentColor" />{/if}</svg>
    {up ? '+' : ''}{pct}%
  </span>
{/snippet}

<div class="app">
  <header class="app-bar">
    <div class="app-title">
      <span class="app-icon">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="5" width="3" height="13" /></svg>
      </span>
      <div>
        <h2>Revenue Pulse</h2>
        <p>An aggregate rule watches SUM(revenue) across every region and fires once when it clears the target.</p>
      </div>
    </div>
    <div class="app-tools">
      <button type="button" class="btn" onclick={closeDeals}>Close deals</button>
      <button type="button" class="btn btn-ghost" onclick={reset}>Reset</button>
      <SvGridAlerts data={rows} columns={exprColumns} getRowId={(r) => r.region} rules={seededRules} storageKey="svgrid-demo:kpi-alerts" bind:formats={alertFormats} onJump={(e) => jumpTo(e.rowId)} />
    </div>
  </header>

  <div class="kpis">
    <div class="kpi kpi-wide">
      <span class="kpi-label">Attainment</span>
      <div class="kpi-attain">
        <span class="kpi-value" style={`color:${attainment >= 100 ? '#16a34a' : 'inherit'}`}>{fmtK(total)} <span class="kpi-sub">/ {fmtK(TARGET_TOTAL)}</span></span>
        <div class="bar"><span class="bar-fill" style={`width:${attainment}%; background:${attainment >= 100 ? '#16a34a' : 'var(--sg-accent,#4f46e5)'}`}></span></div>
      </div>
    </div>
    <div class="kpi"><span class="kpi-label">Attainment %</span><span class="kpi-value" style={`color:${attainment >= 100 ? '#16a34a' : 'inherit'}`}>{attainment}%</span></div>
    <div class="kpi"><span class="kpi-label">Regions</span><span class="kpi-value">{rows.length}</span></div>
    <div class="kpi"><span class="kpi-label">Under target</span><span class="kpi-value" style={`color:${underTarget ? '#d97706' : '#16a34a'}`}>{underTarget}</span></div>
  </div>

  <div class="app-grid">
    <SvGrid
      columnResize data={rows} {columns} getRowId={(r) => r.region} conditionalFormats={formats} onApiReady={(a) => (api = a)} containerHeight={280} />
  </div>

  <footer class="app-foot">
    <span class="legend"><span class="legend-swatch" style="background:#fef3c7"></span> Below own target</span>
    <span class="foot-hint">The <strong>aggregate</strong> alert fires when the combined total clears $900k. Close deals to trigger it.</span>
  </footer>
</div>

<SvToaster position="bottom-right" />

<style>
  .app { border: 1px solid color-mix(in srgb, currentColor 13%, transparent); border-radius: 16px; overflow: hidden; background: color-mix(in srgb, currentColor 2%, transparent); font-family: var(--sg-font, inherit); color: inherit; }
  /* Phone: this root hides overflow (rounded corners), which makes its automatic
     min-height 0 - so as a flex item of the demo stage it shrank to the stage and
     clipped its own footer. Keep its content height; the page scrolls instead. */
  @media (max-width: 767px) {
    .app { flex-shrink: 0; }
  }
  .app-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 15px 18px; border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent); flex-wrap: wrap; }
  .app-title { display: flex; align-items: center; gap: 13px; }
  .app-icon { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; background: color-mix(in srgb, var(--sg-accent, #4f46e5) 15%, transparent); color: var(--sg-accent, #4f46e5); flex: none; }
  .app-title h2 { margin: 0; font-size: 16px; font-weight: 650; }
  .app-title p { margin: 2px 0 0; font-size: 12.5px; opacity: 0.6; max-width: 52ch; line-height: 1.45; }
  .app-tools { display: inline-flex; align-items: center; gap: 8px; }

  .btn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 13px; border-radius: 9px; font-size: 13px; font-weight: 500; cursor: pointer; color: inherit; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); background: color-mix(in srgb, currentColor 5%, transparent); transition: background 0.14s ease, border-color 0.14s ease; }
  .btn:hover { background: color-mix(in srgb, currentColor 13%, transparent); border-color: color-mix(in srgb, currentColor 36%, transparent); }
  .btn-ghost { background: transparent; }

  .kpis { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 1px; background: color-mix(in srgb, currentColor 10%, transparent); border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent); }
  .kpi { padding: 12px 16px; background: color-mix(in srgb, currentColor 2%, transparent); display: flex; flex-direction: column; gap: 3px; }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.55; font-weight: 600; }
  .kpi-value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; }
  .kpi-sub { font-size: 13px; font-weight: 600; opacity: 0.55; }
  .kpi-attain { display: flex; flex-direction: column; gap: 7px; }
  .bar { height: 7px; border-radius: 999px; background: color-mix(in srgb, currentColor 12%, transparent); overflow: hidden; }
  .bar-fill { display: block; height: 100%; border-radius: 999px; transition: width 0.4s ease; }
  @media (max-width: 640px) { .kpis { grid-template-columns: 1fr 1fr; } }

  .app-grid { padding: 12px; }
  .app-foot { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 11px 18px; border-top: 1px solid color-mix(in srgb, currentColor 10%, transparent); font-size: 12px; opacity: 0.85; }
  .legend { display: inline-flex; align-items: center; gap: 6px; }
  .legend-swatch { width: 12px; height: 12px; border-radius: 3px; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); }
  .foot-hint { opacity: 0.7; }
  :global(.chg) { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; font-variant-numeric: tabular-nums; }
</style>
