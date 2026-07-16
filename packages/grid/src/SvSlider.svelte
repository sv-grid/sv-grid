<script lang="ts">
  /**
   * SvSlider - a single or range slider (WAI-ARIA slider) with steps, ticks,
   * keyboard + pointer drag. Parity: Smart `smart-slider`. Single emits number;
   * range emits [number, number].
   */
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

  const isVert = $derived(orientation === 'vertical')
  const lo = $derived(range ? (value as [number, number])[0] : min)
  const hi = $derived(range ? (value as [number, number])[1] : (value as number))

  function clampStep(v: number): number {
    const stepped = Math.round((v - min) / step) * step + min
    return Math.min(max, Math.max(min, Number(stepped.toFixed(10))))
  }
  const pct = (v: number) => ((v - min) / (max - min)) * 100

  const tickValues = $derived.by<number[]>(() => {
    if (!ticks) return []
    if (Array.isArray(ticks)) return ticks
    return Array.from({ length: ticks }, (_, i) => min + ((max - min) / (ticks - 1)) * i)
  })

  let trackEl: HTMLDivElement | null = null
  let dragging = $state<null | 'lo' | 'hi' | 'single'>(null)

  function valueFromPointer(e: PointerEvent): number {
    const rect = trackEl!.getBoundingClientRect()
    const frac = isVert
      ? 1 - (e.clientY - rect.top) / rect.height
      : (e.clientX - rect.left) / rect.width
    return clampStep(min + Math.min(1, Math.max(0, frac)) * (max - min))
  }

  function emitSingle(v: number) { onChange?.(v) }
  function emitRange(nlo: number, nhi: number) { onChange?.([Math.min(nlo, nhi), Math.max(nlo, nhi)]) }

  function onTrackDown(e: PointerEvent) {
    if (disabled) return
    const v = valueFromPointer(e)
    if (range) {
      const which = Math.abs(v - lo) <= Math.abs(v - hi) ? 'lo' : 'hi'
      dragging = which
      which === 'lo' ? emitRange(v, hi) : emitRange(lo, v)
    } else {
      dragging = 'single'
      emitSingle(v)
    }
    trackEl?.setPointerCapture(e.pointerId)
  }
  function onMove(e: PointerEvent) {
    if (!dragging) return
    const v = valueFromPointer(e)
    if (dragging === 'single') emitSingle(v)
    else if (dragging === 'lo') emitRange(v, hi)
    else emitRange(lo, v)
  }
  function onUp(e: PointerEvent) { if (dragging) { dragging = null; trackEl?.releasePointerCapture(e.pointerId) } }

  function onThumbKey(e: KeyboardEvent, which: 'lo' | 'hi' | 'single') {
    if (disabled) return
    const cur = which === 'lo' ? lo : hi
    let next = cur
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = clampStep(cur + step)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = clampStep(cur - step)
    else if (e.key === 'Home') next = min
    else if (e.key === 'End') next = max
    else if (e.key === 'PageUp') next = clampStep(cur + step * 10)
    else if (e.key === 'PageDown') next = clampStep(cur - step * 10)
    else return
    e.preventDefault()
    if (which === 'single') emitSingle(next)
    else if (which === 'lo') emitRange(next, hi)
    else emitRange(lo, next)
  }

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
      <div class="sv-slider__thumb" style:--p={`${pct(lo)}%`} role="slider" tabindex={disabled ? -1 : 0} aria-valuemin={min} aria-valuemax={hi} aria-valuenow={lo} aria-label="Minimum" onkeydown={(e) => onThumbKey(e, 'lo')}>
        {#if showValue}<span class="sv-slider__bubble">{fmt(lo)}</span>{/if}
      </div>
      <div class="sv-slider__thumb" style:--p={`${pct(hi)}%`} role="slider" tabindex={disabled ? -1 : 0} aria-valuemin={lo} aria-valuemax={max} aria-valuenow={hi} aria-label="Maximum" onkeydown={(e) => onThumbKey(e, 'hi')}>
        {#if showValue}<span class="sv-slider__bubble">{fmt(hi)}</span>{/if}
      </div>
    {:else}
      <div class="sv-slider__thumb" style:--p={`${pct(hi)}%`} role="slider" tabindex={disabled ? -1 : 0} aria-valuemin={min} aria-valuemax={max} aria-valuenow={hi} aria-label={ariaLabel ?? 'Value'} onkeydown={(e) => onThumbKey(e, 'single')}>
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
