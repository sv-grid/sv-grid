<script lang="ts">
  /**
   * Headless checkbox - the SvGrid UI kit is headless-first + render-ready, just
   * like the grid. `createCheckbox` is the state machine behind <SvCheckBox>:
   * checked / unchecked / indeterminate + ARIA (`aria-checked="mixed"`), exposed
   * as **prop-getters** you spread onto YOUR OWN markup. Below, the same core
   * drives the styled component AND a totally custom render, bound to one value.
   */
  import { SvCheckBox, createCheckbox } from '@svgrid/grid'

  let value = $state(false)

  // The headless core - identical behavior, our own DOM.
  const cb = createCheckbox({
    checked: () => value,
    onChange: (v) => (value = v),
    ariaLabel: () => 'Accept terms',
  })
</script>

<div class="wrap">
  <header>
    <h2>Headless checkbox</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createCheckbox</code>
      drives both renders below; the toggle logic and ARIA come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvCheckBox&gt;</code></h3>
      <SvCheckBox checked={value} onChange={(v) => (value = v)}>Accept terms</SvCheckBox>
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <button class="card" class:on={cb.checked} {...cb.boxProps()}>
        <span class="mark">{cb.checked ? '✓' : ''}</span>
        <span class="txt">Accept terms</span>
      </button>
      <p class="hint">Tab in, then Space/Enter toggles - all from <code>createCheckbox</code>.</p>
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
  /* Fully custom render - nothing shared with SvCheckBox but the core. */
  .card {
    display: inline-flex; align-items: center; gap: 10px; padding: 10px 16px; border-radius: 10px;
    font: inherit; font-size: 13px; font-weight: 550; cursor: pointer;
    border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    transition: border-color 0.12s, background 0.12s;
  }
  .card .mark {
    width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; font-size: 13px;
    border: 1.5px solid var(--sg-border, #cbd5e1); color: var(--sg-on-accent, #fff); transition: background 0.12s, border-color 0.12s;
  }
  .card.on { border-color: var(--sg-accent, #4f46e5); }
  .card.on .mark { background: var(--sg-accent, #4f46e5); border-color: transparent; }
  .card:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: 2px; }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); }
</style>
