<script lang="ts">
  /**
   * Headless combobox - <SvComboBox> is one styled renderer over the framework-
   * free-in-spirit `createCombobox` core: type-to-filter, roving active index,
   * full keyboard, unmatched-text revert and ARIA, all exposed as prop-getters
   * you spread onto YOUR OWN markup. Below, the same core drives the styled
   * component AND a totally custom render, both bound to one value.
   */
  import { SvComboBox, createCombobox, type ListOption } from '@svgrid/grid'

  const options: ListOption[] = [
    { value: 'svelte', label: 'Svelte' },
    { value: 'react', label: 'React' },
    { value: 'vue', label: 'Vue' },
    { value: 'solid', label: 'Solid' },
    { value: 'angular', label: 'Angular', disabled: true },
    { value: 'qwik', label: 'Qwik' },
  ]

  let value = $state<string | number | null>('svelte')

  let inputEl = $state<HTMLInputElement | null>(null)
  const cb = createCombobox({
    options: () => options,
    value: () => value,
    onChange: (v) => (value = v),
    focusInput: () => inputEl?.focus(),
    blurInput: () => inputEl?.blur(),
  })
</script>

<div class="wrap">
  <header>
    <h2>Combobox - headless</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createCombobox</code>
      drives both renders below; filtering, keyboard, selection and ARIA come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvComboBox&gt;</code></h3>
      <SvComboBox {options} {value} ariaLabel="Framework" onChange={(v) => (value = v)} />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <div class="field">
        <input bind:this={inputEl} class="input" placeholder="Type to filter…" {...cb.inputProps()} />
        {#if cb.open}
          <div class="menu" {...cb.listboxProps()}>
            {#each cb.filtered as opt, i (opt.value)}
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
              <div class="opt" class:active={cb.isActive(i)} class:on={cb.isSelected(opt)} class:off={opt.disabled} {...cb.optionProps(i)}>{opt.label}</div>
            {:else}
              <div class="empty">No matches</div>
            {/each}
          </div>
        {/if}
      </div>
      <p class="hint">Type to filter, arrow keys move the ring, Enter picks - all from <code>createCombobox</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Value</h3>
    {#if value}
      <span class="tag">{value}</span>
    {:else}
      <p class="empty">Nothing selected</p>
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
  /* Fully custom combobox render - nothing shared with SvComboBox but the core. */
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
  .opt.on { color: var(--sg-accent, #4f46e5); font-weight: 600; }
  .opt.off { opacity: 0.4; cursor: not-allowed; }
  .empty { padding: 8px 10px; color: var(--sg-muted, #94a3b8); font-size: 13px; font-style: italic; margin: 0; }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); }
</style>
