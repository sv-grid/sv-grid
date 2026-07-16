<script lang="ts">
  /**
   * Headless dropdown list - <SvDropDownList> is one styled renderer over the
   * `createDropdownList` core: open/close, roving active index over enabled
   * options, full keyboard and ARIA, exposed as prop-getters you spread onto YOUR
   * OWN markup. The same core drives the styled component AND a custom render,
   * both bound to one value.
   */
  import { SvDropDownList, createDropdownList, type ListOption } from '@svgrid/grid'

  const options: ListOption[] = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'archived', label: 'Archived', disabled: true },
  ]

  let value = $state<string | number | null>('normal')

  let triggerEl = $state<HTMLButtonElement | null>(null)
  const dd = createDropdownList({
    options: () => options,
    value: () => value,
    onChange: (v) => (value = v),
    focusTrigger: () => triggerEl?.focus(),
  })
</script>

<div class="wrap">
  <header>
    <h2>Dropdown list - headless</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createDropdownList</code>
      drives both renders below; open/close, keyboard, selection and ARIA come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvDropDownList&gt;</code></h3>
      <SvDropDownList {options} {value} ariaLabel="Priority" onChange={(v) => (value = v)} />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <div class="field">
        <button bind:this={triggerEl} class="trigger" {...dd.triggerProps()}>
          <span>{dd.selected?.label ?? 'Select priority…'}</span>
          <span class="caret" aria-hidden="true">{dd.open ? '▲' : '▼'}</span>
        </button>
        {#if dd.open}
          <div class="menu" {...dd.listboxProps()}>
            {#each options as opt, i (opt.value)}
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
              <div class="opt" class:active={dd.isActive(i)} class:on={dd.isSelected(opt)} class:off={opt.disabled} {...dd.optionProps(i)}>{opt.label}</div>
            {/each}
          </div>
        {/if}
      </div>
      <p class="hint">Enter/Space or click to open, arrows move, Enter picks, Esc closes - all from <code>createDropdownList</code>.</p>
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
  /* Fully custom dropdown render - nothing shared with SvDropDownList but the core. */
  .field { position: relative; width: 240px; }
  .trigger {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    box-sizing: border-box; width: 100%; height: 38px; padding: 0 12px; font: inherit; font-size: 13px; text-align: left;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; cursor: pointer;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  .trigger:focus-visible { outline: none; border-color: var(--sg-accent, #4f46e5); box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-accent, #4f46e5) 30%, transparent); }
  .caret { font-size: 9px; color: var(--sg-muted, #94a3b8); }
  .menu {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 5; padding: 4px;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px;
    box-shadow: 0 16px 40px -14px rgba(15,23,42,0.35);
  }
  .opt { padding: 8px 10px; border-radius: 7px; font-size: 13px; cursor: pointer; }
  .opt.active { background: var(--sg-row-hover-bg, #f1f5f9); }
  .opt.on { color: var(--sg-accent, #4f46e5); font-weight: 600; }
  .opt.off { opacity: 0.4; cursor: not-allowed; }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); }
  .empty { color: var(--sg-muted, #94a3b8); font-style: italic; margin: 0; }
</style>
