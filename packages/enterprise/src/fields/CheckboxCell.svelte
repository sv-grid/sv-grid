<script lang="ts">
  /**
   * Checkbox cells with the field's icon and color. The default icon is a
   * box with a check; star, heart and the rest show filled when checked and as
   * a faint outline when not. Clicking and Space still toggle through the grid
   * (the column's editor is 'checkbox'); this only draws.
   */
  import type { FieldCellProps } from './registry.svelte'
  import { ICONS, STROKE_ICONS, type IconName } from './palette'

  let { value, props }: FieldCellProps<{ icon?: IconName; color?: string }> = $props()
  const on = $derived(value === true || value === 'true' || value === 1)
  const icon = $derived<IconName>(props.icon && props.icon in ICONS ? props.icon : 'check')
  const color = $derived(props.color || '#20c933')
</script>

<span class="sv-fcb" role="checkbox" aria-checked={on} aria-readonly="true" aria-label={on ? 'Checked' : 'Not checked'} style:--c={color}>
  {#if icon === 'check' || icon === 'x'}
    <span class="sv-fcb-box" class:is-on={on}>
      {#if on}<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d={ICONS[icon]} fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>{/if}
    </span>
  {:else}
    <svg class="sv-fcb-icon" class:is-on={on} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d={ICONS[icon]}
        fill={on && !STROKE_ICONS.has(icon) ? 'var(--c)' : 'none'}
        stroke={on ? 'var(--c)' : 'currentColor'}
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  {/if}
</span>

<style>
  .sv-fcb { display: inline-flex; align-items: center; justify-content: center; width: 100%; color: var(--sg-muted, #94a3b8); }
  .sv-fcb-box {
    display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 4px; box-sizing: border-box;
    border: 1.5px solid color-mix(in srgb, var(--sg-muted, #94a3b8) 70%, transparent);
  }
  .sv-fcb-box.is-on { background: var(--c); border-color: var(--c); }
  .sv-fcb-icon { opacity: 0.45; }
  .sv-fcb-icon.is-on { opacity: 1; }
</style>
