/**
 * createListbox - the HEADLESS core behind <SvListBox>, in the same spirit as
 * `createSvGrid` for the grid: a runes-based state machine (roving active index,
 * single/multi selection, full keyboard) with **prop-getters** you spread onto
 * YOUR OWN markup. No styles, no DOM assumptions - render it however you like.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createListbox } from '@svgrid/grid'
 *   let value = $state<string | null>(null)
 *   const lb = createListbox({
 *     options: () => options, value: () => value,
 *     onChange: (v) => (value = v),
 *   })
 * </script>
 * <ul {...lb.rootProps()}>
 *   {#each options as opt, i}
 *     <li {...lb.optionProps(i)}>{opt.label}</li>
 *   {/each}
 * </ul>
 * ```
 *
 * The styled <SvListBox> is just one renderer over this core.
 */
import { createTypeaheadBuffer, isTypeaheadKey, nextTypeaheadIndex, type ListOption } from './list-option'
import { editorAria, type EditorAriaState } from './editor-contract'

export type ListboxValue = string | number | Array<string | number> | null

/** Reactive inputs are passed as getters so the core tracks live prop changes
 *  (the same controlled pattern Svelte headless libraries use). */
export type ListboxConfig = {
  options: () => ReadonlyArray<ListOption>
  value: () => ListboxValue
  onChange?: (value: string | number | Array<string | number>) => void
  multiple?: () => boolean
  disabled?: () => boolean
  ariaLabel?: () => string | undefined
  // Editor contract (ARIA + validation) - folded into rootProps().
  id?: () => string | undefined
  invalid?: () => boolean
  required?: () => boolean
  error?: () => string | undefined
  hint?: () => string | undefined
}

export type OptionProps = {
  role: 'option'
  id: string
  'aria-selected': boolean
  'aria-disabled': boolean | undefined
  'data-idx': number
  'data-active': '' | undefined
  'data-selected': '' | undefined
  onclick: () => void
  onpointermove: () => void
}

export type ListboxRootProps = {
  role: 'listbox'
  id: string | undefined
  'aria-multiselectable': boolean
  'aria-label': string | undefined
  'aria-disabled': boolean
  'aria-activedescendant': string | undefined
  'aria-invalid': 'true' | undefined
  'aria-required': 'true' | undefined
  'aria-describedby': string | undefined
  tabindex: number
  onkeydown: (e: KeyboardEvent) => void
}

export type Listbox = {
  /** Currently highlighted option index (roving focus). */
  readonly activeIndex: number
  /** Selected values as an array (single mode -> 0 or 1 entry). */
  readonly selectedValues: Array<string | number>
  isSelected: (value: string | number) => boolean
  isActive: (index: number) => boolean
  setActive: (index: number) => void
  /** Toggle (multi) / set (single) the option at `index`. */
  pick: (index: number) => void
  /** Move the active highlight by `delta`, wrapping over enabled options. */
  move: (delta: number) => void
  first: () => void
  last: () => void
  onKeydown: (e: KeyboardEvent) => void
  /** Spread onto the list container element. */
  rootProps: () => ListboxRootProps
  /** Spread onto the option element at `index`. */
  optionProps: (index: number) => OptionProps
}

let uid = 0

/** Normalize a listbox value to an array (pure). */
export function toSelectedArray(value: ListboxValue, multiple: boolean): Array<string | number> {
  if (multiple) return Array.isArray(value) ? [...value] : value == null ? [] : [value]
  return value == null ? [] : [value as string | number]
}

export function createListbox(config: ListboxConfig): Listbox {
  const id = `sv-lb-${uid++}`
  const opts = () => config.options()
  const multiple = () => config.multiple?.() ?? false
  const disabled = () => config.disabled?.() ?? false

  let active = $state(0)
  const selected = $derived(toSelectedArray(config.value(), multiple()))
  const enabledIdx = $derived(opts().map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0))

  // Keep the active index on an enabled option as options change.
  $effect(() => {
    const o = opts()[active]
    if (!o || o.disabled) active = enabledIdx[0] ?? 0
  })

  const isSelected = (value: string | number) => selected.includes(value)
  const isActive = (index: number) => index === active
  const optionId = (index: number) => `${id}-opt-${index}`

  function setActive(index: number) {
    const o = opts()[index]
    if (o && !o.disabled) active = index
  }

  function pick(index: number) {
    const o = opts()[index]
    if (!o || o.disabled || disabled()) return
    active = index
    if (multiple()) {
      const set = new Set(selected)
      set.has(o.value) ? set.delete(o.value) : set.add(o.value)
      config.onChange?.([...set])
    } else {
      config.onChange?.(o.value)
    }
  }

  function move(delta: number) {
    const list = enabledIdx
    if (!list.length) return
    const pos = list.indexOf(active)
    const next = list[(pos + delta + list.length) % list.length]
    if (next != null) active = next
  }
  const first = () => { active = enabledIdx[0] ?? 0 }
  const last = () => { active = enabledIdx.at(-1) ?? 0 }

  // Type-ahead: typing a label prefix jumps the active highlight to it.
  const typeahead = createTypeaheadBuffer()
  function onTypeahead(char: string) {
    const buffer = typeahead.push(char.toLowerCase())
    const next = nextTypeaheadIndex(opts(), buffer, active)
    if (next >= 0) active = next
  }

  function onKeydown(e: KeyboardEvent) {
    if (disabled()) return
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break
      case 'ArrowUp': e.preventDefault(); move(-1); break
      case 'Home': e.preventDefault(); first(); break
      case 'End': e.preventDefault(); last(); break
      case ' ':
      case 'Enter': e.preventDefault(); pick(active); break
      default: if (isTypeaheadKey(e)) onTypeahead(e.key)
    }
  }

  // Editor-contract ARIA state, folded onto the focusable listbox root.
  const ariaState = (): EditorAriaState => ({
    id: config.id?.(),
    invalid: config.invalid?.(),
    required: config.required?.(),
    error: config.error?.(),
    hint: config.hint?.(),
    ariaLabel: config.ariaLabel?.(),
  })

  return {
    get activeIndex() { return active },
    get selectedValues() { return selected },
    isSelected,
    isActive,
    setActive,
    pick,
    move,
    first,
    last,
    onKeydown,
    rootProps: () => ({
      role: 'listbox' as const,
      id: config.id?.(),
      'aria-multiselectable': multiple(),
      'aria-disabled': disabled(),
      'aria-activedescendant': opts()[active] ? optionId(active) : undefined,
      // aria-label + aria-invalid/required/describedby from the editor contract.
      ...editorAria(ariaState()),
      tabindex: disabled() ? -1 : 0,
      onkeydown: onKeydown,
    }),
    optionProps: (index: number) => {
      const o = opts()[index]
      return {
        role: 'option',
        id: optionId(index),
        'aria-selected': o ? isSelected(o.value) : false,
        'aria-disabled': o?.disabled,
        'data-idx': index,
        'data-active': isActive(index) ? '' : undefined,
        'data-selected': o && isSelected(o.value) ? '' : undefined,
        onclick: () => pick(index),
        onpointermove: () => setActive(index),
      }
    },
  }
}
