<script lang="ts">
  /**
   * 400. Alert rules: conditional styling (Enterprise)
   * --------------------------------------------------
   * Alert rules aren't only notifications - a rule with a "highlight" or "badge"
   * action becomes live conditional styling, painted through the grid's own
   * format pipeline. A server fleet lights up by rule: hot CPU turns amber,
   * near-full disks turn red (a cross-column rule: used / total > 0.9). In-cell
   * data bars and status pills make it a real ops board. Randomise the load and
   * the colours follow. Engine + overlay: @svgrid/enterprise.
   */
  import { SvGrid, SvToaster, renderSnippet, type ColumnDef } from '@svgrid/grid'
  import type { ConditionalFormat } from '@svgrid/grid/format'
  import { SvGridAlerts, enableAlerts, setLicenseKey, type AlertRule, type ExprColumn } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableAlerts()

  type Server = { host: string; region: string; cpu: number; diskUsed: number; diskTotal: number; status: string; cpuHistory: number[] }

  const baseRows: Omit<Server, 'cpuHistory'>[] = [
    { host: 'web-01', region: 'us-east', cpu: 42, diskUsed: 210, diskTotal: 500, status: 'ok' },
    { host: 'web-02', region: 'us-east', cpu: 91, diskUsed: 320, diskTotal: 500, status: 'ok' },
    { host: 'web-03', region: 'us-east', cpu: 58, diskUsed: 280, diskTotal: 500, status: 'ok' },
    { host: 'api-01', region: 'eu-west', cpu: 66, diskUsed: 470, diskTotal: 500, status: 'ok' },
    { host: 'api-02', region: 'eu-west', cpu: 28, diskUsed: 120, diskTotal: 500, status: 'ok' },
    { host: 'api-03', region: 'eu-west', cpu: 73, diskUsed: 410, diskTotal: 500, status: 'ok' },
    { host: 'db-01', region: 'us-west', cpu: 88, diskUsed: 900, diskTotal: 1000, status: 'degraded' },
    { host: 'db-02', region: 'us-west', cpu: 51, diskUsed: 620, diskTotal: 1000, status: 'ok' },
    { host: 'db-03', region: 'eu-west', cpu: 94, diskUsed: 960, diskTotal: 1000, status: 'degraded' },
    { host: 'cache-01', region: 'ap-south', cpu: 15, diskUsed: 60, diskTotal: 250, status: 'ok' },
    { host: 'cache-02', region: 'ap-south', cpu: 33, diskUsed: 130, diskTotal: 250, status: 'ok' },
    { host: 'queue-01', region: 'us-east', cpu: 77, diskUsed: 190, diskTotal: 250, status: 'ok' },
    { host: 'queue-02', region: 'eu-west', cpu: 46, diskUsed: 90, diskTotal: 250, status: 'ok' },
    { host: 'worker-01', region: 'ap-south', cpu: 82, diskUsed: 340, diskTotal: 500, status: 'ok' },
    { host: 'worker-02', region: 'ap-south', cpu: 97, diskUsed: 300, diskTotal: 500, status: 'ok' },
    { host: 'worker-03', region: 'us-west', cpu: 61, diskUsed: 220, diskTotal: 500, status: 'ok' },
    { host: 'ingest-01', region: 'us-east', cpu: 39, diskUsed: 480, diskTotal: 500, status: 'ok' },
    { host: 'ingest-02', region: 'eu-west', cpu: 24, diskUsed: 150, diskTotal: 500, status: 'ok' },
    { host: 'search-01', region: 'us-west', cpu: 69, diskUsed: 740, diskTotal: 800, status: 'ok' },
    { host: 'search-02', region: 'ap-south', cpu: 85, diskUsed: 780, diskTotal: 800, status: 'degraded' },
  ]
  const seedHistory = (c: number) => Array.from({ length: 16 }, (_, i) => Math.max(2, Math.min(100, Math.round(c + Math.sin(i / 2) * 12 - (16 - i)))))
  const seed: Server[] = baseRows.map((s) => ({ ...s, cpuHistory: seedHistory(s.cpu) }))

  let rows = $state.raw<Server[]>(seed)
  let alertFormats = $state<ConditionalFormat<Server>[]>([])

  const avgCpu = $derived(Math.round(rows.reduce((s, r) => s + r.cpu, 0) / rows.length))
  const atRisk = $derived(rows.filter((r) => r.cpu > 85 || r.diskUsed / r.diskTotal > 0.9).length)
  const degraded = $derived(rows.filter((r) => r.status === 'degraded').length)

  // In-cell utilisation bars (base styling), merged with the alert-driven formats.
  const baseBars: ConditionalFormat<Server>[] = [
    { type: 'dataBar', columns: ['cpu'], color: '#3b82f6', minValue: 0, maxValue: 100 },
    { type: 'dataBar', columns: ['diskUsed'], color: '#8b5cf6', compareColumn: 'diskTotal' },
  ]
  const formats = $derived([...baseBars, ...alertFormats])

  const columns: ColumnDef<any, Server>[] = [
    { id: 'host', header: 'Host', field: 'host', width: 110 },
    { id: 'region', header: 'Region', field: 'region', width: 110 },
    { id: 'cpu', header: 'CPU %', field: 'cpu', editorType: 'number', width: 130, format: { type: 'number' } },
    { id: 'cpuTrend', header: 'CPU trend', field: 'cpuHistory', width: 100, sparkline: { type: 'line', color: '#3b82f6', lineWidth: 1.5 } },
    { id: 'diskUsed', header: 'Disk used (GB)', field: 'diskUsed', editorType: 'number', width: 140, format: { type: 'number' } },
    { id: 'diskTotal', header: 'Capacity', field: 'diskTotal', editorType: 'number', width: 100, format: { type: 'number' } },
    { id: 'status', header: 'Status', field: 'status', width: 120, cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }) },
  ]

  const exprColumns: ExprColumn[] = [
    { id: 'host', name: 'Host', type: 'text' },
    { id: 'region', name: 'Region', type: 'text' },
    { id: 'cpu', name: 'CPU %', type: 'number' },
    { id: 'diskUsed', name: 'Disk used', type: 'number' },
    { id: 'diskTotal', name: 'Disk total', type: 'number' },
    { id: 'status', name: 'Status', type: 'text' },
  ]

  const seededRules: AlertRule[] = [
    {
      id: 'hot-cpu', name: 'Hot CPU (> 85%)', enabled: true, severity: 'warning', scope: 'row',
      predicate: { kind: 'cmp', column: 'cpu', op: 'greaterThan', value: 85 },
      trigger: { type: 'dataChange' },
      actions: [{ kind: 'highlight', style: { background: '#fef3c7', color: '#92400e' } }],
      createdAt: 0,
    },
    {
      id: 'disk-pressure', name: 'Disk over 90% full', enabled: true, severity: 'error', scope: 'row',
      predicate: { kind: 'scalarCmp', left: { kind: 'bin', op: '/', left: { kind: 'col', id: 'diskUsed' }, right: { kind: 'col', id: 'diskTotal' } }, op: '>', right: { kind: 'lit', value: 0.9 } },
      trigger: { type: 'dataChange' },
      actions: [{ kind: 'highlight', style: { background: '#fee2e2', color: '#991b1b' } }],
      createdAt: 0,
    },
  ]

  function randomize() {
    rows = rows.map((s) => {
      const cpu = Math.min(99, Math.max(5, Math.round(s.cpu + (Math.random() - 0.5) * 60)))
      return {
        ...s, cpu,
        diskUsed: Math.min(s.diskTotal, Math.max(20, Math.round(s.diskUsed + (Math.random() - 0.45) * 200))),
        status: Math.random() < 0.15 ? 'degraded' : 'ok',
        cpuHistory: [...s.cpuHistory.slice(1), cpu],
      }
    })
  }
