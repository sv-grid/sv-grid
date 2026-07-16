<script lang="ts">
  /**
   * Headless phone input - <SvPhoneInput> is just a styled renderer over the
   * `createPhoneInput` core: country dial-code + national-number state and E.164
   * parsing, exposed as **prop-getters** you spread onto YOUR OWN markup. The same
   * core drives the styled component AND a custom render, both bound to one value.
   */
  import { SvPhoneInput, createPhoneInput, COUNTRIES, flagEmoji } from '@svgrid/grid'

  let value = $state('')

  // The headless core - identical behavior, our own DOM.
  const ph = createPhoneInput({
    value: () => value,
    country: () => 'GB',
    onChange: (v) => (value = v),
  })
</script>

<div class="wrap">
  <header>
    <h2>Headless phone input</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createPhoneInput</code>
      drives both renders below; the dial-code state and E.164 parsing come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvPhoneInput&gt;</code></h3>
      <SvPhoneInput {value} country="GB" onChange={(v) => (value = v)} ariaLabel="Contact number" />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <div class="row">
        <label class="picker">
          <span class="flag">{ph.flag}</span>
          <span class="dial">{ph.dial}</span>
          <select {...ph.selectProps()}>
            {#each COUNTRIES as c (c.code)}
              <option value={c.code}>{flagEmoji(c.code)} {c.name} ({c.dial})</option>
            {/each}
          </select>
        </label>
        <input class="field" {...ph.inputProps()} />
      </div>
      <p class="hint">Pick a country, type the national number - the dial code + formatting come from <code>createPhoneInput</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Value</h3>
    {#if value}
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
  /* Fully custom phone render - nothing shared with SvPhoneInput but the core. */
  .row { display: inline-flex; align-items: center; gap: 8px; }
  .picker {
    position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; height: 38px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; background: var(--sg-input-bg, #fff); cursor: pointer;
  }
  .flag { font-size: 16px; }
  .dial { font-size: 14px; font-weight: 700; color: var(--sg-fg, #0f172a); }
  .picker select { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .field {
    width: 170px; font: inherit; font-size: 14px; padding: 0 12px; height: 38px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); outline: none;
  }
  .field:focus-visible { border-color: var(--sg-accent, #4f46e5); box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-accent, #4f46e5) 30%, transparent); }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); font-variant-numeric: tabular-nums; }
  .empty { color: var(--sg-muted, #94a3b8); font-style: italic; margin: 0; }
</style>
