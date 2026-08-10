<script lang="ts">
  /**
   * Operations dashboard - a KPI console composed from the UI kit. Foregrounds
   * SvStat + SvSparkline tiles, an SvGauge SLA dial, SvHoverCard drill-down
   * previews on each service, an SvMenubar toolbar, and a promise toast on
   * "Refresh". Pure UI-kit composition (no grid dependency).
   */
  import {
    SvMenubar, SvCard, SvStat, SvGauge, SvSparkline, SvBadge, SvHoverCard,
    SvButton, SvDivider, SvToaster, toast, type MenubarMenu, type MenuItem,
  } from '@svgrid/grid'

  let range = $state('7d')

  const kpis = [
    { label: 'Requests / min', value: '24.6k', delta: '+8.1%', trend: 'up' as const, spark: [18, 20, 19, 22, 21, 24, 25, 24, 26], color: '#4f46e5' },
    { label: 'Error rate', value: '0.42%', delta: '-0.1%', trend: 'up' as const, spark: [0.9, 0.8, 0.7, 0.6, 0.55, 0.5, 0.45, 0.44, 0.42], color: '#16a34a' },
    { label: 'p95 latency', value: '184 ms', delta: '+12 ms', trend: 'down' as const, spark: [150, 160, 158, 165, 170, 175, 180, 182, 184], color: '#f59e0b' },
    { label: 'Active users', value: '8,912', delta: '+312', trend: 'up' as const, spark: [7.2, 7.5, 7.8, 8.0, 8.2, 8.4, 8.6, 8.8, 8.9], color: '#0891b2' },
  ]

  type Service = { name: string; status: 'healthy' | 'degraded' | 'down'; uptime: number; p95: number; owner: string }
  let services = $state<Service[]>([
    { name: 'API Gateway', status: 'healthy', uptime: 99.98, p95: 120, owner: 'Platform' },
    { name: 'Auth Service', status: 'healthy', uptime: 99.95, p95: 90, owner: 'Identity' },
    { name: 'Billing', status: 'degraded', uptime: 99.4, p95: 410, owner: 'Payments' },
    { name: 'Search', status: 'healthy', uptime: 99.9, p95: 160, owner: 'Data' },
    { name: 'Notifications', status: 'down', uptime: 97.1, p95: 0, owner: 'Growth' },
  ])

  const badge = (s: Service['status']) => (s === 'healthy' ? 'success' : s === 'degraded' ? 'warning' : 'danger')
  const sla = $derived(Math.round((services.reduce((a, s) => a + s.uptime, 0) / services.length) * 100) / 100)

  const menus: MenubarMenu[] = [
    { label: 'View', items: [
      { label: 'Overview', onSelect: () => toast('Overview') },
      { label: 'By region', onSelect: () => toast('By region') },
      { label: 'By service', onSelect: () => toast('By service') },
    ] },
    { label: 'Range', items: [
      { label: 'Last 24 hours', onSelect: () => (range = '24h') },
      { label: 'Last 7 days', onSelect: () => (range = '7d') },
      { label: 'Last 30 days', onSelect: () => (range = '30d') },
    ] },
    { label: 'Actions', items: [
      { label: 'Refresh', shortcut: 'R', onSelect: refresh },
      { label: 'Export PDF', onSelect: () => toast('Exporting PDF') },
      { label: 'Create alert', onSelect: () => toast('Alert rule builder') },
    ] },
  ]
  const onMenu = (_: MenuItem) => {}

  function refresh() {
    toast.promise(new Promise((res) => setTimeout(res, 900)), {
      loading: 'Refreshing metrics...', success: 'Metrics up to date', error: 'Refresh failed',
    })
  }
</script>

<div class="wrap">
  <header class="head">
    <div>
      <h2>Operations</h2>
      <p class="muted">Live service health - last {range === '24h' ? '24 hours' : range === '30d' ? '30 days' : '7 days'}</p>
    </div>
    <div class="head-actions">
      <SvMenubar {menus} onSelect={onMenu} ariaLabel="Dashboard toolbar" />
      <SvButton size="sm" variant="primary" onclick={refresh}>Refresh</SvButton>
    </div>
  </header>

  <div class="kpis">
    {#each kpis as k (k.label)}
      <SvCard>
        <SvStat label={k.label} value={k.value} delta={k.delta} trend={k.trend} />
        <div class="spark"><SvSparkline data={k.spark} type="area" color={k.color} width={220} height={38} /></div>
      </SvCard>
    {/each}
  </div>

  <div class="lower">
    <SvCard title="Fleet SLA">
      <div class="gauge">
        <SvGauge
          value={sla}
          min={95}
          max={100}
          unit="%"
          bands={[{ from: 95, to: 99, color: '#f59e0b' }, { from: 99, to: 99.9, color: '#eab308' }, { from: 99.9, to: 100, color: '#16a34a' }]}
        />
        <p class="muted">30-day rolling uptime across {services.length} services.</p>
      </div>
    </SvCard>

    <SvCard title="Services">
      <ul class="svc">
        <li class="svc-head"><span>Service</span><span>Status</span><span class="num">Uptime</span><span class="num">p95</span></li>
        {#each services as s (s.name)}
          <li>
            <SvHoverCard placement="right">
              {#snippet anchor()}<button class="svc-name">{s.name}</button>{/snippet}
              <div class="drill">
                <strong>{s.name}</strong>
                <div class="muted">Owner: {s.owner} team</div>
                <SvDivider />
                <div class="drill-row"><span>Uptime (30d)</span><b>{s.uptime}%</b></div>
                <div class="drill-row"><span>p95 latency</span><b>{s.p95 ? s.p95 + ' ms' : '-'}</b></div>
                <div class="drill-row"><span>On-call</span><b>{s.owner}</b></div>
              </div>
            </SvHoverCard>
            <span><SvBadge variant={badge(s.status)} dot>{s.status}</SvBadge></span>
            <span class="num tab">{s.uptime}%</span>
            <span class="num tab">{s.p95 ? s.p95 + ' ms' : '-'}</span>
          </li>
        {/each}
      </ul>
    </SvCard>
  </div>
</div>

<SvToaster position="bottom-right" />

<style>
  .wrap { padding: 20px; display: flex; flex-direction: column; gap: 16px; max-width: 940px; }
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .head h2 { margin: 0; font-size: 19px; font-weight: 700; }
  .head-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .muted { color: var(--sg-muted, #64748b); font-size: 13px; margin: 3px 0 0; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
  .spark { margin-top: 8px; }
  .lower { display: grid; grid-template-columns: 300px 1fr; gap: 16px; align-items: start; }
  .gauge { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .svc { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .svc li { display: grid; grid-template-columns: 1fr auto 80px 72px; gap: 12px; align-items: center; padding: 8px 2px; border-bottom: 1px solid var(--sg-border, #eef2f7); font-size: 13px; }
  .svc-head { font-size: 11.5px; font-weight: 600; color: var(--sg-muted, #64748b); text-transform: uppercase; letter-spacing: 0.03em; }
  .svc .num { text-align: end; }
  .tab { font-variant-numeric: tabular-nums; }
  .svc-name { background: none; border: 0; font: inherit; font-size: 13px; font-weight: 600; color: var(--sg-accent, #4f46e5); cursor: pointer; padding: 0; text-align: start; }
  .drill { min-width: 180px; }
  .drill strong { font-size: 14px; }
  .drill-row { display: flex; justify-content: space-between; gap: 16px; font-size: 12.5px; padding: 2px 0; }
</style>
