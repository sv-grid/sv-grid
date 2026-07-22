<script lang="ts">
  /**
   * SvListBox - an inline single/multi-select list (WAI-ARIA listbox) with
   * roving highlight + full keyboard. Parity: Smart `smart-list-box`. Controlled
   * via `value` (scalar or array) + `onChange`. Scales to huge option sets with
   * `virtual` (fixed-row windowing), and each row can be an `itemTemplate`.
   */
  import { flushSync, type Snippet } from 'svelte'
  import { groupOptions, hasGroups, type ListOption } from './list-option'
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
    itemTemplate?: Snippet<[ListOption]>
  }

  let {
    options,
    value = null,
    onChange,
    multiple = false,
    disabled = false,
    rows = 7,
    virtual = false,
    rowHeight = 32,
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

  // The styled listbox is just a renderer over the headless core.
  const lb = createListbox({
    options: () => options,
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
  const useVirtual = $derived(virtual && !hasGroups(options))
  let listEl = $state<HTMLUListElement | null>(null)
  let scrollTop = $state(0)
  let viewportH = $state(0)
  const vr = $derived(
    virtualRange({ scrollTop, viewportHeight: viewportH, rowHeight, count: options.length, overscan: 10 }),
  )
  const windowed = $derived(
    useVirtual ? options.slice(vr.start, vr.end).map((o, i) => ({ ...o, index: vr.start + i })) : [],
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
    class="sv-listbox"
    class:is-invalid={invalid}
    class:is-virtual={useVirtual}
    style:--sv-rows={rows}
    onscroll={(e) => { scrollTop = e.currentTarget.scrollTop; if (useVirtual) flushSync() }}
    bind:clientHeight={viewportH}
    {...lb.rootProps()}
  >
    {#if useVirtual}
      <!-- Fixed-height sizer establishes the scroll range; rows are absolutely
           positioned by transform so scrolling never reflows (no flash). -->
      <li class="sv-listbox__sizer" aria-hidden="true" style:height={`${vr.totalHeight}px`}></li>
      {#each windowed as opt (opt.value)}
        {@render optionLi(opt, opt.index)}
      {/each}
    {:else}
      {#each groupOptions(options) as g (g.group ?? ' ')}
        {#if g.group != null}<li class="sv-listbox__group" role="presentation">{g.group}</li>{/if}
        {#each g.options as opt (opt.value)}
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
    style:transform={useVirtual ? `translateY(${index * rowHeight}px)` : undefined}
    {...lb.optionProps(index)}
  >
    {#if multiple}<span class="sv-listbox__check" aria-hidden="true">{isSel(opt) ? '✓' : ''}</span>{/if}
    {#if itemTemplate}{@render itemTemplate(opt)}{:else}<span class="sv-listbox__label">{opt.label}</span>{/if}
  </li>
{/snippet}

<style>
  .sv-listbox {
    --_accent: var(--sg-accent, #2563eb);
    margin: 0; padding: 4px; list-style: none;
    max-height: calc(var(--sv-rows, 7) * 32px + 8px); overflow-y: auto;
    background: var(--sg-input-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-input-border, var(--sg-border, #cbd5e1)); border-radius: var(--sg-radius, 8px);
    width: 220px; outline: none;
  }
  .sv-listbox:focus-visible { border-color: var(--_accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-listbox.is-invalid { border-color: var(--sg-danger, #dc2626); }
  .sv-listbox.is-invalid:focus-visible { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sg-danger, #dc2626) 22%, transparent); }
  /* Pre-promote the scrolling-contents layer at mount so the FIRST scroll
     doesn't trigger a one-time layer promotion + repaint (the initial flash). */
  .sv-listbox.is-virtual { position: relative; will-change: scroll-position; }
  .sv-listbox__sizer { padding: 0; margin: 0; pointer-events: none; }
  .sv-listbox.is-virtual .sv-listbox__opt {
    position: absolute; inset-inline: 4px; top: 4px;
  }
  .sv-listbox__opt {
    display: flex; align-items: center; gap: 8px; box-sizing: border-box; padding: 0 10px;
    border-radius: 6px; cursor: pointer; font-size: 13px;
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