</script>

{#snippet StatusCell(props: { row: Server })}
  {@const ok = props.row.status !== 'degraded'}
  <span class="pill" style={`color:${ok ? '#16a34a' : '#dc2626'}; background:color-mix(in srgb, ${ok ? '#16a34a' : '#dc2626'} 14%, transparent)`}>
    <span class="pill-dot" style={`background:${ok ? '#16a34a' : '#dc2626'}`}></span>{props.row.status}
  </span>
{/snippet}

<div class="app">
  <header class="app-bar">
    <div class="app-title">
      <span class="app-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="7" rx="1.5" /><rect x="3" y="13" width="18" height="7" rx="1.5" /><path d="M7 7.5h.01M7 16.5h.01" /></svg></span>
      <div>
        <h2>Fleet Health</h2>
        <p>Highlight and badge rules become live conditional formatting; in-cell bars show utilisation at a glance.</p>
      </div>
    </div>
    <div class="app-tools">
      <button type="button" class="btn" onclick={randomize}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
        Simulate load
      </button>
      <SvGridAlerts data={rows} columns={exprColumns} getRowId={(r) => r.host} rules={seededRules} storageKey="svgrid-demo:styling-rules" bind:formats={alertFormats} />
    </div>
  </header>

  <div class="kpis">
    <div class="kpi"><span class="kpi-label">Hosts</span><span class="kpi-value">{rows.length}</span></div>
    <div class="kpi"><span class="kpi-label">Avg CPU</span><span class="kpi-value" style={`color:${avgCpu > 70 ? '#d97706' : 'inherit'}`}>{avgCpu}%</span></div>
    <div class="kpi"><span class="kpi-label">At risk</span><span class="kpi-value" style={`color:${atRisk ? '#dc2626' : '#16a34a'}`}>{atRisk}</span></div>
    <div class="kpi"><span class="kpi-label">Degraded</span><span class="kpi-value" style={`color:${degraded ? '#dc2626' : 'inherit'}`}>{degraded}</span></div>
  </div>

  <div class="app-grid">
    <SvGrid
      columnResize data={rows} {columns} getRowId={(r) => r.host} conditionalFormats={formats} containerHeight={330} />
  </div>

  <footer class="app-foot">
    <span class="legend"><span class="legend-swatch" style="background:#fef3c7"></span> Hot CPU</span>
    <span class="legend"><span class="legend-swatch" style="background:#fee2e2"></span> Disk &gt; 90%</span>
    <span class="legend"><span class="legend-swatch" style="background:#3b82f6"></span> CPU bar</span>
    <span class="legend"><span class="legend-swatch" style="background:#8b5cf6"></span> Disk bar</span>
    <span class="foot-hint">Rules are the styling - edit them in <strong>Manage alerts</strong>.</span>
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
  .app-title p { margin: 2px 0 0; font-size: 12.5px; opacity: 0.6; max-width: 54ch; line-height: 1.45; }
  .app-tools { display: inline-flex; align-items: center; gap: 8px; }
  .btn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 13px; border-radius: 9px; font-size: 13px; font-weight: 500; cursor: pointer; color: inherit; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); background: color-mix(in srgb, currentColor 5%, transparent); transition: background 0.14s ease, border-color 0.14s ease; }
  .btn:hover { background: color-mix(in srgb, currentColor 13%, transparent); border-color: color-mix(in srgb, currentColor 36%, transparent); }

  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1px; background: color-mix(in srgb, currentColor 10%, transparent); border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent); }
  .kpi { padding: 12px 16px; background: color-mix(in srgb, currentColor 2%, transparent); display: flex; flex-direction: column; gap: 3px; }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.55; font-weight: 600; }
  .kpi-value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; }

  .app-grid { padding: 12px; }
  .app-foot { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 11px 18px; border-top: 1px solid color-mix(in srgb, currentColor 10%, transparent); font-size: 12px; opacity: 0.85; }
  .legend { display: inline-flex; align-items: center; gap: 6px; }
  .legend-swatch { width: 12px; height: 12px; border-radius: 3px; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); }
  .foot-hint { opacity: 0.7; }

  :global(.pill) { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; padding: 2px 10px; border-radius: 999px; text-transform: capitalize; }
  :global(.pill-dot) { width: 6px; height: 6px; border-radius: 999px; }
</style>
