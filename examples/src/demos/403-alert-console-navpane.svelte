<script lang="ts">
  /**
   * 403. Alerts operations console (Enterprise)
   * -------------------------------------------
   * A full monitoring app in three panes: an Outlook-style navigation pane
   * (SvNavPane) - module rail (Monitor / Rules / Reports) plus badged folders -
   * a live fleet grid, and a reading pane with the selected host's detail, a CPU
   * sparkline, its recent alerts and quick actions. Alert rules watch every host
   * regardless of the folder in view, paint the rows, and feed the bell + panel.
   *
   * Nav pane: @svgrid/grid (SvNavPane). Alerts engine: @svgrid/enterprise.
   */
  import { SvGrid, SvToaster, SvNavPane, toast, type ColumnDef, type NavSection } from '@svgrid/grid'
  import type { ConditionalFormat } from '@svgrid/grid/format'
  import { SvGridAlerts, alertStore, enableAlerts, setLicenseKey, type AlertEvent, type AlertRule, type ExprColumn } from '@svgrid/enterprise'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')
  enableAlerts()

  type Server = { host: string; role: string; region: string; cpu: number; diskUsed: number; diskTotal: number; status: string; cpuHistory: number[] }

  const ROLES = ['web', 'api', 'db', 'cache', 'queue', 'worker', 'ingest', 'search']
  const REGIONS = ['us-east', 'us-west', 'eu-west', 'ap-south']
  const seedBase: Server[] = ROLES.flatMap((role, ri) =>
    REGIONS.map((region, gi) => {
      const n = ri * 4 + gi
      const total = role === 'db' || role === 'search' ? 1000 : 500
      const cpu = 20 + ((n * 37) % 78)
      return {
        host: `${role}-${String(gi + 1).padStart(2, '0')}`,
        role, region, cpu,
        diskUsed: Math.round(total * (0.25 + ((n * 53) % 70) / 100)),
        diskTotal: total,
        status: (n * 29) % 11 === 0 ? 'degraded' : 'ok',
        cpuHistory: Array.from({ length: 16 }, (_, i) => Math.max(3, Math.min(100, Math.round(cpu + Math.sin((i + n) / 2) * 12)))),
      }
    }),
  )

  let rows = $state.raw<Server[]>(seedBase)
  let alertFormats = $state<ConditionalFormat<Server>[]>([])
  let folder = $state<string>('all')
  let activeModule = $state<string>('monitor')
  let managerOpen = $state(false)
  let panelOpen = $state(false)
  let query = $state('')
  let selectedId = $state<string | null>('web-01')

  const selected = $derived(selectedId ? rows.find((r) => r.host === selectedId) ?? null : null)
  const recentForSelected = $derived(alertStore.events.filter((e) => e.rowId === selectedId).slice(0, 6))

  type Sev = 'critical' | 'warning' | 'healthy'
  function sev(s: Server): Sev {
    const disk = s.diskUsed / s.diskTotal
    if (s.status === 'degraded' || s.cpu > 85 || disk > 0.9) return 'critical'
    if (s.cpu > 70 || disk > 0.8) return 'warning'
    return 'healthy'
  }
  const SEV_COLOR: Record<Sev, string> = { critical: '#dc2626', warning: '#d97706', healthy: '#16a34a' }
  const EVT_COLOR: Record<string, string> = { error: '#dc2626', warning: '#d97706', info: '#3b82f6', success: '#16a34a' }

  const counts = $derived({
    all: rows.length,
    critical: rows.filter((s) => sev(s) === 'critical').length,
    warning: rows.filter((s) => sev(s) === 'warning').length,
    healthy: rows.filter((s) => sev(s) === 'healthy').length,
    byRegion: Object.fromEntries(REGIONS.map((r) => [r, rows.filter((s) => s.region === r).length])),
  })

  function matchesFolder(s: Server): boolean {
    if (folder === 'critical' || folder === 'warning' || folder === 'healthy') return sev(s) === folder
    if (folder.startsWith('region:')) return s.region === folder.slice(7)
    return true
  }
  function matchesQuery(s: Server): boolean {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return s.host.includes(q) || s.role.includes(q) || s.region.includes(q)
  }
  const displayed = $derived(rows.filter((s) => matchesFolder(s) && matchesQuery(s)))

  const sections: NavSection[] = $derived([
    {
      id: 'status', label: 'Status',
      items: [
        { id: 'all', label: 'All hosts', badge: counts.all },
        { id: 'critical', label: 'Critical', badge: counts.critical || undefined },
        { id: 'warning', label: 'Warnings', badge: counts.warning || undefined },
        { id: 'healthy', label: 'Healthy', badge: counts.healthy },
      ],
    },
    { id: 'regions', label: 'Regions', items: REGIONS.map((r) => ({ id: `region:${r}`, label: r, badge: counts.byRegion[r] })) },
  ])

  const baseBars: ConditionalFormat<Server>[] = [
    { type: 'dataBar', columns: ['cpu'], color: '#3b82f6', minValue: 0, maxValue: 100 },
    { type: 'dataBar', columns: ['diskUsed'], color: '#8b5cf6', compareColumn: 'diskTotal' },
  ]
  const formats = $derived([...baseBars, ...alertFormats])

  const columns: ColumnDef<any, Server>[] = [
    { id: 'host', header: 'Host', field: 'host', width: 108 },
    { id: 'role', header: 'Role', field: 'role', width: 90 },
    { id: 'region', header: 'Region', field: 'region', width: 104 },
    { id: 'cpu', header: 'CPU %', field: 'cpu', editorType: 'number', width: 120, format: { type: 'number' } },
    { id: 'diskUsed', header: 'Disk used', field: 'diskUsed', editorType: 'number', width: 120, format: { type: 'number' } },
    { id: 'status', header: 'Status', field: 'status', width: 100 },
  ]

  const exprColumns: ExprColumn[] = [
    { id: 'host', name: 'Host', type: 'text' },
    { id: 'role', name: 'Role', type: 'text' },
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
      actions: [{ kind: 'highlight', style: { background: '#fef3c7', color: '#92400e' } }, { kind: 'toast', message: '{host} CPU is high: {value}%' }],
      createdAt: 0,
    },
    {
      id: 'disk-pressure', name: 'Disk over 90% full', enabled: true, severity: 'error', scope: 'row',
      predicate: { kind: 'scalarCmp', left: { kind: 'bin', op: '/', left: { kind: 'col', id: 'diskUsed' }, right: { kind: 'col', id: 'diskTotal' } }, op: '>', right: { kind: 'lit', value: 0.9 } },
      trigger: { type: 'dataChange' },
      actions: [{ kind: 'highlight', style: { background: '#fee2e2', color: '#991b1b' } }, { kind: 'toast', message: '{host} disk almost full' }],
      createdAt: 0,
    },
  ]

  function randomize() {
    rows = rows.map((s) => {
      const cpu = Math.min(99, Math.max(5, Math.round(s.cpu + (Math.random() - 0.5) * 55)))
      return {
        ...s, cpu,
        diskUsed: Math.min(s.diskTotal, Math.max(20, Math.round(s.diskUsed + (Math.random() - 0.45) * 180))),
        status: Math.random() < 0.08 ? 'degraded' : s.status,
        cpuHistory: [...s.cpuHistory.slice(1), cpu],
      }
    })
  }

  function onModule(id: string) {
    activeModule = id
    if (id === 'rules') managerOpen = true
    else if (id === 'reports') panelOpen = true
  }

  function sparkPath(h: number[], w = 260, ht = 46): string {
    if (h.length < 2) return ''
    const min = Math.min(...h), max = Math.max(...h), span = max - min || 1
    return h.map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (h.length - 1)) * w).toFixed(1)},${(ht - ((v - min) / span) * ht).toFixed(1)}`).join(' ')
  }
  function timeLabel(ms: number): string {
    try { return new Date(ms).toLocaleTimeString() } catch { return '' }
  }
</script>

{#snippet iMonitor()}<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="1.5" /><path d="M8 21h8M12 17v4" /></svg>{/snippet}
{#snippet iRules()}<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v18M4 8h5M4 16h5" /><rect x="13" y="4" width="7" height="6" rx="1" /><rect x="13" y="14" width="7" height="6" rx="1" /></svg>{/snippet}
{#snippet iReports()}<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16h16" /><path d="M8 15l3-4 3 2 4-6" /></svg>{/snippet}

<div class="console">
  <aside class="console-nav">
    <div class="console-brand"><span class="brand-dot"></span> Fleet Ops</div>
    <SvNavPane
      {sections}
      bind:value={folder}
      onSelect={(id) => (folder = id)}
      bind:moduleValue={activeModule}
      onModuleSelect={onModule}
      modules={[
        { id: 'monitor', label: 'Monitor', icon: iMonitor, badge: counts.critical || undefined },
        { id: 'rules', label: 'Rules', icon: iRules },
        { id: 'reports', label: 'Reports', icon: iReports, badge: alertStore.activeCount || undefined },
      ]}
      moduleRows={3}
      height={470}
      ariaLabel="Fleet navigation" />
  </aside>

  <main class="console-main">
    <header class="app-bar">
      <div class="app-title">
        <h2>{folder === 'all' ? 'All hosts' : folder.startsWith('region:') ? folder.slice(7) : folder.charAt(0).toUpperCase() + folder.slice(1)}</h2>
        <p>{displayed.length} of {rows.length} hosts</p>
      </div>
      <div class="app-tools">
        <label class="search">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><line x1="10.5" y1="10.5" x2="14" y2="14" stroke-linecap="round" /></svg>
          <input type="search" placeholder="Search hosts…" bind:value={query} aria-label="Search hosts" />
        </label>
        <button type="button" class="btn" onclick={randomize}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
          Simulate
        </button>
        <SvGridAlerts data={rows} columns={exprColumns} getRowId={(r) => r.host} rules={seededRules} storageKey="svgrid-demo:console" bind:formats={alertFormats} bind:managerOpen bind:panelOpen />
      </div>
    </header>

    <div class="kpis">
      <div class="kpi"><span class="kpi-label">Critical</span><span class="kpi-value" style={`color:${counts.critical ? '#dc2626' : '#16a34a'}`}>{counts.critical}</span></div>
      <div class="kpi"><span class="kpi-label">Warnings</span><span class="kpi-value" style={`color:${counts.warning ? '#d97706' : 'inherit'}`}>{counts.warning}</span></div>
      <div class="kpi"><span class="kpi-label">Healthy</span><span class="kpi-value" style="color:#16a34a">{counts.healthy}</span></div>
      <div class="kpi"><span class="kpi-label">Alerts fired</span><span class="kpi-value" style="color:var(--sg-accent,#4f46e5)">{alertStore.events.length}</span></div>
    </div>

    <div class="console-body">
      <div class="app-grid">
        <SvGrid
      columnResize data={displayed} {columns} getRowId={(r) => r.host} conditionalFormats={formats} onRowClick={(e) => (selectedId = e.row.host)} containerHeight={330} />
      </div>

      {#if selected}
        {@const s = selected}
        <aside class="reader">
          <div class="reader-head">
            <div>
              <div class="reader-title">{s.host}</div>
              <div class="reader-sub">{s.role} · {s.region}</div>
            </div>
            <button type="button" class="reader-x" onclick={() => (selectedId = null)} aria-label="Close">✕</button>
          </div>

          <span class="pill" style={`color:${SEV_COLOR[sev(s)]}; background:color-mix(in srgb, ${SEV_COLOR[sev(s)]} 14%, transparent)`}>
            <span class="pill-dot" style={`background:${SEV_COLOR[sev(s)]}`}></span>{sev(s)}
          </span>

          <div class="metric">
            <div class="metric-row"><span>CPU</span><span class="metric-val">{s.cpu}%</span></div>
            <div class="mbar"><span class="mbar-fill" style={`width:${s.cpu}%; background:${s.cpu > 85 ? '#dc2626' : s.cpu > 70 ? '#d97706' : '#3b82f6'}`}></span></div>
          </div>
          <div class="metric">
            <div class="metric-row"><span>Disk</span><span class="metric-val">{s.diskUsed} / {s.diskTotal} GB</span></div>
            <div class="mbar"><span class="mbar-fill" style={`width:${Math.round((s.diskUsed / s.diskTotal) * 100)}%; background:${s.diskUsed / s.diskTotal > 0.9 ? '#dc2626' : '#8b5cf6'}`}></span></div>
          </div>

          <div class="spark-card">
            <span class="spark-label">CPU - last {s.cpuHistory.length} samples</span>
            <svg viewBox="0 0 260 46" preserveAspectRatio="none" class="spark"><path d={sparkPath(s.cpuHistory)} fill="none" stroke="#3b82f6" stroke-width="1.6" /></svg>
          </div>

          <div class="reader-alerts">
            <span class="spark-label">Recent alerts</span>
            {#if recentForSelected.length === 0}
              <p class="reader-empty">No alerts for this host yet.</p>
            {:else}
              <ul>
                {#each recentForSelected as e, i (e.firedAt + '-' + i)}
                  <li><span class="evt-dot" style={`background:${EVT_COLOR[e.severity]}`}></span><span class="evt-msg">{e.message}</span><span class="evt-time">{timeLabel(e.firedAt)}</span></li>
                {/each}
              </ul>
            {/if}
          </div>

          <div class="reader-actions">
            <button type="button" class="btn btn-sm" onclick={() => toast.success(`${s.host} acknowledged`)}>Acknowledge</button>
            <button type="button" class="btn btn-sm" onclick={() => toast.info(`${s.host} muted for 1h`)}>Mute</button>
            <button type="button" class="btn btn-sm btn-danger" onclick={() => toast.warning(`Restart requested for ${s.host}`)}>Restart</button>
          </div>
        </aside>
      {/if}
    </div>
  </main>
</div>

<SvToaster position="bottom-right" />

<style>
  .console { display: flex; min-height: 500px; border: 1px solid color-mix(in srgb, currentColor 13%, transparent); border-radius: 16px; overflow: hidden; background: color-mix(in srgb, currentColor 2%, transparent); font-family: var(--sg-font, inherit); color: inherit; }
  /* Phone: same as the sibling alert apps - a hidden-overflow flex item shrinks to
     the stage (its automatic min-height is 0) and clipped the whole main pane
     under the stacked nav. Keep the content height and let the page scroll. */
  @media (max-width: 767px) {
    .console { flex-shrink: 0; }
  }
  .console-nav { width: 224px; flex: none; display: flex; flex-direction: column; border-right: 1px solid color-mix(in srgb, currentColor 10%, transparent); background: color-mix(in srgb, currentColor 3%, transparent); }
  .console-brand { display: flex; align-items: center; gap: 9px; padding: 15px 16px 10px; font-size: 14px; font-weight: 700; }
  .brand-dot { width: 20px; height: 20px; border-radius: 6px; background: linear-gradient(135deg, var(--sg-accent, #4f46e5), #9333ea); box-shadow: 0 2px 8px -2px var(--sg-accent, #4f46e5); }
  .console-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }

  .app-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 18px; border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent); flex-wrap: wrap; }
  .app-title h2 { margin: 0; font-size: 16px; font-weight: 650; text-transform: capitalize; }
  .app-title p { margin: 2px 0 0; font-size: 12px; opacity: 0.55; }
  .app-tools { display: inline-flex; align-items: center; gap: 8px; }
  .search { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 11px; border-radius: 9px; border: 1px solid color-mix(in srgb, currentColor 18%, transparent); background: color-mix(in srgb, currentColor 4%, transparent); opacity: 0.85; }
  .search input { border: 0; background: transparent; outline: none; color: inherit; font-size: 13px; width: 130px; }
  .search input::placeholder { color: inherit; opacity: 0.5; }
  .btn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 13px; border-radius: 9px; font-size: 13px; font-weight: 500; cursor: pointer; color: inherit; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); background: color-mix(in srgb, currentColor 5%, transparent); transition: background 0.14s ease, border-color 0.14s ease; }
  .btn:hover { background: color-mix(in srgb, currentColor 13%, transparent); border-color: color-mix(in srgb, currentColor 36%, transparent); }
  .btn-sm { height: 30px; padding: 0 11px; font-size: 12px; }
  .btn-danger:hover { color: #dc2626; border-color: color-mix(in srgb, #dc2626 40%, transparent); background: color-mix(in srgb, #dc2626 10%, transparent); }

  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: color-mix(in srgb, currentColor 10%, transparent); border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent); }
  .kpi { padding: 11px 16px; background: color-mix(in srgb, currentColor 2%, transparent); display: flex; flex-direction: column; gap: 2px; }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.55; font-weight: 600; }
  .kpi-value { font-size: 19px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; }

  .console-body { display: flex; flex: 1; min-height: 0; }
  .app-grid { flex: 1; min-width: 0; padding: 12px; }
  .reader { width: 300px; flex: none; border-left: 1px solid color-mix(in srgb, currentColor 10%, transparent); background: color-mix(in srgb, currentColor 3%, transparent); padding: 16px; display: flex; flex-direction: column; gap: 12px; overflow: auto; }
  .reader-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .reader-title { font-size: 16px; font-weight: 700; }
  .reader-sub { font-size: 12px; opacity: 0.6; margin-top: 1px; text-transform: capitalize; }
  .reader-x { border: 0; background: transparent; color: inherit; opacity: 0.5; cursor: pointer; font-size: 13px; border-radius: 6px; width: 24px; height: 24px; }
  .reader-x:hover { opacity: 1; background: color-mix(in srgb, currentColor 10%, transparent); }
  .pill { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; font-size: 11.5px; font-weight: 600; padding: 2px 10px; border-radius: 999px; text-transform: capitalize; }
  .pill-dot { width: 6px; height: 6px; border-radius: 999px; }
  .metric { display: flex; flex-direction: column; gap: 5px; }
  .metric-row { display: flex; justify-content: space-between; font-size: 12px; }
  .metric-row > span:first-child { opacity: 0.6; }
  .metric-val { font-weight: 600; font-variant-numeric: tabular-nums; }
  .mbar { height: 7px; border-radius: 999px; background: color-mix(in srgb, currentColor 10%, transparent); overflow: hidden; }
  .mbar-fill { display: block; height: 100%; border-radius: 999px; transition: width 0.3s ease; }
  .spark-card { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid color-mix(in srgb, currentColor 12%, transparent); border-radius: 10px; }
  .spark-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.55; font-weight: 600; }
  .spark { width: 100%; height: 46px; }
  .reader-alerts { display: flex; flex-direction: column; gap: 6px; }
  .reader-alerts ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .reader-alerts li { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; font-size: 12px; }
  .evt-dot { width: 7px; height: 7px; border-radius: 999px; }
  .evt-msg { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .evt-time { font-size: 10.5px; opacity: 0.5; font-variant-numeric: tabular-nums; }
  .reader-empty { margin: 0; font-size: 12px; opacity: 0.55; }
  .reader-actions { display: flex; gap: 6px; margin-top: auto; flex-wrap: wrap; }

  @media (max-width: 860px) { .reader { display: none; } }
  @media (max-width: 720px) { .console { flex-direction: column; } .console-nav { width: auto; border-right: 0; border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent); } }
</style>
