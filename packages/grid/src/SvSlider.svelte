<script lang="ts">
  /**
   * SvSlider - a single or range slider (WAI-ARIA slider) with steps, ticks,
   * keyboard + pointer drag. Parity: Smart `smart-slider`. Single emits number;
   * range emits [number, number].
   *
   * The behavior lives in the headless `createSlider` core; this component is
   * just one styled renderer over it (it only owns pointer/DOM measurement).
   */
  import { createSlider } from './createSlider.svelte'

  type Props = {
    value?: number | [number, number]
    onChange?: (value: any) => void
    min?: number
    max?: number
    step?: number
    range?: boolean
    /** Show evenly spaced tick marks (count or explicit values). */
    ticks?: number | number[]
    /** Show the value bubble above the thumb. */
    showValue?: boolean
    disabled?: boolean
    orientation?: 'horizontal' | 'vertical'
    name?: string
    ariaLabel?: string
    formatValue?: (v: number) => string
  }

  let {
    value = 0,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    range = false,
    ticks,
    showValue = false,
    disabled = false,
    orientation = 'horizontal',
    name,
    ariaLabel,
    formatValue,
  }: Props = $props()

  // Behavior (value<->position math, stepping, keyboard, drag state, ARIA) lives
  // in the headless `createSlider` core; the component keeps the DOM measuring.
  const slider = createSlider({
    value: () => value,
    onChange: (v) => onChange?.(v),
    min: () => min,
    max: () => max,
    step: () => step,
    range: () => range,
    orientation: () => orientation,
    disabled: () => disabled,
    ariaLabel: () => ariaLabel,
  })
  const lo = $derived(slider.lo)
  const hi = $derived(slider.hi)
  const pct = (v: number) => slider.percentOf(v)

  const tickValues = $derived.by<number[]>(() => {
    if (!ticks) return []
    if (Array.isArray(ticks)) return ticks
    return Array.from({ length: ticks }, (_, i) => min + ((max - min) / (ticks - 1)) * i)
  })

  // The rect is measured here (a DOM concern) and passed INTO the core.
  let trackEl: HTMLDivElement | null = null
  function onTrackDown(e: PointerEvent) {
    if (disabled) return
    slider.pointerDown({ x: e.clientX, y: e.clientY }, trackEl!.getBoundingClientRect())
    trackEl?.setPointerCapture(e.pointerId)
  }
  function onMove(e: PointerEvent) {
    if (!slider.dragging) return
    slider.setFromPointer({ x: e.clientX, y: e.clientY }, trackEl!.getBoundingClientRect())
  }
  function onUp(e: PointerEvent) { if (slider.dragging) { slider.endDrag(); trackEl?.releasePointerCapture(e.pointerId) } }

  const fmt = (v: number) => (formatValue ? formatValue(v) : String(v))
</script>

<div
  class="sv-slider sv-slider--{orientation}"
  class:is-disabled={disabled}
  aria-label={ariaLabel}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={trackEl}
    class="sv-slider__track"
    {...slider.trackProps()}
    onpointerdown={onTrackDown}
    onpointermove={onMove}
    onpointerup={onUp}
    onpointercancel={onUp}
  >
    <div
      class="sv-slider__fill"
      style:--a={`${range ? pct(lo) : 0}%`}
      style:--b={`${range ? pct(hi) : pct(hi)}%`}
    ></div>
    {#each tickValues as t (t)}
      <span class="sv-slider__tick" style:--p={`${pct(t)}%`}></span>
    {/each}

    {#if range}
      <div class="sv-slider__thumb" style:--p={`${pct(lo)}%`} {...slider.thumbProps(0)}>
        {#if showValue}<span class="sv-slider__bubble">{fmt(lo)}</span>{/if}
      </div>
      <div class="sv-slider__thumb" style:--p={`${pct(hi)}%`} {...slider.thumbProps(1)}>
        {#if showValue}<span class="sv-slider__bubble">{fmt(hi)}</span>{/if}
      </div>
    {:else}
      <div class="sv-slider__thumb" style:--p={`${pct(hi)}%`} {...slider.thumbProps(0)}>
        {#if showValue}<span class="sv-slider__bubble">{fmt(hi)}</span>{/if}
      </div>
    {/if}
  </div>
  {#if name}<input type="hidden" {name} value={range ? `${lo},${hi}` : hi} />{/if}
</div>

<style>
  .sv-slider { --_accent: var(--sg-accent, #2563eb); --_track: var(--sg-border, #e2e8f0); padding: 10px; }
  .sv-slider--horizontal { width: 240px; }
  .sv-slider--vertical { height: 200px; width: 40px; }
  .sv-slider.is-disabled { opacity: 0.5; pointer-events: none; }
  .sv-slider__track {
    position: relative; background: var(--_track); border-radius: 999px; cursor: pointer; touch-action: none;
  }
  .sv-slider--horizontal .sv-slider__track { height: 6px; }
  .sv-slider--vertical .sv-slider__track { width: 6px; height: 100%; margin: 0 auto; }
  .sv-slider__fill { position: absolute; background: var(--_accent); border-radius: 999px; }
  .sv-slider--horizontal .sv-slider__fill { left: var(--a); right: calc(100% - var(--b)); top: 0; bottom: 0; }
  .sv-slider--vertical .sv-slider__fill { bottom: var(--a); top: calc(100% - var(--b)); left: 0; right: 0; }
  .sv-slider__thumb {
    position: absolute; width: 16px; height: 16px; border-radius: 50%;
    background: #fff; border: 2px solid var(--_accent); box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    cursor: grab; touch-action: none;
  }
  .sv-slider--horizontal .sv-slider__thumb { left: var(--p); top: 50%; transform: translate(-50%, -50%); }
  .sv-slider--vertical .sv-slider__thumb { bottom: var(--p); left: 50%; transform: translate(-50%, 50%); }
  .sv-slider__thumb:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: 2px; }
  .sv-slider__thumb:active { cursor: grabbing; }
  .sv-slider__bubble {
    position: absolute; bottom: 130%; left: 50%; transform: translateX(-50%);
    background: var(--_accent); color: var(--sg-on-accent, #fff); font-size: 11px; font-weight: 600;
    padding: 2px 6px; border-radius: 5px; white-space: nowrap;
  }
  .sv-slider__tick { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: var(--sg-muted, #94a3b8); }
  .sv-slider--horizontal .sv-slider__tick { left: var(--p); top: 50%; transform: translate(-50%, -50%); }
  .sv-slider--vertical .sv-slider__tick { bottom: var(--p); left: 50%; transform: translate(-50%, 50%); }
</style>
