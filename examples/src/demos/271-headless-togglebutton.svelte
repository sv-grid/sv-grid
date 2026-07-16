<script lang="ts">
  /**
   * Headless toggle button - the SvGrid UI kit is headless-first + render-ready,
   * just like the grid. `createToggle` is the state machine behind
   * <SvToggleButton>: pressed on/off + ARIA, exposed as **prop-getters** you
   * spread onto YOUR OWN markup. Below, the same core drives the styled
   * component AND a totally custom render, both bound to one value.
   */
  import { SvToggleButton, createToggle } from '@svgrid/grid'

  let value = $state(false)

  // The headless core - identical behavior, our own DOM.
  const t = createToggle({
    pressed: () => value,
    onChange: (v) => (value = v),
  })
</script>

<div class="wrap">
  <header>
    <h2>Headless toggle button</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createToggle</code>
      drives both renders below; the pressed state and ARIA come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvToggleButton&gt;</code></h3>
      <SvToggleButton pressed={value} ariaLabel="Bold" onChange={(v) => (value = v)}>Bold</SvToggleButton>
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <button class="pill" class:on={t.pressed} {...t.buttonProps()}>
        <span class="dot"></span>{t.pressed ? 'On' : 'Off'}
      </button>
      <p class="hint">Tab in, then Space/Enter flips the state - all from <code>createToggle</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Pressed</h3>
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
  /* Fully custom render - nothing shared with SvToggleButton but the core. */
  .pill {
    display: inline-flex; align-items: center; gap: 8px; padding: 9px 18px; border-radius: 999px;
    font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
    border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }
  .pill .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--sg-border, #cbd5e1); transition: background 0.12s; }
  .pill.on { background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff); border-color: transparent; }
  .pill.on .dot { background: var(--sg-on-accent, #fff); }
  .pill:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: 2px; }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); }
</style>
