<script lang="ts">
  /**
   * Headless editors - the SvGrid UI kit is headless-first + render-ready, just
   * like the grid. `createListbox` is the framework-free-in-spirit state machine
   * behind <SvListBox>: roving focus, single/multi selection, full keyboard, ARIA
   * - exposed as **prop-getters** you spread onto YOUR OWN markup. Below, the same
   *   core drives the styled <SvListBox> AND a totally custom "chip cloud" render,
   *   both bound to one value. No forked logic, no re-implemented keyboard.
   */
  import { SvListBox, createListbox, type ListOption } from '@svgrid/grid'

  const options: ListOption[] = [
    { value: 'svelte', label: 'Svelte' },
    { value: 'react', label: 'React' },
    { value: 'vue', label: 'Vue' },
    { value: 'solid', label: 'Solid' },
    { value: 'angular', label: 'Angular', disabled: true },
    { value: 'qwik', label: 'Qwik' },
  ]

  let value = $state<Array<string | number>>(['svelte'])

  // The headless core - identical behavior, our own DOM.
  const lb = createListbox({
    options: () => options,
    value: () => value,
    multiple: () => true,
    onChange: (v) => (value = v as string[]),
  })
</script>

<div class="wrap">
  <header>
    <h2>Headless editors</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createListbox</code>
      drives both renders below; keyboard, selection and ARIA come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvListBox&gt;</code></h3>
      <SvListBox {options} {value} multiple ariaLabel="Frameworks" onChange={(v) => (value = v)} />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
      <div class="cloud" {...lb.rootProps()}>
        {#each options as opt, i (opt.value)}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
          <span
            class="chip"
            class:on={lb.isSelected(opt.value)}
            class:active={lb.isActive(i)}
            class:off={opt.disabled}
            {...lb.optionProps(i)}
          >{opt.label}</span>
        {/each}
      </div>
      <p class="hint">Tab in, arrow keys move the ring, Space/Enter toggles - all from <code>createListbox</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Selected</h3>
    {#if value.length}
      <div class="tags">{#each value as v (v)}<span class="tag">{v}</span>{/each}</div>
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
  /* Fully custom listbox render - nothing shared with SvListBox but the core. */
  .cloud { display: flex; flex-wrap: wrap; gap: 8px; max-width: 300px; padding: 4px; border-radius: 10px; outline: none; }
  .cloud:focus-visible { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-accent, #4f46e5) 40%, transparent); }
  .chip {
    padding: 7px 14px; border-radius: 999px; font-size: 13px; font-weight: 550; cursor: pointer;
    border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    transition: transform 0.08s;
  }
  .chip.active { border-color: var(--sg-accent, #4f46e5); }
  .chip.on { background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff); border-color: transparent; }
  .chip.off { opacity: 0.4; cursor: not-allowed; }
  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; background: var(--sg-row-hover-bg, #f1f5f9); }
  .empty { color: var(--sg-muted, #94a3b8); font-style: italic; margin: 0; }
</style>
