<script lang="ts">
  /**
   * SvListBox - an inline single/multi-select list (WAI-ARIA listbox) with
   * roving highlight + full keyboard. Parity: Smart `smart-list-box`. Controlled
   * via `value` (scalar or array) + `onChange`.
   */
  import type { ListOption } from './list-option'

  type Props = {
    options: ReadonlyArray<ListOption>
    value?: string | number | Array<string | number> | null
    onChange?: (value: any) => void
    multiple?: boolean
    disabled?: boolean
    /** Visible height in rows before scrolling. */
    rows?: number
    ariaLabel?: string
  }

  let { options, value = null, onChange, multiple = false, disabled = false, rows = 7, ariaLabel }: Props = $props()

  const selected = $derived<Array<string | number>>(
    multiple ? (Array.isArray(value) ? value : value == null ? [] : [value]) : value == null ? [] : [value as string | number],
  )
  const enabledIdx = $derived(options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0))
  let active = $state(0)
  $effect(() => {
    // Keep the active index on an enabled option.
    if (!options[active] || options[active]!.disabled) active = enabledIdx[0] ?? 0
  })

  function isSel(o: ListOption) { return selected.includes(o.value) }

  function pick(i: number) {
    const o = options[i]
    if (!o || o.disabled || disabled) return
    active = i
    if (multiple) {
      const set = new Set(selected)
      set.has(o.value) ? set.delete(o.value) : set.add(o.value)
      onChange?.([...set])
    } else {
      onChange?.(o.value)
    }
  }

  function move(delta: number) {
    const pos = enabledIdx.indexOf(active)
    const next = enabledIdx[(pos + delta + enabledIdx.length) % enabledIdx.length]
    if (next != null) { active = next; scrollActive() }
  }

  let listEl: HTMLUListElement | null = null
  function scrollActive() {
    queueMicrotask(() => listEl?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' }))
  }

  function onKeydown(e: KeyboardEvent) {
    if (disabled) return
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break
      case 'ArrowUp': e.preventDefault(); move(-1); break
      case 'Home': e.preventDefault(); active = enabledIdx[0] ?? 0; scrollActive(); break
      case 'End': e.preventDefault(); active = enabledIdx.at(-1) ?? 0; scrollActive(); break
      case ' ':
      case 'Enter': e.preventDefault(); pick(active); break
    }
  }
</script>

<ul
  bind:this={listEl}
  class="sv-listbox"
  role="listbox"
  aria-multiselectable={multiple}
  aria-label={ariaLabel}
  aria-disabled={disabled}
  tabindex={disabled ? -1 : 0}
  style:--sv-rows={rows}
  onkeydown={onKeydown}
>
  {#each options as opt, i (opt.value)}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
    <li
      class="sv-listbox__opt"
      class:is-selected={isSel(opt)}
      class:is-active={i === active}
      class:is-disabled={opt.disabled}
      role="option"
      aria-selected={isSel(opt)}
      aria-disabled={opt.disabled}
      data-idx={i}
      onclick={() => pick(i)}
      onpointermove={() => { if (!opt.disabled) active = i }}
    >
      {#if multiple}<span class="sv-listbox__check" aria-hidden="true">{isSel(opt) ? '✓' : ''}</span>{/if}
      <span class="sv-listbox__label">{opt.label}</span>
    </li>
  {/each}
</ul>

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
