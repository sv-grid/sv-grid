<script lang="ts">
  /**
   * SvListBox - an inline single/multi-select list (WAI-ARIA listbox) with
   * roving highlight + full keyboard. Parity: Smart `smart-list-box`. Controlled
   * via `value` (scalar or array) + `onChange`. Scales to huge option sets with
   * `virtual` (fixed-row windowing), and each row can be an `itemTemplate`.
   */
  import { type Snippet } from 'svelte'
  import { groupOptions, hasGroups, normalizeOptions, type ListOption } from './list-option'
  import { virtualRange, scrollToIndex } from './virtual'
  import { createListbox } from './createListbox.svelte'
  import SvField from './SvField.svelte'
  import { nextEditorId, type SvEditorProps } from './editor-contract'

  type Props = SvEditorProps & {
    options: ReadonlyArray<ListOption>
    value?: string | number | Array<string | number> | null
    onChange?: (value: any) => void
    multiple?: boolean
    /** Visible height in rows before scrolling. */
    rows?: number
    /** Window the list (render only visible rows) for large option sets. */
    virtual?: boolean
    /** Fixed row height in px (must match the CSS row height). Default 32. */
    rowHeight?: number
    /** Custom per-option content. Receives the option. */
    item?: Snippet<[ListOption]>
    /** @deprecated Use `item`. */
    itemTemplate?: Snippet<[ListOption]>
  }

  let {
    options,
    value = null,
    onChange,
    multiple = false,
    disabled = false,
    size = 'md',
    rows = 7,
    virtual = false,
    rowHeight = 32,
    item,
    itemTemplate,
    ariaLabel,
    name,
    invalid = false,
    required = false,
    error,
    label,
    hint,
    dir,
    id,
  }: Props = $props()

  // Stable id anchors the label/hint/error wiring even when no `id` is passed.
  const autoId = nextEditorId('sv-lb')
  const uid = $derived(id ?? autoId)

  // Tolerate primitive / partial options (e.g. setOptions([1, 2, 3])): normalize
  // to { value, label } so labels render and keys are never undefined.
  const norm = $derived(normalizeOptions(options))

  // The styled listbox is just a renderer over the headless core.
  const lb = createListbox({
    options: () => norm,
    value: () => value,
    onChange: (v) => onChange?.(v),
    multiple: () => multiple,
    disabled: () => disabled,
    ariaLabel: () => ariaLabel,
    id: () => uid,
    invalid: () => invalid,
    required: () => required,
    error: () => error,
    hint: () => hint,
  })
  const isSel = (o: ListOption) => lb.isSelected(o.value)

  // Virtualization only applies to a flat (ungrouped) list.
  const useVirtual = $derived(virtual && !hasGroups(norm))
  let listEl = $state<HTMLUListElement | null>(null)
  let scrollTop = $state(0)
  let viewportH = $state(0)
  const vr = $derived(
    virtualRange({ scrollTop, viewportHeight: viewportH, rowHeight, count: norm.length, overscan: 10 }),
  )
  const windowed = $derived(
    useVirtual ? norm.slice(vr.start, vr.end).map((o, i) => ({ ...o, index: vr.start + i })) : [],
  )

  // Keep the active option in view. Virtual mode drives scrollTop directly (the
  // active row may not be in the DOM); otherwise use scrollIntoView.
  $effect(() => {
    const i = lb.activeIndex
    if (useVirtual) {
      if (!listEl) return
      const next = scrollToIndex(i, listEl.scrollTop, listEl.clientHeight, rowHeight)
      if (next !== listEl.scrollTop) listEl.scrollTop = next
    } else {
      queueMicrotask(() => listEl?.querySelector<HTMLElement>(`[data-idx="${i}"]`)?.scrollIntoView({ block: 'nearest' }))
    }
  })
</script>

