<script lang="ts">
  /**
   * Single and multiple select cells: each choice as a pill filled with its
   * option's color, the text dark or white for contrast. A value that is no
   * longer one of the options keeps a plain gray pill, so it stays visible.
   */
  import type { FieldCellProps } from './registry.svelte'
  import { textOn } from './palette'

  type Option = { value: unknown; label?: string; color?: string }
  let { value, props }: FieldCellProps<{ options?: Option[] }> = $props()

  const byValue = $derived(new Map((props.options ?? []).map((o) => [String(o.value), o])))
  const items = $derived(
    (Array.isArray(value) ? value : value == null || value === '' ? [] : [value]).map((v) => {
      const o = byValue.get(String(v))
      return { key: String(v), label: o?.label ?? String(v), color: o?.color }
    }),
  )
</script>

<span class="sv-fsl">
  {#each items as it (it.key)}
    <span class="sv-fsl-pill" class:is-plain={!it.color} style:background={it.color} style:color={it.color ? textOn(it.color) : undefined}>{it.label}</span>
  {/each}
</span>

<style>
  .sv-fsl { display: flex; align-items: center; gap: 4px; min-width: 0; overflow: hidden; }
  .sv-fsl-pill {
    flex: none; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    padding: 0 8px; border-radius: 999px; font-size: 12px; line-height: 20px;
  }
  .sv-fsl-pill.is-plain { background: var(--sg-header-bg, #eef0f3); color: var(--sg-fg, #0f172a); border: 1px solid var(--sg-border, #e2e8f0); line-height: 18px; }
</style>
