<script lang="ts">
  /** Percent cells with `showBar`: the number and a bar filled to it (0 to 100%). */
  import type { FieldCellProps } from './registry.svelte'
  import { formatPercent, toNumber, type NumberFormatProps } from './format'

  let { value, props }: FieldCellProps<NumberFormatProps & { points?: boolean }> = $props()
  const n = $derived(toNumber(value))
  const share = $derived(n == null ? 0 : Math.max(0, Math.min(1, props.points ? n / 100 : n)))
</script>

<span class="sv-fpc">
  <span class="sv-fpc-bar" aria-hidden="true"><span style:width={`${share * 100}%`}></span></span>
  <span class="sv-fpc-text">{n == null ? '' : formatPercent(n, props)}</span>
</span>

<style>
  .sv-fpc { display: flex; align-items: center; gap: 8px; width: 100%; }
  .sv-fpc-bar { flex: 1; min-width: 24px; height: 6px; border-radius: 3px; background: var(--sg-row-hover-bg, #f1f5f9); overflow: hidden; }
  .sv-fpc-bar > span { display: block; height: 100%; border-radius: 3px; background: var(--sg-muted, #64748b); }
  .sv-fpc-text { flex: none; font-variant-numeric: tabular-nums; }
</style>
