<script lang="ts">
  /**
   * SvProgress (linear) and SvCircularProgress (ring): determinate + indeterminate,
   * color intents, sizes, labels, striped fill and a buffered track. WAI-ARIA
   * progressbar, theme-driven, reduced-motion aware.
   */
  import { SvProgress, SvCircularProgress, SvButton } from '@svgrid/grid'

  let live = $state(30)
  let running = $state(false)
  $effect(() => {
    if (!running) return
    const id = setInterval(() => {
      live = live >= 100 ? 0 : live + 3
    }, 200)
    return () => clearInterval(id)
  })
</script>

<div class="wrap">
  <header>
    <h2>Progress</h2>
    <p>Linear and circular progress - determinate, indeterminate, color intents, labels, striped and buffered.</p>
    <div class="ctrls">
      <SvButton size="sm" variant={running ? 'outline' : 'primary'} onclick={() => (running = !running)}>{running ? 'Pause' : 'Animate'}</SvButton>
      <span class="live">{live}%</span>
    </div>
  </header>

  <section class="block">
    <h3>Linear</h3>
    <div class="stack">
      <SvProgress value={live} showLabel />
      <SvProgress value={live} color="success" showLabel striped />
      <SvProgress value={72} buffer={88} showLabel />
      <SvProgress value={45} color="warning" size="lg" showLabel />
      <div class="row"><span class="tag">Indeterminate</span><SvProgress indeterminate /></div>
    </div>
  </section>

  <section class="block">
    <h3>Circular</h3>
    <div class="circles">
      <div class="tile"><SvCircularProgress value={live} showLabel /><span class="cap">Live</span></div>
      <div class="tile"><SvCircularProgress value={68} color="success" size={64} thickness={7} showLabel /><span class="cap">Success</span></div>
      <div class="tile"><SvCircularProgress value={90} color="danger" size={64} thickness={7} showLabel /><span class="cap">Danger</span></div>
      <div class="tile"><SvCircularProgress indeterminate size={40} /><span class="cap">Spinner</span></div>
      <div class="tile">
        <SvCircularProgress value={4} max={5} size={72} thickness={6} color="warning">
          <div class="ring-center"><strong>4</strong><em>/ 5</em></div>
        </SvCircularProgress>
        <span class="cap">Custom center</span>
      </div>
    </div>
  </section>
</div>

<style>
  .wrap { padding: 20px; max-width: 620px; display: flex; flex-direction: column; gap: 22px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .ctrls { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
  .live { font-size: 13px; font-weight: 600; color: var(--sg-muted, #64748b); font-variant-numeric: tabular-nums; }
  .block h3 { margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .stack { display: flex; flex-direction: column; gap: 14px; max-width: 380px; }
  .row { display: flex; align-items: center; gap: 12px; }
  .tag { flex: none; font-size: 11px; font-weight: 700; color: var(--sg-muted, #94a3b8); width: 92px; }
  .circles { display: flex; gap: 22px; flex-wrap: wrap; align-items: flex-start; }
  .tile { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .cap { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #94a3b8); }
  .ring-center { display: flex; flex-direction: column; align-items: center; line-height: 1; }
  .ring-center strong { font-size: 18px; }
  .ring-center em { font-size: 10px; font-style: normal; color: var(--sg-muted, #94a3b8); }
</style>
