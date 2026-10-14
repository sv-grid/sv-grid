<script lang="ts">
  /**
   * Rating cells: the field's icon `max` times in its color, the first `value`
   * filled. In an editable grid a click on an icon sets the rating (a click on
   * the current one clears it), through the grid's own edit commit, so undo,
   * `onCellValueChange` and validation behave as for any edit. Screen readers
   * hear "3 of 5".
   */
  import type { FieldCellProps } from './registry.svelte'
  import { ICONS, STROKE_ICONS, type IconName } from './palette'

  let { ctrl, row, column, value, props }: FieldCellProps<{ max?: number; icon?: IconName; color?: string }> = $props()
  const max = $derived(Math.max(1, Math.min(10, Math.round(Number(props.max) || 5))))
  const n = $derived(Math.max(0, Math.min(max, Math.round(Number(value) || 0))))
  const icon = $derived<IconName>(props.icon && props.icon in ICONS ? props.icon : 'star')
  const color = $derived(props.color || '#fcb400')
  const items = $derived(Array.from({ length: max }, (_, i) => i))
  const g = $derived(ctrl as any)
  const interactive = $derived(!!g?.editingEnabled && column.columnDef.editable !== false)
  let hover = $state<number | null>(null)
  // Over an icon or the gap after it: the icon under the pointer, so the
  // preview does not flicker between icons.
  function track(e: PointerEvent) {
    if (!interactive) return
    const el = e.currentTarget as HTMLElement
    const box = el.getBoundingClientRect()
    const x = getComputedStyle(el).direction === 'rtl' ? box.right - e.clientX : e.clientX - box.left
    hover = Math.max(0, Math.min(max - 1, Math.floor((x / box.width) * max)))
  }

  function set(i: number) {
    if (!interactive) return
    const next = i + 1 === n ? 0 : i + 1
    const rowIndex = (g.allRows as Array<{ id: string }>).findIndex((r) => r.id === row.id)
    if (rowIndex < 0 || !g.startEditing?.(rowIndex, column.id)) return
    g.updateEditingCellValue?.(next)
    g.saveEditingCell?.()
  }
</script>

<span
  class="sv-frt"
  class:is-interactive={interactive}
  role="img"
  aria-label={`${n} of ${max}`}
  style:--c={color}
  onpointermove={track}
  onpointerleave={() => (hover = null)}
>
  {#each items as i (i)}
    {@const filled = hover !== null ? i <= hover : i < n}
    {@const preview = hover !== null && filled && i >= n}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <svg
      class="sv-frt-icon"
      class:is-on={filled}
      class:is-preview={preview}
      viewBox="0 0 24 24"
      width="15"
      height="15"
      aria-hidden="true"
      onclick={() => set(i)}
    >
      <path d={ICONS[icon]} fill={filled && !STROKE_ICONS.has(icon) ? 'var(--c)' : 'none'} stroke={filled ? 'var(--c)' : 'currentColor'} stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
  {/each}
</span>

<style>
  .sv-frt { display: inline-flex; gap: 1px; align-items: center; color: color-mix(in srgb, var(--sg-muted, #94a3b8) 55%, transparent); }
  .sv-frt.is-interactive .sv-frt-icon { cursor: pointer; }
  .sv-frt-icon { flex: none; }
  .sv-frt-icon.is-preview { opacity: 0.55; }
</style>
