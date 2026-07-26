/**
 * createAutocomplete - the HEADLESS core behind <SvAutoComplete>: a free-text
 * field with a live-filtered suggestion list (accepts ANY typed value; the
 * suggestions are shortcuts). Roving active index + keyboard, exposed as
 * **prop-getters** you spread onto YOUR OWN markup. No styles/DOM/portal - those
 * stay in the styled component.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createAutocomplete } from '@svgrid/grid'
 *   let value = $state('')
 *   const ac = createAutocomplete({ value: () => value, suggestions: () => list, onChange: (v) => (value = v) })
 * </script>
 * <input {...ac.inputProps()} />
 * {#if ac.open}
 *   <ul {...ac.listboxProps()}>
 *     {#each ac.filtered as opt, i (opt.value)}<li {...ac.optionProps(i)}>{opt.label}</li>{/each}
 *   </ul>
 * {/if}
 * ```
 */
import { filterOptions, type ListOption } from './list-option'
import { editorAria, type EditorAriaState } from './editor-contract'

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type AutocompleteConfig = {
  value: () => string
  onChange?: (value: string) => void
  /** Suggestions - strings or {value,label} (label shown, value inserted). */
  suggestions: () => ReadonlyArray<string | ListOption>
  minChars?: () => number
  disabled?: () => boolean
  ariaLabel?: () => string | undefined
  /** DOM focus hook provided by the renderer; the core never touches the DOM. */
  focusInput?: () => void
  // Editor contract (ARIA + validation) - folded into inputProps().
  id?: () => string | undefined
  invalid?: () => boolean
  required?: () => boolean
  error?: () => string | undefined
  hint?: () => string | undefined
}

let uid = 0

export function createAutocomplete(config: AutocompleteConfig) {
  const id = `sv-ac-${uid++}`
  const listId = `${id}-list`
  const optionId = (index: number) => `${listId}-opt-${index}`
  const minChars = () => config.minChars?.() ?? 1

  const ariaState = (): EditorAriaState => ({
    id: config.id?.(),
    invalid: config.invalid?.(),
    required: config.required?.(),
    error: config.error?.(),
    hint: config.hint?.(),
    ariaLabel: config.ariaLabel?.(),
  })

  let open = $state(false)
  let active = $state(0)

  const asOptions = $derived<ListOption[]>(
    config.suggestions().map((s) => (typeof s === 'string' ? { value: s, label: s } : s)),
  )
  const filtered = $derived(config.value().length >= minChars() ? filterOptions(asOptions, config.value()).slice(0, 10) : [])

  function maybeOpen() { open = filtered.length > 0; if (open) active = 0 }
  function pick(o: ListOption | undefined) { if (!o) return; config.onChange?.(String(o.value)); open = false; config.focusInput?.() }
  function close() { open = false }
  function onInput(e: Event) { config.onChange?.((e.currentTarget as HTMLInputElement).value); queueMicrotask(maybeOpen) }
  function onKeydown(e: KeyboardEvent) {
    if (!open) { if (e.key === 'ArrowDown') { queueMicrotask(maybeOpen) } return }
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, filtered.length - 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(filtered[active]) }
    else if (e.key === 'Escape') { close() }
  }

  return {
    /** Panel open state. */
    get open() { return open },
    /** Highlighted suggestion index into `filtered`. */
    get activeIndex() { return active },
    /** Suggestions after the live substring filter (capped at 10). */
    get filtered() { return filtered },
    /** Controlled text value. */
    get value() { return config.value() },
    /** id of the listbox element (matches inputProps `aria-controls`). */
    listId,
    isActive: (i: number) => i === active,
    setActive: (i: number) => { active = i },
    maybeOpen,
    close,
    pick,
    onInput,
    onKeydown,
    /** Spread onto the text <input>. */
    inputProps: () => ({
      id: config.id?.(),
      role: 'combobox' as const,
      'aria-expanded': open,
      'aria-controls': listId,
      'aria-autocomplete': 'list' as const,
      'aria-activedescendant': open && filtered[active] ? optionId(active) : undefined,
      ...editorAria(ariaState()),
      value: config.value(),
      disabled: config.disabled?.() ?? false,
      oninput: onInput,
      onfocus: maybeOpen,
      onkeydown: onKeydown,
    }),
    /** Spread onto the listbox container. */
    listboxProps: () => ({
      id: listId,
      role: 'listbox' as const,
    }),
    /** Spread onto the suggestion at `index` (index into `filtered`). */
    optionProps: (index: number) => ({
      id: optionId(index),
      role: 'option' as const,
      tabindex: -1,
      'aria-selected': index === active,
      'data-idx': index,
      onclick: () => pick(filtered[index]),
      onpointermove: () => { active = index },
    }),
  }
}

export type Autocomplete = ReturnType<typeof createAutocomplete>
