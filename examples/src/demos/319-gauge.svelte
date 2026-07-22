<script lang="ts">
  /**
   * SvGauge - a production KPI dashboard: radial gauges with threshold bands and
   * a live-updating value. Copy-paste ready.
   */
  import { SvGauge } from '@svgrid/grid'

  let cpu = $state(62)
  let sla = $state(99.2)
  const perfBands = [
    { from: 0, to: 60, color: '#22c55e' },
    { from: 60, to: 85, color: '#f59e0b' },
    { from: 85, to: 100, color: '#ef4444' },
  ]

  // A gentle live wobble so the needle animates (deterministic, no Math.random).
  let t = 0
  $effect(() => {
    const id = setInterval(() => { t += 1; cpu = Math.round(60 + Math.sin(t / 3) * 18) }, 900)
    return () => clearInterval(id)
  })
</script>

<div class="wrap">
  <header>
    <h2>Gauge</h2>
    <p>A radial arc gauge (role=meter) with colored threshold bands and a needle - dashboards, monitors, KPIs.</p>
  </header>

  <div class="tiles">
    <div class="tile">
      <SvGauge value={cpu} bands={perfBands} unit="%" size={150} />
      <span class="cap">CPU load</span>
    </div>
    <div class="tile">
      <SvGauge value={sla} min={95} max={100} unit="%" label={`${sla}%`} size={150} sweep={220} />
      <span class="cap">Uptime SLA</span>
    </div>
    <div class="tile">
      <SvGauge value={340} min={0} max={500} label="340" unit=" GB" size={150} needle={false} />
      <span class="cap">Storage used</span>
    </div>
  </div>
</div>

<style>
  .wrap { padding: 20px; max-width: 640px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
  .tile { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; }
  .cap { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
</style>
