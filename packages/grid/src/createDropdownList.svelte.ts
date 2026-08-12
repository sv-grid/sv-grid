/**
 * createDropdownList - the HEADLESS core behind <SvDropDownList>: a single-select
 * dropdown state machine (trigger open/close, roving active index over enabled
 * options, full keyboard) exposed as **prop-getters** you spread onto YOUR OWN
 * markup. No styles, no DOM, no portal/measurement - those stay in the styled
 * component.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createDropdownList } from '@svgrid/grid'
 *   let value = $state<string | null>(null)
 *   const dd = createDropdownList({ options: () => options, value: () => value, onChange: (v) => (value = v) })
 * </script>
 * <button {...dd.triggerProps()}>{dd.selected?.label ?? 'Select'}</button>
 * {#if dd.open}
 *   <ul {...dd.listboxProps()}>
 *     {#each options as opt, i (opt.value)}<li {...dd.optionProps(i)}>{opt.label}</li>{/each}
 *   </ul>
 * {/if}
 * ```
 */
import { createTypeaheadBuffer, isTypeaheadKey, nextTypeaheadIndex, type ListOption } from './list-option'
import { editorAria, type EditorAriaState } from './editor-contract'

export type DropdownValue = string | number | null

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type DropdownListConfig = {
  options: () => ReadonlyArray<ListOption>
  value: () => DropdownValue
  onChange?: (value: string | number) => void
  disabled?: () => boolean
  /** Read-only: value shown, trigger focusable, but the panel will not open. */
  readonly?: () => boolean
  ariaLabel?: () => string | undefined
  /** DOM focus hook provided by the renderer; the core never touches the DOM. */
  focusTrigger?: () => void
  // Editor contract (ARIA + validation) - folded into triggerProps().
  id?: () => string | undefined
  invalid?: () => boolean
  required?: () => boolean
  error?: () => string | undefined
  hint?: () => string | undefined
}

let uid = 0

export function createDropdownList(config: DropdownListConfig) {
  const listId = `sv-ddl-${uid++}`
  const optionId = (index: number) => `${listId}-opt-${index}`
  const opts = () => config.options()
  const disabled = () => config.disabled?.() ?? false
  const readonly = () => config.readonly?.() ?? false

  const ariaState = (): EditorAriaState => ({
    id: config.id?.(),
    invalid: config.invalid?.(),
    required: config.required?.(),
    error: config.error?.(),
    hint: config.hint?.(),
    ariaLabel: config.ariaLabel?.(),
  })

  let open = $state(false)
  let active = $state(-1)

  const selected = $derived(opts().find((o) => o.value === config.value()) ?? null)
  const enabledIdx = $derived(opts().map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0))

  function openPanel() {
    if (disabled() || readonly() || open) return
    open = true
    active = Math.max(0, opts().findIndex((o) => o.value === config.value()))
  }
  function close() { open = false }
  function toggle() { if (open) { close() } else { openPanel() } }
  function pick(i: number) {
    if (readonly()) return
    const o = opts()[i]
    if (!o || o.disabled) return
    config.onChange?.(o.value); close(); config.focusTrigger?.()
  }
  function setActive(i: number) { const o = opts()[i]; if (o && !o.disabled) active = i }
  function move(d: number) {
    const pos = enabledIdx.indexOf(active)
    active = enabledIdx[(pos + d + enabledIdx.length) % enabledIdx.length] ?? active
  }
  // Type-ahead: typing a label prefix jumps the active option (and selects it
  // when the list is closed, matching a native <select>).
  const typeahead = createTypeaheadBuffer()
  function onTypeahead(char: string) {
    if (readonly()) return
    const buffer = typeahead.push(char.toLowerCase())
    const from = active >= 0 ? active : opts().findIndex((o) => o.value === config.value())
    const next = nextTypeaheadIndex(opts(), buffer, from)
    if (next < 0) return
    active = next
    if (!open) config.onChange?.(opts()[next]!.value)
  }
  function onKeydown(e: KeyboardEvent) {
    if (disabled() || readonly()) return
    if (isTypeaheadKey(e)) { onTypeahead(e.key); return }
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPanel(); return }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active) }
    else if (e.key === 'Escape') { e.preventDefault(); close(); config.focusTrigger?.() }
    else if (e.key === 'Home') { active = enabledIdx[0] ?? 0 }
    else if (e.key === 'End') { active = enabledIdx.at(-1) ?? 0 }
  }

  return {
    /** Panel open state. */
    get open() { return open },
    /** Highlighted option index into `options`. */
    get activeIndex() { return active },
    /** The option matching the controlled value, if any. */
    get selected() { return selected },
    /** Controlled value. */
    get value() { return config.value() },
    isActive: (i: number) => i === active,
    isSelected: (o: ListOption) => o.value === config.value(),
    setActive,
    openPanel,
    close,
    toggle,
    pick,
    move,
    onKeydown,
    /** Spread onto the trigger <button>. */
    triggerProps: () => ({
      id: config.id?.(),
      type: 'button' as const,
      'aria-haspopup': 'listbox' as const,
      'aria-expanded': open,
      'aria-controls': listId,
      'aria-activedescendant': open && opts()[active] ? optionId(active) : undefined,
      ...editorAria(ariaState()),
      'aria-readonly': readonly() || undefined,
      disabled: disabled(),
      onclick: toggle,
      onkeydown: onKeydown,
    }),
    /** Spread onto the listbox container. */
    listboxProps: () => ({
      id: listId,
      role: 'listbox' as const,
      tabindex: -1,
    }),
    /** Spread onto the option at `index` (index into `options`). */
    optionProps: (index: number) => {
      const o = opts()[index]
      return {
        role: 'option' as const,
        id: optionId(index),
        tabindex: -1,
        'aria-selected': o ? o.value === config.value() : false,
        'aria-disabled': o?.disabled,
        'data-idx': index,
        onclick: () => pick(index),
        onpointermove: () => { if (o && !o.disabled) active = index },
      }
    },
  }
}

export type DropdownList = ReturnType<typeof createDropdownList>
