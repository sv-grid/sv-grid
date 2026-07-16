<script lang="ts">
  /**
   * SvListBox - an inline single/multi-select list (WAI-ARIA listbox) with
   * roving highlight + full keyboard. Parity: Smart `smart-list-box`. Controlled
   * via `value` (scalar or array) + `onChange`.
   */
  import type { ListOption } from './list-option'
  import { createListbox } from './createListbox.svelte'

  type Props = {
    options: ReadonlyArray<ListOption>
    value?: string | number | Array<string | number> | null
    onChange?: (value: any) => void
    multiple?: boolean
    disabled?: boolean
    /** Visible height in rows before scrolling. */
    rows?: number
    ariaLabel?: string
    /** Form field name; emits a hidden input per selected value so the listbox
     *  posts in a native <form> (multiple selection -> repeated name). */
    name?: string
  }

  let { options, value = null, onChange, multiple = false, disabled = false, rows = 7, ariaLabel, name }: Props = $props()

  // The styled listbox is just a renderer over the headless core.
  const lb = createListbox({
    options: () => options,
    value: () => value,
    onChange: (v) => onChange?.(v),
    multiple: () => multiple,
    disabled: () => disabled,
    ariaLabel: () => ariaLabel,
  })
  const isSel = (o: ListOption) => lb.isSelected(o.value)

  let listEl: HTMLUListElement | null = null
  // Scroll-into-view is a render concern, so it lives here (not in the core).
  $effect(() => {
    const i = lb.activeIndex
    queueMicrotask(() => listEl?.querySelector<HTMLElement>(`[data-idx="${i}"]`)?.scrollIntoView({ block: 'nearest' }))
  })
</script>

<div style="display: contents">
<ul
  bind:this={listEl}
  class="sv-listbox"
  style:--sv-rows={rows}
  {...lb.rootProps()}
>
  {#each options as opt, i (opt.value)}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
    <li
      class="sv-listbox__opt"
      class:is-selected={isSel(opt)}
      class:is-active={lb.isActive(i)}
      class:is-disabled={opt.disabled}
      {...lb.optionProps(i)}
    >
      {#if multiple}<span class="sv-listbox__check" aria-hidden="true">{isSel(opt) ? '✓' : ''}</span>{/if}
      <span class="sv-listbox__label">{opt.label}</span>
    </li>
  {/each}
</ul>
{#if name}{#each lb.selectedValues as v (v)}<input type="hidden" {name} value={v} />{/each}{/if}
</div>

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
  .sv-listbox__opt {
    display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 10px;
    border-radius: 6px; cursor: pointer; font-size: 13px;
  }
  .sv-listbox__opt.is-active { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-listbox__opt.is-selected { background: color-mix(in srgb, var(--_accent) 14%, transparent); color: var(--_accent); font-weight: 600; }
  .sv-listbox__opt.is-selected.is-active { background: color-mix(in srgb, var(--_accent) 22%, transparent); }
  .sv-listbox__opt.is-disabled { opacity: 0.4; cursor: not-allowed; }
  .sv-listbox__check { width: 14px; text-align: center; color: var(--_accent); }
  .sv-listbox__label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
