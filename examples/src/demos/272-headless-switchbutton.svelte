<script lang="ts">
  /**
   * Headless switch button - the SvGrid UI kit is headless-first + render-ready,
   * just like the grid. `createSwitch` is the state machine behind
   * <SvSwitchButton>: on/off + full keyboard + ARIA `switch`, exposed as
   * **prop-getters** you spread onto YOUR OWN markup. Below, the same core
   * drives the styled component AND a totally custom render, bound to one value.
   */
  import { SvSwitchButton, createSwitch } from '@svgrid/grid'

  let value = $state(false)

  // The headless core - identical behavior, our own DOM.
  const sw = createSwitch({
    checked: () => value,
    onChange: (v) => (value = v),
  })
</script>

<div class="wrap">
  <header>
    <h2>Headless switch button</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createSwitch</code>
      drives both renders below; keyboard (Space, ArrowLeft/Right) and ARIA come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvSwitchButton&gt;</code></h3>
      <SvSwitchButton checked={value} ariaLabel="Notifications" onLabel="On" offLabel="Off" onChange={(v) => (value = v)} />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <button class="slot" class:on={sw.checked} {...sw.switchProps()}>
        <span class="knob"></span>
      </button>
      <p class="hint">Tab in, then Space toggles, ArrowRight/Left force on/off - all from <code>createSwitch</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Checked</h3>
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
  /* Fully custom render - nothing shared with SvSwitchButton but the core. */
  .slot {
    width: 60px; height: 30px; border-radius: 999px; padding: 3px; border: 0; cursor: pointer;
    background: var(--sg-border, #cbd5e1); display: inline-flex; align-items: center; transition: background 0.16s;
  }
  .slot .knob {
    width: 24px; height: 24px; border-radius: 50%; background: var(--sg-input-bg, #fff);
    box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: transform 0.16s;
  }
  .slot.on { background: var(--sg-accent, #4f46e5); }
  .slot.on .knob { transform: translateX(30px); }
  .slot:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: 2px; }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); }
</style>
