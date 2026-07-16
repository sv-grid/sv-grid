<script lang="ts">
  /**
   * Headless slider - the same headless-first split as the grid. `createSlider` is
   * the runes state machine behind <SvSlider>: it owns the value<->position math,
   * stepping, keyboard and drag state, and exposes **prop-getters** you spread onto
   * YOUR OWN markup. The core never touches the DOM: the renderer measures the track
   * and passes the rect IN. One core drives the styled <SvSlider> AND a custom bar,
   * both bound to a single number.
   */
  import { SvSlider, createSlider } from '@svgrid/grid'

  let value = $state(40)

  // The headless core - identical behavior, our own DOM.
  const s = createSlider({
    value: () => value,
    onChange: (v) => (value = v as number),
    min: () => 0,
    max: () => 100,
    step: () => 1,
    ariaLabel: () => 'Volume',
  })

  // The rect is measured here (a DOM concern) and passed INTO the core.
  let barEl: HTMLDivElement | null = null
  function down(e: PointerEvent) {
    s.pointerDown({ x: e.clientX, y: e.clientY }, barEl!.getBoundingClientRect())
    barEl?.setPointerCapture(e.pointerId)
  }
  function move(e: PointerEvent) {
    if (!s.dragging) return
    s.setFromPointer({ x: e.clientX, y: e.clientY }, barEl!.getBoundingClientRect())
  }
  function up(e: PointerEvent) { if (s.dragging) { s.endDrag(); barEl?.releasePointerCapture(e.pointerId) } }
</script>

<div class="wrap">
  <header>
    <h2>Headless slider</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createSlider</code>
      drives both renders; the value math, keyboard and drag state come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvSlider&gt;</code></h3>
      <SvSlider {value} min={0} max={100} showValue ariaLabel="Volume" onChange={(v) => (value = v)} />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="bar" bind:this={barEl} {...s.trackProps()} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
        <div class="bar__fill" style:width={`${s.percentOf(s.hi)}%`}></div>
        <div class="bar__thumb" style:left={`${s.percentOf(s.hi)}%`} {...s.thumbProps(0)}></div>
      </div>
      <p class="hint">Click or drag the bar, or focus the knob and use arrows / Home / End - all from <code>createSlider</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Value</h3>
    <div class="tags"><span class="tag">{value}</span></div>
  </aside>
</div>

<style>
  .wrap { padding: 20px; max-width: 900px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.55; max-width: 680px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .cols { display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start; }
  section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  /* Fully custom slider render - nothing shared with SvSlider but the core. */
  .bar { position: relative; width: 260px; height: 14px; border-radius: 999px; background: var(--sg-border, #e2e8f0); cursor: pointer; touch-action: none; margin-top: 8px; }
  .bar__fill { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: var(--sg-accent, #4f46e5); }
  .bar__thumb { position: absolute; top: 50%; width: 22px; height: 22px; border-radius: 50%; background: var(--sg-input-bg, #fff); border: 3px solid var(--sg-accent, #4f46e5); transform: translate(-50%, -50%); box-shadow: 0 1px 4px rgba(0,0,0,0.25); touch-action: none; }
  .bar__thumb:focus-visible { outline: 2px solid var(--sg-accent, #4f46e5); outline-offset: 2px; }
  .hint { margin: 12px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); font-variant-numeric: tabular-nums; }
</style>
