<script lang="ts" module>
  export type { TimeValue } from './createTimePicker.svelte'
</script>

<script lang="ts">
  /**
   * SvTimePicker - an analog clock-dial time picker (parity: Smart
   * `smart-time-picker`). 12/24-hour, minute snapping, hour->minute auto-switch,
   * pointer-drag + keyboard. It is a styled renderer over the headless
   * `createTimePicker` core: the core owns the value math, dial geometry, keyboard
   * and ARIA; this component keeps the DOM-bound pointer capture + hit-testing.
   * All visuals come from `--sg-*` tokens so every theme applies for free.
   */
  import { createTimePicker, type TimeValue, type TimeFormat, type TimeSelection } from './createTimePicker.svelte'

  type Props = {
    /** Date, "HH:MM[:SS]" string, or epoch ms. */
    value?: TimeValue
    /** Fires with a Date (today's date carrying the picked time). */
    onChange?: (value: Date) => void
    format?: TimeFormat
    minuteInterval?: number
    /** After picking an hour, jump the dial to minutes. Default true. */
    autoSwitchToMinutes?: boolean
    /** Show the Now footer button. */
    footer?: boolean
    disabled?: boolean
    readonly?: boolean
    name?: string
    /** Which dial opens first. */
    selection?: TimeSelection
  }

  let {
    value = null,
    onChange,
    format = '24-hour',
    minuteInterval = 1,
    autoSwitchToMinutes = true,
    footer = false,
    disabled = false,
    readonly = false,
    name,
    selection = 'hour',
  }: Props = $props()

  // The headless core owns all state, geometry, keyboard + ARIA. Reactive inputs
  // are getters; callbacks are closures.
  const tp = createTimePicker({
    value: () => value,
    onChange: (d) => onChange?.(d),
    format: () => format,
    minuteInterval: () => minuteInterval,
    autoSwitchToMinutes: () => autoSwitchToMinutes,
    disabled: () => disabled,
    readonly: () => readonly,
    selection: () => selection,
  })

  // --- Pointer drag on the dial (DOM-bound; stays in the component) -----------
  // The core exposes SIZE/C + a pure `pointerSelect(angle, dist)`; here we only
  // turn a pointer event into that angle via the live element rect.
  let dialEl: SVGSVGElement | null = null
  let dragging = false

  function angleFromEvent(e: PointerEvent): { angle: number; dist: number } {
    const rect = dialEl!.getBoundingClientRect()
    const scale = tp.SIZE / rect.width
    const x = (e.clientX - rect.left) * scale - tp.C
    const y = (e.clientY - rect.top) * scale - tp.C
    let deg = (Math.atan2(y, x) * 180) / Math.PI + 90
    if (deg < 0) deg += 360
    return { angle: deg, dist: Math.hypot(x, y) }
  }

  function onDialPointerDown(e: PointerEvent) {
    if (!tp.isInteractive) return
    dragging = true
    dialEl?.setPointerCapture(e.pointerId)
    const { angle, dist } = angleFromEvent(e)
    tp.pointerSelect(angle, dist)
  }
  function onDialPointerMove(e: PointerEvent) {
    if (!dragging) return
    const { angle, dist } = angleFromEvent(e)
    tp.pointerSelect(angle, dist)
  }
  function onDialPointerUp(e: PointerEvent) {
    if (!dragging) return
    dragging = false
    dialEl?.releasePointerCapture(e.pointerId)
    tp.endPointer()
  }
</script>

