<script lang="ts">
  /**
   * Headless autocomplete - <SvAutoComplete> is one styled renderer over the
   * `createAutocomplete` core: free text with a live-filtered suggestion list
   * (any typed value is kept; suggestions are shortcuts), roving active index +
   * keyboard + ARIA, exposed as prop-getters you spread onto YOUR OWN markup.
   * The same core drives the styled component AND a custom render, one value.
   */
  import { SvAutoComplete, createAutocomplete } from '@svgrid/grid'

  const suggestions = ['Amsterdam', 'Berlin', 'Copenhagen', 'Dublin', 'Edinburgh', 'Florence', 'Geneva', 'Helsinki', 'Lisbon', 'Madrid', 'Oslo', 'Prague']

  let value = $state('')

  let inputEl = $state<HTMLInputElement | null>(null)
  const ac = createAutocomplete({
    value: () => value,
    onChange: (v) => (value = v),
    suggestions: () => suggestions,
    focusInput: () => inputEl?.focus(),
  })
</script>

<div class="wrap">
  <header>
    <h2>Autocomplete - headless</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createAutocomplete</code>
      drives both renders below; filtering, keyboard and ARIA come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvAutoComplete&gt;</code></h3>
      <SvAutoComplete {value} {suggestions} placeholder="Type a city…" ariaLabel="City" onChange={(v) => (value = v)} />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <div class="field">
        <input bind:this={inputEl} class="input" placeholder="Type a city…" {...ac.inputProps()} />
        {#if ac.open}
          <div class="menu" {...ac.listboxProps()}>
            {#each ac.filtered as opt, i (opt.value)}
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
              <div class="opt" class:active={ac.isActive(i)} {...ac.optionProps(i)}>{opt.label}</div>
            {/each}
          </div>
        {/if}
      </div>
      <p class="hint">Any text is kept; suggestions are shortcuts. Arrows move, Enter fills, Esc closes - all from <code>createAutocomplete</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Value</h3>
    {#if value}
      <span class="tag">{value}</span>
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
  /* Fully custom autocomplete render - nothing shared with SvAutoComplete but the core. */
  .field { position: relative; width: 240px; }
  .input {
    box-sizing: border-box; width: 100%; height: 38px; padding: 0 12px; font: inherit; font-size: 13px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); outline: none;
  }
  .input:focus { border-color: var(--sg-accent, #4f46e5); box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-accent, #4f46e5) 30%, transparent); }
  .menu {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 5; padding: 4px;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px;
    box-shadow: 0 16px 40px -14px rgba(15,23,42,0.35);
  }
  .opt { padding: 8px 10px; border-radius: 7px; font-size: 13px; cursor: pointer; }
  .opt.active { background: var(--sg-row-hover-bg, #f1f5f9); }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); }
  .empty { color: var(--sg-muted, #94a3b8); font-style: italic; margin: 0; }
</style>
