<script lang="ts">
  /**
   * SvDockManager pop-out to a NATIVE window. Popping a panel out to a real OS
   * window is OFF by default; set `allowPopout` to add the pop-out button (the
   * diagonal-arrows icon on a tab). It opens the panel in a separate browser
   * window - drag it to a second monitor to keep an eye on live data while you
   * work in the main console; closing that window docks the panel back. Styles +
   * theme carry across, and it falls back to an in-app floating window if the
   * browser blocks the pop-up.
   *
   * This is exactly the case pop-out is for: a monitoring console where the
   * "Live log" and "Metrics" panels are useful on a second screen.
   */
  import { onDestroy } from 'svelte'
  import { SvDockManager, dockGroup, dockTabs, dockPane, type DockManagerState } from '@svgrid/grid'

  let workspace = $state<DockManagerState>({
    main: dockGroup('row', [
      dockTabs([dockPane('services', 'Services')]),
      dockTabs([dockPane('log', 'Live log')]),
      dockGroup('column', [
        dockTabs([dockPane('metrics', 'Metrics')]),
        dockTabs([dockPane('alerts', 'Alerts')]),
      ], [0.55, 0.45]),
    ], [0.22, 0.5, 0.28]),
    floating: [],
    autoHide: [],
  })

  const services = [
    { name: 'api-gateway', ok: true }, { name: 'auth', ok: true },
    { name: 'billing', ok: false }, { name: 'search', ok: true }, { name: 'workers', ok: true },
  ]
  const LINES = [
    'GET /v1/orders 200 12ms', 'POST /v1/auth/login 200 41ms', 'cache hit rate 98.2%',
    'billing: retrying webhook (attempt 2)', 'GET /v1/search 200 8ms', 'worker: job #4821 done',
    'GET /health 200 1ms', 'POST /v1/orders 201 63ms',
  ]
  let log = $state<string[]>(['boot: console ready'])
  let cpu = $state(37)
  let mem = $state(58)
  let rps = $state(240)

  const clock = () => new Date().toLocaleTimeString()
  const tick = setInterval(() => {
    const line = LINES[Math.floor(Math.random() * LINES.length)]
    log = [...log, `${clock()}  ${line}`].slice(-40)
    cpu = Math.max(8, Math.min(96, cpu + Math.round((Math.random() - 0.5) * 18)))
    mem = Math.max(20, Math.min(94, mem + Math.round((Math.random() - 0.5) * 8)))
    rps = Math.max(60, Math.min(600, rps + Math.round((Math.random() - 0.5) * 90)))
  }, 1500)
  onDestroy(() => clearInterval(tick))
</script>

<div class="wrap">
  <header>
    <h2>Docking: pop out to a new window</h2>
    <p>
      Pop-out is opt-in (<code>allowPopout</code>, off by default). Click a tab's
      pop-out button (&#10530;) to open that panel in its own OS window - drag
      <b>Live log</b> or <b>Metrics</b> to a second monitor and it keeps streaming;
      close the window and it docks back. (In this sandbox pop-ups may be blocked,
      so it falls back to an in-app floating window.)
    </p>
  </header>

  <div class="stage">
    <SvDockManager bind:workspace allowPopout>
      {#snippet pane(p)}
        {#if p.id === 'services'}
          <ul class="svc">{#each services as s (s.name)}
            <li><span class="dot" class:bad={!s.ok}></span>{s.name}</li>
          {/each}</ul>
        {:else if p.id === 'log'}
          <pre class="log">{log.join('\n')}</pre>
        {:else if p.id === 'metrics'}
          <div class="met">
            <div class="row"><span>CPU</span><div class="bar"><i style:width={`${cpu}%`}></i></div><b>{cpu}%</b></div>
            <div class="row"><span>Mem</span><div class="bar"><i style:width={`${mem}%`}></i></div><b>{mem}%</b></div>
            <div class="row"><span>Req/s</span><div class="bar"><i style:width={`${Math.round((rps / 600) * 100)}%`}></i></div><b>{rps}</b></div>
          </div>
        {:else if p.id === 'alerts'}
          <ul class="alerts">
            <li class="warn">billing webhook retrying</li>
            <li>disk 71% on node-3</li>
            <li>deploy v2.4.1 succeeded</li>
          </ul>
        {/if}
      {/snippet}
    </SvDockManager>
  </div>
</div>

<style>
  .wrap { padding: 20px; display: flex; flex-direction: column; gap: 14px; height: 100%; box-sizing: border-box; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13px; line-height: 1.6; }
  header code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .stage { flex: 1; min-height: 460px; }
  .svc { list-style: none; margin: 0; padding: 8px; font-size: 13px; display: flex; flex-direction: column; gap: 2px; }
  .svc li { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--sg-success, #16a34a); flex: none; }
  .dot.bad { background: var(--sg-danger, #dc2626); }
  .log { margin: 0; padding: 12px; font-size: 12px; line-height: 1.55; font-family: ui-monospace, monospace; color: var(--sg-muted, #475569); white-space: pre-wrap; overflow: auto; height: 100%; box-sizing: border-box; }
  .met { padding: 14px; display: flex; flex-direction: column; gap: 12px; font-size: 12.5px; }
  .met .row { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; gap: 8px; }
  .met .bar { height: 8px; border-radius: 999px; background: var(--sg-row-hover-bg, #eef2ff); overflow: hidden; }
  .met .bar i { display: block; height: 100%; background: var(--sg-accent, #2563eb); transition: width 0.4s ease; }
  .met b { text-align: right; font-variant-numeric: tabular-nums; }
  .alerts { list-style: none; margin: 0; padding: 8px; font-size: 12.5px; display: flex; flex-direction: column; gap: 4px; }
  .alerts li { padding: 6px 8px; border-radius: 6px; background: var(--sg-row-hover-bg, #f1f5f9); }
  .alerts li.warn { color: var(--sg-danger, #dc2626); }
</style>
