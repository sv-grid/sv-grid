<script lang="ts">
  /**
   * The rating field's editor (registered as 'fieldRating'): the field's icon
   * up to its maximum. The icons under the pointer show what a click sets.
 * Left / Right or a digit change it, a click sets it,
   * Enter keeps it, Escape leaves the cell as it was, 0 or Backspace clears.
   */
  import { fieldPropsOf } from './registry.svelte'
  import { ICONS, STROKE_ICONS, type IconName } from './palette'

  let {
    value,
    columnDef,
    onCommit,
    onCancel,
  }: { value: unknown; columnDef?: Record<string, unknown>; onCommit: (v?: unknown) => void; onCancel: () => void } = $props()

  const props = $derived(fieldPropsOf((columnDef ?? {}) as { fieldType?: unknown; fieldProps?: Record<string, unknown> }) as { max?: number; icon?: IconName; color?: string })
  const max = $derived(Math.max(1, Math.min(10, Math.round(Number(props.max) || 5))))
  const icon = $derived<IconName>(props.icon && props.icon in ICONS ? props.icon : 'star')
  // svelte-ignore state_referenced_locally
  let n = $state(Math.max(0, Math.round(Number(value) || 0)))
  const items = $derived(Array.from({ length: max }, (_, i) => i))
  // The icon under the pointer, shown filled as a preview of the click.
  let hover = $state<number | null>(null)
  const shown = $derived(hover === null ? n : hover + 1)
  function track(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement
    const icons = el.querySelectorAll('svg')
    const first = icons[0]?.getBoundingClientRect()
    const last = icons[icons.length - 1]?.getBoundingClientRect()
    if (!first || !last) return
    const rtl = getComputedStyle(el).direction === 'rtl'
    const x = rtl ? first.right - e.clientX : e.clientX - first.left
    const span = rtl ? first.right - last.left : last.right - first.left
    hover = x < 0 || x > span ? null : Math.max(0, Math.min(max - 1, Math.floor((x / span) * max)))
  }

  function focusOnMount(el: HTMLElement) {
    queueMicrotask(() => el.focus())
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') n = Math.min(max, n + 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') n = Math.max(0, n - 1)
    else if (/^\d$/.test(e.key)) n = Math.min(max, Number(e.key))
    else if (e.key === 'Backspace' || e.key === 'Delete') n = 0
    else if (e.key === 'Enter' || e.key === 'Tab') onCommit(n)
    else if (e.key === 'Escape') onCancel()
    else return
    e.preventDefault()
    e.stopPropagation()
  }
</script>

<span
  class="sv-fre"
  role="slider"
  tabindex="0"
  aria-valuemin={0}
  aria-valuemax={max}
  aria-valuenow={n}
  aria-label={`Rating, ${n} of ${max}`}
  style:--c={props.color || '#fcb400'}
  use:focusOnMount
  onkeydown={onKey}
  onpointermove={track}
  onpointerleave={() => (hover = null)}
>
  {#each items as i (i)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" onmousedown={(e) => e.preventDefault()} onclick={() => onCommit(i + 1 === n ? 0 : i + 1)} class:is-preview={hover !== null && i < shown && i >= n}>
      <path d={ICONS[icon]} fill={i < shown && !STROKE_ICONS.has(icon) ? 'var(--c)' : 'none'} stroke={i < shown ? 'var(--c)' : 'currentColor'} stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
  {/each}
</span>

<style>
  .sv-fre { display: inline-flex; align-items: center; gap: 2px; height: 100%; padding: 0 4px; outline: none; color: var(--sg-muted, #94a3b8); }
  .sv-fre svg { cursor: pointer; flex: none; }
  .sv-fre svg.is-preview { opacity: 0.55; }
</style>
