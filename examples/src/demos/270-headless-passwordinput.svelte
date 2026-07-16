<script lang="ts">
  /**
   * Headless password input - <SvPasswordInput> is just a styled renderer over
   * the `createPasswordInput` core: the reveal toggle + a 4-level strength
   * heuristic, exposed as **prop-getters** you spread onto YOUR OWN markup. The
   * same core drives the styled component AND a custom render, both bound to one
   * value.
   */
  import { SvPasswordInput, createPasswordInput } from '@svgrid/grid'

  let value = $state('')

  // The headless core - identical behavior, our own DOM.
  const pw = createPasswordInput({
    value: () => value,
    onChange: (v) => (value = v),
  })
</script>

<div class="wrap">
  <header>
    <h2>Headless password input</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createPasswordInput</code>
      drives both renders below; the reveal toggle and strength score come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvPasswordInput&gt;</code></h3>
      <SvPasswordInput {value} onChange={(v) => (value = v)} showStrength ariaLabel="Password" />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <div class="field">
        <input class="input" {...pw.inputProps()} placeholder="Passphrase" />
        <button class="reveal" {...pw.toggleProps()}>{pw.revealed ? 'Hide' : 'Show'}</button>
      </div>
      <div class="meter">
        {#each Array(4) as _, i (i)}
          <span class="bar lvl{pw.strength}" class:on={i < pw.strength}></span>
        {/each}
        <span class="label lvl{pw.strength}">{pw.strengthLabel}</span>
      </div>
      <p class="hint">Type - the reveal toggle and 0-4 strength score come from <code>createPasswordInput</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Value</h3>
    {#if value}
      <div class="tags"><span class="tag">{pw.revealed ? value : '•'.repeat(value.length)}</span><span class="tag">{pw.strengthLabel}</span></div>
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
  /* Fully custom password render - nothing shared with SvPasswordInput but the core. */
  .field {
    display: inline-flex; align-items: stretch; width: 240px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; background: var(--sg-input-bg, #fff); overflow: hidden;
  }
  .field:focus-within { border-color: var(--sg-accent, #4f46e5); box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-accent, #4f46e5) 30%, transparent); }
  .input { flex: 1; min-width: 0; border: 0; background: none; outline: none; color: var(--sg-fg, #0f172a); font: inherit; font-size: 14px; padding: 0 12px; height: 38px; }
  .reveal { border: 0; border-left: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-muted, #64748b); font-size: 12px; font-weight: 600; padding: 0 12px; cursor: pointer; }
  .reveal:hover { color: var(--sg-accent, #4f46e5); }
  .meter { display: flex; align-items: center; gap: 4px; margin-top: 10px; width: 240px; }
  .bar { flex: 1; height: 5px; border-radius: 3px; background: var(--sg-border, #e2e8f0); transition: background 0.15s; }
  .bar.on.lvl1 { background: #dc2626; }
  .bar.on.lvl2 { background: #f59e0b; }
  .bar.on.lvl3 { background: #eab308; }
  .bar.on.lvl4 { background: #16a34a; }
  .label { margin-left: 8px; font-size: 11px; font-weight: 700; color: var(--sg-muted, #94a3b8); min-width: 46px; }
  .label.lvl1 { color: #dc2626; }
  .label.lvl4 { color: #16a34a; }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); font-variant-numeric: tabular-nums; }
  .empty { color: var(--sg-muted, #94a3b8); font-style: italic; margin: 0; }
</style>
