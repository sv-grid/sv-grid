<script lang="ts">
  /**
   * Headless radio group - the SvGrid UI kit is headless-first + render-ready,
   * just like the grid. `createRadioGroup` is the state machine behind
   * <SvRadioGroup>: single-select + roving tabindex + arrow-key navigation +
   * ARIA `radiogroup`, exposed as **prop-getters** you spread onto YOUR OWN
   * markup. Below, the same core drives the styled component AND a totally
   * custom render, both bound to one value.
   */
  import { SvRadioGroup, createRadioGroup, type RadioOption } from '@svgrid/grid'

  const options: RadioOption[] = [
    { value: 'card', label: 'Credit card' },
    { value: 'paypal', label: 'PayPal' },
    { value: 'wire', label: 'Wire transfer' },
    { value: 'crypto', label: 'Crypto', disabled: true },
  ]

  let value = $state<string | number | null>('card')

  // The headless core - identical behavior, our own DOM.
  const rg = createRadioGroup({
    options: () => options,
    value: () => value,
    onChange: (v) => (value = v),
  })
</script>

<div class="wrap">
  <header>
    <h2>Headless radio group</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createRadioGroup</code>
      drives both renders below; roving focus, keyboard and ARIA come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvRadioGroup&gt;</code></h3>
      <SvRadioGroup {options} {value} ariaLabel="Payment method" onChange={(v) => (value = v)} />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <div class="segset" {...rg.groupProps()}>
        {#each options as opt (opt.value)}
          <button
            class="seg"
            class:on={rg.isChecked(opt)}
            class:off={opt.disabled}
            {...rg.radioProps(opt)}
          >{opt.label}</button>
        {/each}
      </div>
      <p class="hint">Tab in, then arrow keys move + select, roving focus follows - all from <code>createRadioGroup</code>.</p>
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
  /* Fully custom render - nothing shared with SvRadioGroup but the core. */
  .segset {
    display: inline-flex; padding: 4px; gap: 4px; border-radius: 10px; outline: none;
    border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-row-hover-bg, #f1f5f9);
  }
  .seg {
    padding: 8px 14px; border-radius: 7px; font: inherit; font-size: 13px; font-weight: 550; cursor: pointer;
    border: 0; background: transparent; color: var(--sg-fg, #0f172a); transition: background 0.12s, color 0.12s;
  }
  .seg.on { background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff); }
  .seg.off { opacity: 0.4; cursor: not-allowed; }
  .seg:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #4f46e5)); outline-offset: 2px; }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); }
</style>
