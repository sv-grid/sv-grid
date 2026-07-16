<script lang="ts">
  /**
   * Headless color input - <SvColorInput> is just a styled renderer over the
   * `createColorInput` core: hex normalization, the palette, the draft field and
   * open/close state, exposed as **prop-getters** you spread onto YOUR OWN markup
   * (the styled version adds a portal; here we render an inline panel). The same
   * core drives both, bound to one value.
   */
  import { SvColorInput, createColorInput } from '@svgrid/grid'

  let value = $state('#10b981')

  // The headless core - identical behavior, our own DOM (inline, no portal).
  const col = createColorInput({
    value: () => value,
    onChange: (hex) => (value = hex),
  })
</script>

<div class="wrap">
  <header>
    <h2>Headless color input</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createColorInput</code>
      drives both renders below; hex parsing, the palette and open/close state come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvColorInput&gt;</code></h3>
      <SvColorInput {value} onChange={(hex) => (value = hex)} ariaLabel="Brand color" />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <div class="picker">
        <button class="swatch" {...col.swatchProps()}>
          <span class="dot" style:background={col.normalized}></span>
          <span class="hex">{col.normalized}</span>
        </button>
        {#if col.popover.open}
          <div class="panel">
            <input class="hexfield" type="text" bind:value={col.hexDraft} spellcheck="false" aria-label="Hex value" onblur={col.commitHex} onkeydown={(e) => { if (e.key === 'Enter') col.commitHex() }} />
            <div class="grid">
              {#each col.palette as c (c)}
                <button class="chip" class:on={col.isActive(c)} style:background={c} {...col.chipProps(c)}></button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      <p class="hint">Click the swatch, pick a preset or type a hex - normalization + palette come from <code>createColorInput</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Value</h3>
    <div class="tags"><span class="tag"><span class="dot sm" style:background={value}></span>{value}</span></div>
  </aside>
</div>

<style>
  .wrap { padding: 20px; max-width: 900px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.55; max-width: 680px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .cols { display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start; }
  section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  /* Fully custom color render - nothing shared with SvColorInput but the core. */
  .picker { position: relative; display: inline-block; }
  .swatch {
    display: inline-flex; align-items: center; gap: 8px; padding: 0 12px; height: 38px; cursor: pointer;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); font: inherit;
  }
  .dot { width: 18px; height: 18px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.15); flex: none; }
  .dot.sm { width: 12px; height: 12px; border-radius: 4px; display: inline-block; vertical-align: -1px; margin-right: 6px; }
  .hex { font-variant-numeric: tabular-nums; text-transform: lowercase; }
  .panel {
    position: absolute; top: calc(100% + 6px); left: 0; z-index: 10; width: 208px; padding: 12px; display: flex; flex-direction: column; gap: 10px;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; box-shadow: 0 16px 48px -12px rgba(15,23,42,0.35);
  }
  .hexfield {
    height: 34px; padding: 0 10px; font: inherit; font-size: 13px; border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px; background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); outline: none;
  }
  .grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; }
  .chip { width: 100%; aspect-ratio: 1; border-radius: 5px; border: 1px solid rgba(0,0,0,0.12); cursor: pointer; padding: 0; }
  .chip.on { outline: 2px solid var(--sg-accent, #4f46e5); outline-offset: 1px; }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); font-variant-numeric: tabular-nums; }
</style>
