<script lang="ts">
  /**
   * Headless date-time picker - SvDateTimePicker is headless-first, exactly like
   * the grid. `createDateTimePicker` is the state machine behind it: the masked
   * field parse/format (via the ./datetime token engine), min/max clamping,
   * nullable clear, spin stepping and dropdown open/tab state - exposed as
   * prop-getters you spread onto YOUR OWN markup. Below, the same core drives the
   * styled <SvDateTimePicker> (with its portalled calendar+clock dropdown) AND a
   * totally custom masked field, both bound to one value. No forked parsing.
   */
  import { SvDateTimePicker, createDateTimePicker } from '@svgrid/grid'

  let value = $state<Date | null>(new Date(2026, 5, 15, 14, 30))

  // The headless core - identical value logic, our own DOM. Editing either render
  // updates the single shared `value`.
  const dtp = createDateTimePicker({
    value: () => value,
    onChange: (d) => (value = d),
    formatString: () => 'yyyy-MM-dd HH:mm',
    spinButtons: () => true,
    stepMinutes: () => 15,
  })
</script>

<div class="wrap">
  <header>
    <h2>Headless date-time picker</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createDateTimePicker</code>
      drives both renders below; parsing, formatting, clamping and stepping come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvDateTimePicker&gt;</code></h3>
      <SvDateTimePicker {value} spinButtons stepMinutes={15} onChange={(d) => (value = d)} />
      <p class="hint">The calendar + clock dropdown portals to <code>&lt;body&gt;</code> so it is never clipped.</p>
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <!-- A custom masked field - nothing shared with SvDateTimePicker but the core. -->
      <div class="field">
        <div class="field__spin">
          <button {...dtp.spinProps(1)}>▲</button>
          <button {...dtp.spinProps(-1)}>▼</button>
        </div>
        <input class="field__input" bind:value={dtp.text} placeholder="yyyy-MM-dd HH:mm" {...dtp.inputProps()} />
        {#if dtp.current && dtp.isInteractive}
          <button class="field__clear" {...dtp.clearProps()}>&times;</button>
        {/if}
      </div>
      <p class="hint">Type a date and blur to parse, or press Up/Down to step by 15 minutes - all from <code>createDateTimePicker</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Value</h3>
    {#if value}
      <div class="tags"><span class="tag">{value.toISOString()}</span></div>
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

  /* Fully custom masked field - nothing shared with SvDateTimePicker but the core. */
  .field {
    display: flex; align-items: center; gap: 2px; width: 240px; height: 36px; padding: 0 4px 0 0;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; background: var(--sg-input-bg, #fff);
  }
  .field:focus-within { border-color: var(--sg-accent, #4f46e5); box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-accent, #4f46e5) 22%, transparent); }
  .field__input {
    flex: 1; min-width: 0; border: 0; background: none; outline: none; color: var(--sg-fg, #0f172a);
    font: inherit; font-size: 13px; padding: 0 8px; height: 100%;
  }
  .field__spin { display: flex; flex-direction: column; border-right: 1px solid var(--sg-border, #e2e8f0); }
  .field__spin button {
    flex: 1; width: 22px; border: 0; background: none; color: var(--sg-muted, #94a3b8); cursor: pointer;
    font-size: 7px; line-height: 1; padding: 0;
  }
  .field__spin button:hover { color: var(--sg-accent, #4f46e5); }
  .field__clear {
    display: grid; place-items: center; width: 26px; height: 26px; flex: none; font-size: 17px; line-height: 1;
    border: 0; background: none; color: var(--sg-muted, #94a3b8); cursor: pointer; border-radius: 6px;
  }
  .field__clear:hover { color: var(--sg-accent, #4f46e5); background: color-mix(in srgb, var(--sg-accent, #4f46e5) 10%, transparent); }

  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 13px; font-variant-numeric: tabular-nums; background: var(--sg-row-hover-bg, #f1f5f9); }
  .empty { color: var(--sg-muted, #94a3b8); font-style: italic; margin: 0; }
</style>
