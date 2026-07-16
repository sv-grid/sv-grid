<script lang="ts">
  /**
   * Headless number input - <SvNumberInput> is just a styled renderer over the
   * framework-free-in-spirit `createNumberInput` core: parse / format / clamp,
   * the spinner and full keyboard, all exposed as **prop-getters** you spread
   * onto YOUR OWN markup. Below, the same core drives the styled component AND a
   * totally custom stepper render, both bound to one value. No forked logic.
   */
  import { SvNumberInput, createNumberInput } from '@svgrid/grid'

  let value = $state<number | null>(1250)

  // The headless core - identical behavior, our own DOM.
  const num = createNumberInput({
    value: () => value,
    onChange: (v) => (value = v),
    min: () => 0,
    max: () => 9999,
    step: () => 50,
    grouping: () => true,
    prefix: () => '$',
  })
</script>

<div class="wrap">
  <header>
    <h2>Headless number input</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createNumberInput</code>
      drives both renders below; parsing, clamping, the spinner and keyboard come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvNumberInput&gt;</code></h3>
      <SvNumberInput {value} onChange={(v) => (value = v)} min={0} max={9999} step={50} grouping prefix="$" ariaLabel="Budget" />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <div class="stepper">
        <button class="step" {...num.decrementProps()}>-</button>
        <input class="field" {...num.inputProps()} />
        <button class="step" {...num.incrementProps()}>+</button>
      </div>
      <p class="hint">Arrow keys and the +/- buttons step by 50, blur re-formats with grouping - all from <code>createNumberInput</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Value</h3>
    {#if value != null}
      <div class="tags"><span class="tag">{value}</span></div>
    {:else}
      <p class="empty">Empty</p>
    {/if}
  </aside>
</div>

<style>
  .wrap { padding: 20px; max-width: 900px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.55; max-width: 680px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .cols { display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start; }
  section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  /* Fully custom stepper render - nothing shared with SvNumberInput but the core. */
  .stepper { display: inline-flex; align-items: stretch; gap: 6px; }
  .field {
    width: 120px; text-align: center; font: inherit; font-size: 14px; padding: 0 10px; height: 38px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); outline: none;
  }
  .field:focus-visible { border-color: var(--sg-accent, #4f46e5); box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-accent, #4f46e5) 30%, transparent); }
  .step {
    width: 38px; height: 38px; border-radius: 10px; font-size: 18px; font-weight: 600; cursor: pointer;
    border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  .step:hover:not(:disabled) { border-color: var(--sg-accent, #4f46e5); color: var(--sg-accent, #4f46e5); }
  .step:disabled { opacity: 0.4; cursor: not-allowed; }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); font-variant-numeric: tabular-nums; }
  .empty { color: var(--sg-muted, #94a3b8); font-style: italic; margin: 0; }
</style>
