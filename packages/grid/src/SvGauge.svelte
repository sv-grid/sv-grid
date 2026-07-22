<script lang="ts">
  /**
   * SvGauge - a radial arc gauge (SVG) that renders a value within [min, max]
   * with optional colored threshold bands, a needle, and a center label. Parity:
   * Smart `smart-gauge` (radial). Display control; theme-driven.
   *
   * The arc/needle geometry + `role="meter"` ARIA live in the headless
   * `createGauge` core; this component is just one styled renderer over it.
   */
  import { type EditorDir } from './editor-contract'
  import { createGauge } from './createGauge.svelte'

  type Band = { from: number; to: number; color: string }

  type Props = {
    value?: number
    min?: number
    max?: number
    /** Sweep angle in degrees (default 270, a classic dashboard gauge). */
    sweep?: number
    /** Colored threshold bands along the arc. */
    bands?: Band[]
    /** Show the needle. */
    needle?: boolean
    /** Center label (defaults to the formatted value). */
    label?: string
    unit?: string
    size?: number
    thickness?: number
    formatValue?: (v: number) => string
    ariaLabel?: string
    /** Text direction for the center label / unit. */
    dir?: EditorDir
  }

  let {
    value = 0,
    min = 0,
    max = 100,
    sweep = 270,
    bands = [],
    needle = true,
    label,
    unit = '',
    size = 180,
    thickness = 14,
    formatValue,
    ariaLabel,
    dir,
  }: Props = $props()

  const resolvedDir = $derived(dir === 'ltr' || dir === 'rtl' ? dir : undefined)

  const gauge = createGauge({
    value: () => value,
    min: () => min,
    max: () => max,
    sweep: () => sweep,
    size: () => size,
    thickness: () => thickness,
    ariaLabel: () => ariaLabel,
  })
  const clamped = $derived(gauge.clamped)
  const cx = $derived(gauge.cx)
  const cy = $derived(gauge.cy)
  const r = $derived(gauge.r)
  const arcPath = (v0: number, v1: number, radius: number) => gauge.arcPath(v0, v1, radius)
  const needleEnd = $derived(gauge.needleEnd)
  const display = $derived(label ?? `${formatValue ? formatValue(clamped) : Math.round(clamped)}${unit}`)
</script>

<div class="sv-gauge" dir={resolvedDir} {...gauge.rootProps()}>
  <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} class="sv-gauge__svg">
    <!-- track -->
    <path d={arcPath(min, max, r)} class="sv-gauge__track" fill="none" stroke-width={thickness} stroke-linecap="round" />
    <!-- bands (or accent fill up to value when no bands) -->
    {#if bands.length}
      {#each bands as band (band.from + '-' + band.to)}
        <path d={arcPath(band.from, band.to, r)} fill="none" stroke={band.color} stroke-width={thickness} stroke-linecap="round" />
      {/each}
    {:else}
      <path d={arcPath(min, clamped, r)} class="sv-gauge__value" fill="none" stroke-width={thickness} stroke-linecap="round" />
    {/if}
    {#if needle}
      <line x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y} class="sv-gauge__needle" stroke-linecap="round" />
      <circle cx={cx} cy={cy} r="5" class="sv-gauge__hub" />
    {/if}
  </svg>
  <div class="sv-gauge__label">{display}</div>
</div>

<style>
  .sv-gauge { position: relative; display: inline-flex; flex-direction: column; align-items: center; color: var(--sg-fg, #0f172a); }
  .sv-gauge__svg { display: block; }
  .sv-gauge__track { stroke: var(--sg-border, #e2e8f0); }
  .sv-gauge__value { stroke: var(--sg-accent, #2563eb); }
  .sv-gauge__needle { stroke: var(--sg-fg, #0f172a); stroke-width: 3; }
  .sv-gauge__hub { fill: var(--sg-fg, #0f172a); }
  .sv-gauge__label {
    position: absolute; left: 0; right: 0; bottom: 22%; text-align: center;
    font-size: 22px; font-weight: 750; font-variant-numeric: tabular-nums;
  }
</style>
