<script lang="ts">
  /**
   * Headless time picker - SvTimePicker is headless-first, exactly like the grid.
   * `createTimePicker` is the state machine behind it: hour/minute value math,
   * 12/24-hour display, minute snapping, the pure dial geometry and full keyboard
   * - exposed as prop-getters you spread onto YOUR OWN markup. Below, the same
   * core drives the styled analog <SvTimePicker> AND a totally custom digital
   * readout, both bound to one value. No forked math, no re-implemented keyboard.
   */
  import { SvTimePicker, createTimePicker } from '@svgrid/grid'

  let value = $state<Date>(new Date(2026, 5, 15, 14, 30))

  // The headless core - identical behavior, our own DOM. Editing either render
  // updates the single shared `value`.
  const tp = createTimePicker({
    value: () => value,
    onChange: (d) => (value = d),
  })
</script>

<div class="wrap">
  <header>
    <h2>Headless time picker</h2>
    <p>
      Every editor ships a headless core + a styled component - the same split as the grid
      (<code>createSvGrid</code> / <code>&lt;SvGrid&gt;</code>). Here <code>createTimePicker</code>
      drives both renders below; the value math, snapping, keyboard and ARIA come from the core, the markup is yours.
    </p>
  </header>

  <div class="cols">
    <section>
      <h3>Styled <code>&lt;SvTimePicker&gt;</code></h3>
      <SvTimePicker {value} footer onChange={(d) => (value = d)} />
    </section>

    <section>
      <h3>Your markup, same core</h3>
      <!-- A custom digital render - nothing shared with SvTimePicker but the core. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="digi" tabindex="0" role="group" aria-label="Time" onkeydown={tp.onKeydown}>
        <button class="digi__seg" class:on={tp.selection === 'hour'} {...tp.segProps('hour')}>{String(tp.displayHour).padStart(2, '0')}</button>
        <span class="digi__colon">:</span>
        <button class="digi__seg" class:on={tp.selection === 'minute'} {...tp.segProps('minute')}>{tp.mm}</button>
        {#if tp.is12}
          <div class="digi__ampm">
            <button class:on={!tp.isPm} {...tp.ampmProps(false)}>AM</button>
            <button class:on={tp.isPm} {...tp.ampmProps(true)}>PM</button>
          </div>
        {/if}
      </div>
      <p class="hint">Click a segment to select it, then arrow keys bump the value - all from <code>createTimePicker</code>.</p>
    </section>
  </div>

  <aside class="readout">
    <h3>Value</h3>
    <div class="tags"><span class="tag">{String(value.getHours()).padStart(2, '0')}:{String(value.getMinutes()).padStart(2, '0')}</span></div>
  </aside>
</div>

<style>
  .wrap { padding: 20px; max-width: 900px; display: flex; flex-direction: column; gap: 18px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.55; max-width: 680px; }
  code { background: var(--sg-row-hover-bg, #eef2ff); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
  .cols { display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start; }
  section h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }

  /* Fully custom digital render - nothing shared with SvTimePicker but the core. */
  .digi {
    display: inline-flex; align-items: center; gap: 4px; padding: 14px 18px; border-radius: 14px;
    border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-input-bg, #fff);
    font-variant-numeric: tabular-nums; outline: none;
  }
  .digi:focus-visible { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-accent, #4f46e5) 40%, transparent); }
  .digi__seg {
    font-size: 40px; font-weight: 700; line-height: 1; padding: 4px 8px; border-radius: 10px; cursor: pointer;
    border: 0; background: none; color: var(--sg-muted, #94a3b8);
  }
  .digi__seg.on { color: var(--sg-accent, #4f46e5); background: color-mix(in srgb, var(--sg-accent, #4f46e5) 12%, transparent); }
  .digi__colon { font-size: 36px; font-weight: 700; color: var(--sg-muted, #94a3b8); }
  .digi__ampm { display: flex; flex-direction: column; gap: 3px; margin-left: 8px; }
  .digi__ampm button {
    font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 7px; cursor: pointer;
    border: 1px solid var(--sg-border, #e2e8f0); background: var(--sg-input-bg, #fff); color: var(--sg-muted, #94a3b8);
  }
  .digi__ampm button.on { background: var(--sg-accent, #4f46e5); color: var(--sg-on-accent, #fff); border-color: transparent; }

  .hint { margin: 10px 0 0; font-size: 12px; color: var(--sg-muted, #94a3b8); line-height: 1.5; }
  .readout h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--sg-muted, #64748b); }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { padding: 3px 10px; border-radius: 6px; font-size: 15px; font-variant-numeric: tabular-nums; background: var(--sg-row-hover-bg, #f1f5f9); }
</style>
