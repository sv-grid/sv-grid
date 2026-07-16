<script lang="ts">
  /**
   * Range & feedback - SvSlider (single + range, ticks, keyboard) and SvGauge
   * (radial arc with threshold bands). Theme-driven; standalone or in-grid.
   */
  import { SvSlider, SvGauge } from '@svgrid/grid'

  let volume = $state(60)
  let priceRange = $state<[number, number]>([200, 750])
  let temp = $state(72)

  const bands = [
    { from: 0, to: 40, color: '#3b82f6' },
    { from: 40, to: 75, color: '#16a34a' },
    { from: 75, to: 100, color: '#dc2626' },
  ]
</script>

<div class="wrap">
  <header>
    <h2>Range &amp; feedback</h2>
    <p>Value controls from <code>@svgrid/grid</code>: a slider (single or dual-thumb range) and a radial gauge with threshold bands.</p>
  </header>

  <section>
    <h3>SvSlider</h3>
    <div class="sliders">
      <div class="s">
        <label>Volume <strong>{volume}</strong></label>
        <SvSlider value={volume} onChange={(v) => (volume = v)} showValue ticks={5} />
      </div>
      <div class="s">
        <label>Price range <strong>${priceRange[0]} – ${priceRange[1]}</strong></label>
        <SvSlider value={priceRange} range min={0} max={1000} step={50} onChange={(v) => (priceRange = v)} showValue />
      </div>
      <div class="s vert">
        <label>Vertical</label>
        <SvSlider value={temp} onChange={(v) => (temp = v)} orientation="vertical" />
      </div>
    </div>
  </section>

  <section>
    <h3>SvGauge</h3>
    <div class="gauges">
      <div class="g">
        <SvGauge value={temp} unit="°" />
        <span class="cap">accent fill</span>
      </div>
      <div class="g">
        <SvGauge value={temp} {bands} label={`${temp}%`} />
        <span class="cap">threshold bands</span>
      </div>
      <div class="g">
        <SvGauge value={volume} sweep={180} size={160} needle={false} unit="%" />
        <span class="cap">half sweep, no needle</span>
      </div>
    </div>
    <p class="muted">The gauges track the slider values above - drag Volume / Vertical to watch them move.</p>
  </section>
</div>

<style>
  .wrap { padding: 22px; max-width: 820px; display: flex; flex-direction: column; gap: 24px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; max-width: 620px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  section h3 { margin: 0 0 12px; font-size: 14px; font-weight: 650; }
  .sliders { display: flex; gap: 40px; flex-wrap: wrap; align-items: flex-start; }
  .s { display: flex; flex-direction: column; gap: 8px; }
  .s label { font-size: 12.5px; font-weight: 600; }
  .s.vert { align-items: center; }
  .gauges { display: flex; gap: 32px; flex-wrap: wrap; }
  .g { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .cap { font-size: 11.5px; color: var(--sg-muted, #94a3b8); }
  .muted { margin: 14px 0 0; font-size: 12.5px; color: var(--sg-muted, #94a3b8); }
</style>
