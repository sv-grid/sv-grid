<script lang="ts">
  /**
   * Headless masked input - <SvMaskedInput> is just a styled renderer over the
   * `createMaskedInput` core: the pattern-mask engine (#=digit, A=letter,
   * *=alnum) exposed as **prop-getters** you spread onto YOUR OWN markup. The
   * same core drives the styled component AND a custom render, both bound to one
   * value. No re-implemented formatting.
   */
  import { SvMaskedInput, createMaskedInput } from '@svgrid/grid'

  const MASK = 'AA-####-A'
  let value = $state('')

  // The headless core - identical behavior, our own DOM.
  const mi = createMaskedInput({
    value: () => value,
    mask: () => MASK,
    onChange: (masked) => (value = masked),
  })
</script>

<div class="wrap">
  <header>
    <h2>Headless masked input</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createMaskedInput</code>
      drives both renders below; the mask formatting comes from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvMaskedInput&gt;</code></h3>
      <SvMaskedInput {value} mask={MASK} onChange={(masked) => (value = masked)} ariaLabel="Asset tag" />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <div class="boxed">
        <span class="tag-label">TAG</span>
        <input class="field" {...mi.inputProps()} />
        <span class="badge" class:ok={mi.complete}>{mi.complete ? 'complete' : 'partial'}</span>
      </div>
      <p class="hint">Type anything - only chars fitting <code>{MASK}</code> stick, literals auto-insert, all from <code>createMaskedInput</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Value</h3>
    {#if mi.raw}
      <div class="tags"><span class="tag">masked: {mi.masked}</span><span class="tag">raw: {mi.raw}</span></div>
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
  /* Fully custom masked render - nothing shared with SvMaskedInput but the core. */
  .boxed {
    display: inline-flex; align-items: center; gap: 8px; padding: 6px 8px 6px 12px; border-radius: 10px;
    border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-input-bg, #fff);
  }
  .tag-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: var(--sg-muted, #94a3b8); }
  .field {
    width: 130px; font: inherit; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase;
    border: 0; background: none; color: var(--sg-fg, #0f172a); outline: none; font-variant-numeric: tabular-nums;
  }
  .badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-muted, #64748b); }
  .badge.ok { background: color-mix(in srgb, var(--sg-accent, #4f46e5) 16%, transparent); color: var(--sg-accent, #4f46e5); }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); font-variant-numeric: tabular-nums; }
  .empty { color: var(--sg-muted, #94a3b8); font-style: italic; margin: 0; }
</style>
