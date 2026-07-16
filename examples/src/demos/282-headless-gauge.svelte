<script lang="ts">
  /**
   * Headless gauge - the same headless-first split as the grid. A gauge is a display
   * control, so `createGauge` is a light core: value in, computed arc/needle geometry
   * out, plus a `rootProps()` with role="meter" + aria-valuenow. One core drives the
   * styled radial <SvGauge> AND a custom linear meter, both bound to a single value.
   */
  import { SvGauge, createGauge } from '@svgrid/grid'

  let value = $state(64)

  // The headless core - identical geometry + ARIA, our own SVG/DOM.
  const g = createGauge({
    value: () => value,
    min: () => 0,
    max: () => 100,
    sweep: () => 180,
    size: () => 160,
    thickness: () => 12,
    ariaLabel: () => 'Load',
  })
  const size = 160
</script>

<div class="wrap">
  <header>
    <h2>Headless gauge</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createGauge</code>
      computes the arc geometry and the <code>role="meter"</code> ARIA; both renders below read it.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvGauge&gt;</code></h3>
      <SvGauge {value} min={0} max={100} unit="%" ariaLabel="Load" />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <div class="meter" {...g.rootProps()}>
        <svg viewBox={`0 0 ${size} ${size / 2 + 16}`} width={size} height={size / 2 + 16}>
          <path d={g.arcPath(0, 100, g.r)} fill="none" stroke="var(--sg-border, #e2e8f0)" stroke-width="12" stroke-linecap="round" />
          <path d={g.arcPath(0, g.clamped, g.r)} fill="none" stroke="var(--sg-accent, #4f46e5)" stroke-width="12" stroke-linecap="round" />
          <line x1={g.cx} y1={g.cy} x2={g.needleEnd.x} y2={g.needleEnd.y} stroke="var(--sg-fg, #0f172a)" stroke-width="3" stroke-linecap="round" />
          <circle cx={g.cx} cy={g.cy} r="4" fill="var(--sg-fg, #0f172a)" />
        </svg>
        <div class="meter__val">{Math.round(g.clamped)}%</div>
      </div>
      <p class="hint">Same <code>arcPath</code> / needle math and meter ARIA - only the SVG is different.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Value</h3>
    <input type="range" min="0" max="100" bind:value aria-label="Set gauge value" />
    <div class="tags"><span class="tag">{value}%</span></div>
  </aside>
</div>

<style>
  .wrap { padding: 20px; max-width: 900px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.55; max-width: 680px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .cols { display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start; }
  section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  /* Fully custom gauge render - nothing shared with SvGauge but the core geometry. */
  .meter { position: relative; display: inline-flex; flex-direction: column; align-items: center; color: var(--sg-fg, #0f172a); }
  .meter svg { display: block; }
  .meter__val { margin-top: 2px; font-size: 20px; font-weight: 750; font-variant-numeric: tabular-nums; }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .readout input { width: 220px; accent-color: var(--sg-accent, #4f46e5); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); font-variant-numeric: tabular-nums; }
</style>