<div class="sv-tp" class:sv-tp--disabled={disabled} role="group" aria-label="Time picker">
  <div class="sv-tp__head">
    <button class="sv-tp__seg" class:is-active={tp.selection === 'hour'} {...tp.segProps('hour')}>
      {String(tp.displayHour).padStart(2, '0')}
    </button>
    <span class="sv-tp__colon">:</span>
    <button class="sv-tp__seg" class:is-active={tp.selection === 'minute'} {...tp.segProps('minute')}>
      {tp.mm}
    </button>
    {#if tp.is12}
      <div class="sv-tp__ampm">
        <button class:is-active={!tp.isPm} {...tp.ampmProps(false)}>AM</button>
        <button class:is-active={tp.isPm} {...tp.ampmProps(true)}>PM</button>
      </div>
    {/if}
  </div>

  <svg
    bind:this={dialEl}
    class="sv-tp__dial"
    viewBox={`0 0 ${tp.SIZE} ${tp.SIZE}`}
    width="100%"
    {...tp.dialProps()}
    onpointerdown={onDialPointerDown}
    onpointermove={onDialPointerMove}
    onpointerup={onDialPointerUp}
    onpointercancel={onDialPointerUp}
  >
    <circle class="sv-tp__face" cx={tp.C} cy={tp.C} r={tp.C - 4} />
    <!-- hand -->
    <line class="sv-tp__hand" x1={tp.C} y1={tp.C} x2={tp.handEnd.x} y2={tp.handEnd.y} />
    <circle class="sv-tp__hub" cx={tp.C} cy={tp.C} r="3" />
    <circle class="sv-tp__knob" cx={tp.handEnd.x} cy={tp.handEnd.y} r="15" />
    {#if tp.selection === 'hour'}
      {#each tp.hourTicks as t (t.ring + '-' + t.value)}
        <text class="sv-tp__num" class:is-active={tp.isActiveHour(t)} class:is-inner={t.ring === 'inner'} x={t.x} y={t.y} dominant-baseline="central" text-anchor="middle">{t.label}</text>
      {/each}
    {:else}
      {#each tp.minuteTicks as t (t.value)}
        <text class="sv-tp__num" class:is-active={t.value === tp.minutes} x={t.x} y={t.y} dominant-baseline="central" text-anchor="middle">{t.label}</text>
      {/each}
    {/if}
  </svg>

  {#if footer}
    <div class="sv-tp__footer">
      <button class="sv-tp__now" {...tp.nowProps()}>Now</button>
    </div>
  {/if}

  {#if name}<input type="hidden" {name} value={`${String(tp.hours).padStart(2, '0')}:${tp.mm}`} />{/if}
</div>

<style>
  .sv-tp {
    --_accent: var(--sg-accent, #2563eb);
    --_bg: var(--sg-bg, #fff);
    --_fg: var(--sg-fg, #0f172a);
    --_muted: var(--sg-muted, #64748b);
    --_border: var(--sg-border, #e2e8f0);
    --_face: var(--sg-header-bg, #f1f5f9);
    --_radius: var(--sg-radius, 8px);
    display: inline-flex; flex-direction: column; gap: 10px; align-items: center;
    width: 260px; padding: 12px;
    background: var(--_bg); color: var(--_fg);
    border: 1px solid var(--_border); border-radius: calc(var(--_radius) + 4px);
    user-select: none;
  }
  .sv-tp--disabled { opacity: 0.55; pointer-events: none; }

  .sv-tp__head { display: flex; align-items: center; gap: 2px; font-variant-numeric: tabular-nums; }
  .sv-tp__seg {
    font-size: 30px; font-weight: 700; line-height: 1;
    background: none; border: 0; color: var(--_muted); cursor: pointer;
    padding: 2px 6px; border-radius: var(--_radius);
  }
  .sv-tp__seg.is-active { color: var(--_accent); background: color-mix(in srgb, var(--_accent) 12%, transparent); }
  .sv-tp__colon { font-size: 28px; font-weight: 700; color: var(--_muted); }
  .sv-tp__ampm { display: flex; flex-direction: column; margin-left: 8px; gap: 2px; }
  .sv-tp__ampm button {
    font-size: 11px; font-weight: 700; padding: 3px 8px;
    background: none; border: 1px solid var(--_border); border-radius: 6px; color: var(--_muted); cursor: pointer;
  }
  .sv-tp__ampm button.is-active { background: var(--_accent); color: var(--sg-on-accent, #fff); border-color: var(--_accent); }

  .sv-tp__dial { touch-action: none; cursor: pointer; outline: none; display: block; width: 100%; height: auto; aspect-ratio: 1; }
  .sv-tp__dial:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: 2px; border-radius: 50%; }
  .sv-tp__face { fill: var(--_face); }
  .sv-tp__hand { stroke: var(--_accent); stroke-width: 2; }
  .sv-tp__hub { fill: var(--_accent); }
  .sv-tp__knob { fill: var(--_accent); opacity: 0.9; }
  .sv-tp__num {
    font-size: 13px; fill: var(--_fg); pointer-events: none;
    font-family: inherit;
  }
  .sv-tp__num.is-inner { font-size: 11px; fill: var(--_muted); }
  .sv-tp__num.is-active { fill: var(--sg-on-accent, #fff); font-weight: 700; }

  .sv-tp__footer { width: 100%; display: flex; justify-content: center; border-top: 1px solid var(--_border); padding-top: 8px; }
  .sv-tp__now {
    padding: 5px 14px; font: inherit; font-size: 12px; font-weight: 600;
    background: none; border: 1px solid var(--_border); border-radius: var(--_radius);
    color: var(--_accent); cursor: pointer;
  }
  .sv-tp__now:hover { background: color-mix(in srgb, var(--_accent) 10%, transparent); }
</style>
