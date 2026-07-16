/**
 * createCombobox - the HEADLESS core behind <SvComboBox>, in the same spirit as
 * `createListbox` / `createSvGrid`: a runes-based state machine (type-to-filter,
 * roving active index, full keyboard, unmatched-text revert) exposed as
 * **prop-getters** you spread onto YOUR OWN markup. No styles, no DOM, no portal
 * or measurement - those render concerns stay in the styled component.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createCombobox } from '@svgrid/grid'
 *   let value = $state<string | null>(null)
 *   const cb = createCombobox({ options: () => options, value: () => value, onChange: (v) => (value = v) })
 * </script>
 * <input {...cb.inputProps()} />
 * {#if cb.open}
 *   <ul {...cb.listboxProps()}>
 *     {#each cb.filtered as opt, i (opt.value)}<li {...cb.optionProps(i)}>{opt.label}</li>{/each}
 *   </ul>
 * {/if}
 * ```
 */
import { filterOptions, type ListOption } from './list-option'

export type ComboboxValue = string | number | null

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type ComboboxConfig = {
  options: () => ReadonlyArray<ListOption>
  value: () => ComboboxValue
  onChange?: (value: ComboboxValue) => void
  disabled?: () => boolean
  ariaLabel?: () => string | undefined
  /** DOM focus hooks provided by the renderer; the core itself never touches the DOM. */
  focusInput?: () => void
  blurInput?: () => void
}

let uid = 0

export function createCombobox(config: ComboboxConfig) {
  const id = `sv-combo-${uid++}`
  const listId = `${id}-list`
  const opts = () => config.options()
  const disabled = () => config.disabled?.() ?? false

  let open = $state(false)
  let query = $state('')
  let active = $state(0)
  let editing = $state(false)

  const selected = $derived(opts().find((o) => o.value === config.value()) ?? null)
  const filtered = $derived(editing ? filterOptions(opts(), query) : [...opts()])
  const shownText = $derived(editing ? query : selected?.label ?? '')

  // While not actively editing, keep the shown text in sync with the selection.
  $effect(() => { if (!editing) query = selected?.label ?? '' })

  const optionId = (i: number) => `${listId}-opt-${i}`

  function openPanel() { if (disabled() || open) return; open = true; active = 0 }
  function close(revert = true) {
    open = false; editing = false
    if (revert) query = selected?.label ?? ''
  }
  function toggle() { if (open) { close() } else { config.focusInput?.(); openPanel() } }
  function pick(o: ListOption | undefined) {
    if (!o || o.disabled) return
    config.onChange?.(o.value); query = o.label; editing = false; open = false; config.blurInput?.()
  }
  function setActive(i: number) { const o = filtered[i]; if (o && !o.disabled) active = i }
  function onInput(e: Event) {
    query = (e.currentTarget as HTMLInputElement).value
    editing = true; active = 0
    if (!open) openPanel()
  }
  function onFocus() { editing = true; query = selected?.label ?? ''; openPanel() }
  function onKeydown(e: KeyboardEvent) {
    if (disabled()) return
    if (!open && e.key === 'ArrowDown') { e.preventDefault(); editing = true; openPanel(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, filtered.length - 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(filtered[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
  }

  return {
    /** Panel open state. */
    get open() { return open },
    /** Highlighted option index into `filtered`. */
    get activeIndex() { return active },
    /** True while the user is typing a filter query. */
    get editing() { return editing },
    /** Current filter query text. */
    get query() { return query },
    /** Options after the live substring filter. */
    get filtered() { return filtered },
    /** The option matching the controlled value, if any. */
    get selected() { return selected },
    /** Text shown in the field (query while editing, else the selected label). */
    get shownText() { return shownText },
    /** Controlled value. */
    get value() { return config.value() },
    /** id of the listbox element (matches inputProps `aria-controls`). */
    listId,
    isActive: (i: number) => i === active,
    isSelected: (o: ListOption) => o.value === config.value(),
    setActive,
    openPanel,
    close,
    toggle,
    pick,
    onInput,
    onFocus,
    onKeydown,
    /** Spread onto the editable <input>. */
    inputProps: () => ({
      role: 'combobox' as const,
      'aria-expanded': open,
      'aria-controls': listId,
      'aria-autocomplete': 'list' as const,
      'aria-label': config.ariaLabel?.(),
      value: shownText,
      disabled: disabled(),
      oninput: onInput,
      onfocus: onFocus,
      onkeydown: onKeydown,
    }),
    /** Spread onto the chevron/toggle <button>. */
    triggerProps: () => ({
      type: 'button' as const,
      tabindex: -1,
      'aria-label': 'Toggle',
      disabled: disabled(),
      onclick: toggle,
    }),
    /** Spread onto the listbox container. */
    listboxProps: () => ({
      id: listId,
      role: 'listbox' as const,
    }),
    /** Spread onto the option at `index` (index into `filtered`). */
    optionProps: (index: number) => {
      const o = filtered[index]
      return {
        role: 'option' as const,
        id: optionId(index),
        tabindex: -1,
        'aria-selected': o ? o.value === config.value() : false,
        'aria-disabled': o?.disabled,
        'data-idx': index,
        onclick: () => pick(o),
        onpointermove: () => { if (o && !o.disabled) active = index },
      }
    },
  }
}

export type Combobox = ReturnType<typeof createCombobox>