<SvField id={uid} {label} {hint} {error} {required} {dir}>
  <ul
    bind:this={listEl}
    class="sv-listbox sv-listbox--{size}"
    class:is-invalid={invalid}
    class:is-virtual={useVirtual}
    style:--sv-rows={rows}
    style:--sv-row-h={`${rowHeight}px`}
    onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
    bind:clientHeight={viewportH}
    {...lb.rootProps()}
  >
    {#if useVirtual}
      <!-- Windowing by top/bottom spacers with the visible rows IN FLOW between
           them (padTop + rows + padBottom always sum to the full height). Plain
           flow rows (no absolute positioning, no will-change) keep the scroller
           off its own compositor layer, so a fast jump repaints in step with the
           scroll instead of showing the blank frame a promoted layer would. The
           window updates from `scrollTop` state, which Svelte flushes before the
           next paint - no flushSync (it over-flushes app-wide and, on a fling,
           starves the very handler that has to keep up with the scroll). -->
      <li class="sv-listbox__spacer" aria-hidden="true" style:height={`${vr.padTop}px`}></li>
      {#each windowed as opt (opt.index)}
        {@render optionLi(opt, opt.index)}
      {/each}
      <li class="sv-listbox__spacer" aria-hidden="true" style:height={`${vr.padBottom}px`}></li>
    {:else}
      {#each groupOptions(norm) as g (g.group ?? ' ')}
        {#if g.group != null}<li class="sv-listbox__group" role="presentation">{g.group}</li>{/if}
        {#each g.options as opt (opt.index)}
          {@render optionLi(opt, opt.index)}
        {/each}
      {/each}
    {/if}
  </ul>
  {#if name}{#each lb.selectedValues as v (v)}<input type="hidden" {name} value={v} />{/each}{/if}
</SvField>

{#snippet optionLi(opt, index)}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
  <li
    class="sv-listbox__opt"
    class:is-selected={isSel(opt)}
    class:is-active={lb.isActive(index)}
    class:is-disabled={opt.disabled}
    style:height={`${rowHeight}px`}
    {...lb.optionProps(index)}
  >
    {#if multiple}<span class="sv-listbox__check" aria-hidden="true">{isSel(opt) ? '✓' : ''}</span>{/if}
    {#if item ?? itemTemplate}{@render (item ?? itemTemplate)!(opt)}{:else}<span class="sv-listbox__label">{opt.label}</span>{/if}
  </li>
{/snippet}

<style>
  .sv-listbox {
    --_accent: var(--sg-accent, #2563eb);
    margin: 0; padding: 4px; list-style: none;
    max-height: calc(var(--sv-rows, 7) * var(--sv-row-h, 32px) + 8px); overflow-y: auto;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
    width: 220px; outline: none; --_fs: 13px;
  }
  .sv-listbox--sm { --_fs: 12px; }
  .sv-listbox--lg { --_fs: 15px; }
  .sv-listbox:focus-visible { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-listbox.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-listbox.is-invalid:focus-visible { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-danger, #dc2626) 22%, transparent); }
  /* Spacers reserve the off-screen height above/below the windowed rows. They
     also paint faint per-row skeleton bars: on a fast scrollbar-thumb drag the
     compositor can reveal this padding before JS re-windows (a drag jumps many
     rows in one frame - overscan can't cover it), so the user would see blank.
     The skeleton fills that gap with placeholder rows that the real rows paint
     over a frame later. Bars are one per `--sv-row-h` band, aligned to the row
     grid (padTop/padBottom are exact multiples of the row height). */
  .sv-listbox__spacer {
    padding: 0; margin: 0; flex: none; pointer-events: none; list-style: none;
    background-image: linear-gradient(
      to bottom,
      transparent 0,
      transparent calc((var(--sv-row-h, 32px) - 10px) / 2),
      var(--sg-skeleton, color-mix(in srgb, currentColor 9%, transparent)) calc((var(--sv-row-h, 32px) - 10px) / 2),
      var(--sg-skeleton, color-mix(in srgb, currentColor 9%, transparent)) calc((var(--sv-row-h, 32px) + 10px) / 2),
      transparent calc((var(--sv-row-h, 32px) + 10px) / 2),
      transparent var(--sv-row-h, 32px)
    );
    background-size: 62% var(--sv-row-h, 32px);
    background-repeat: repeat-y;
    background-position: 12px 0;
  }
  .sv-listbox__opt {
    display: flex; align-items: center; gap: 8px; box-sizing: border-box; flex: none; padding: 0 10px;
    border-radius: 6px; cursor: pointer; font-size: var(--_fs, 13px);
  }
  .sv-listbox__opt.is-active { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-listbox__opt.is-selected { background: color-mix(in srgb, var(--_accent) 14%, transparent); color: var(--_accent); font-weight: 600; }
  .sv-listbox__opt.is-selected.is-active { background: color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-listbox__opt.is-disabled { opacity: 0.4; cursor: not-allowed; }
  .sv-listbox__group {
    padding: 8px 10px 3px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
    color: var(--sg-muted, #94a3b8);
  }
  .sv-listbox__check { width: 14px; text-align: center; color: var(--_accent); }
  .sv-listbox__label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
