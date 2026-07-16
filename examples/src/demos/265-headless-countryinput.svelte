<script lang="ts">
  /**
   * Headless country input - <SvCountryInput> is one styled renderer over the
   * `createCountryInput` core: searchable picker (by name, dial code or ISO
   * code), roving active index + keyboard + ARIA, exposed as prop-getters you
   * spread onto YOUR OWN markup. The same core drives the styled component AND a
   * custom render, both bound to one ISO alpha-2 code.
   */
  import { SvCountryInput, createCountryInput, flagEmoji } from '@svgrid/grid'

  let value = $state<string | null>('DE')

  let triggerEl = $state<HTMLButtonElement | null>(null)
  let searchEl = $state<HTMLInputElement | null>(null)
  const ci = createCountryInput({
    value: () => value,
    onChange: (c) => (value = c),
    focusTrigger: () => triggerEl?.focus(),
  })

  // Focusing the search box on open is a render concern, so it lives here.
  $effect(() => {
    if (ci.open) queueMicrotask(() => searchEl?.focus())
  })
</script>

<div class="wrap">
  <header>
    <h2>Country input - headless</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createCountryInput</code>
      drives both renders below; search, keyboard, selection and ARIA come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvCountryInput&gt;</code></h3>
      <SvCountryInput {value} showDial ariaLabel="Country" onChange={(c) => (value = c)} />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <div class="field">
        <button bind:this={triggerEl} class="trigger" {...ci.triggerProps()}>
          {#if ci.selected}
            <span class="flag" aria-hidden="true">{flagEmoji(ci.selected.code)}</span>
            <span class="name">{ci.selected.name}</span>
            <span class="dial">{ci.selected.dial}</span>
          {:else}
            <span class="ph">Select country…</span>
          {/if}
          <span class="caret" aria-hidden="true">{ci.open ? '▲' : '▼'}</span>
        </button>
        {#if ci.open}
          <div class="menu">
            <input bind:this={searchEl} class="search" placeholder="Search countries…" {...ci.searchProps()} />
            <div class="list" {...ci.listboxProps()}>
              {#each ci.filtered as c, i (c.code)}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
                <div class="opt" class:active={ci.isActive(i)} class:on={ci.isSelected(c.code)} {...ci.optionProps(i)}>
                  <span class="flag" aria-hidden="true">{flagEmoji(c.code)}</span>
                  <span class="name">{c.name}</span>
                  <span class="dial">{c.dial}</span>
                </div>
              {:else}
                <div class="empty">No matches</div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      <p class="hint">Open, type to search by name / dial / code, arrows move, Enter picks - all from <code>createCountryInput</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Value</h3>
    {#if value}
      <span class="tag">{flagEmoji(value)} {value}</span>
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
  /* Fully custom country render - nothing shared with SvCountryInput but the core. */
  .field { position: relative; width: 260px; }
  .trigger {
    display: flex; align-items: center; gap: 8px;
    box-sizing: border-box; width: 100%; height: 38px; padding: 0 12px; font: inherit; font-size: 13px; text-align: left;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; cursor: pointer;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  .trigger:focus-visible { outline: none; border-color: var(--sg-accent, #4f46e5); box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-accent, #4f46e5) 30%, transparent); }
  .flag { font-size: 16px; }
  .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ph { flex: 1; color: var(--sg-muted, #94a3b8); }
  .dial { color: var(--sg-muted, #64748b); font-size: 12px; }
  .caret { font-size: 9px; color: var(--sg-muted, #94a3b8); }
  .menu {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 5; display: flex; flex-direction: column; max-height: 300px; padding: 6px;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px;
    box-shadow: 0 16px 40px -14px rgba(15,23,42,0.35);
  }
  .search {
    height: 32px; margin-bottom: 4px; padding: 0 10px; font: inherit; font-size: 13px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 7px; background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a); outline: none;
  }
  .list { overflow-y: auto; }
  .opt { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 6px; font-size: 13px; cursor: pointer; }
  .opt.active { background: var(--sg-row-hover-bg, #f1f5f9); }
  .opt.on { color: var(--sg-accent, #4f46e5); font-weight: 600; }
  .empty { padding: 8px 10px; color: var(--sg-muted, #94a3b8); font-size: 13px; font-style: italic; }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); }
  .empty { color: var(--sg-muted, #94a3b8); font-style: italic; margin: 0; }
</style>
