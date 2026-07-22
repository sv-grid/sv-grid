/**
 * createButtonGroup - the HEADLESS core behind <SvButtonGroup>: a segmented
 * button bar with single- or multi-select (or plain action buttons), roving
 * tabindex + full keyboard, exposed as **prop-getters** you spread onto YOUR OWN
 * markup. No styles, no DOM. Parity: Smart `smart-button-group`.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createButtonGroup } from '@svgrid/grid'
 *   let value = $state<string | null>('day')
 *   const g = createButtonGroup({ items: () => items, value: () => value, onChange: (v) => (value = v) })
 * </script>
 * <div {...g.rootProps()}>
 *   {#each items as it, i (it.value)}<button {...g.buttonProps(i)}>{it.label}</button>{/each}
 * </div>
 * ```
 *
 * The styled <SvButtonGroup> is one renderer over this core.
 */
import { editorAria, type EditorAriaState } from './editor-contract'

export type ButtonGroupItem = { value: string | number; label?: string; disabled?: boolean }
/** `single` = radio semantics; `multiple` = toggle set; `none` = action buttons. */
export type ButtonGroupMode = 'single' | 'multiple' | 'none'
export type ButtonGroupValue = string | number | Array<string | number> | null

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type ButtonGroupConfig = {
  items: () => ReadonlyArray<ButtonGroupItem>
  value: () => ButtonGroupValue
  onChange?: (value: string | number | Array<string | number>) => void
  mode?: () => ButtonGroupMode
  disabled?: () => boolean
  orientation?: () => 'horizontal' | 'vertical'
  /** Under `'rtl'` the horizontal Left/Right arrow direction flips. */
  dir?: () => 'ltr' | 'rtl' | 'auto' | undefined
  // Editor contract (ARIA + validation) - folded into rootProps().
  id?: () => string | undefined
  invalid?: () => boolean
  required?: () => boolean
  error?: () => string | undefined
  hint?: () => string | undefined
  ariaLabel?: () => string | undefined
}

/** Normalize the value to an array (pure). */
export function toGroupArray(value: ButtonGroupValue): Array<string | number> {
  if (value == null) return []
  return Array.isArray(value) ? [...value] : [value]
}

export function createButtonGroup(config: ButtonGroupConfig) {
  const items = () => config.items()
  const mode = () => config.mode?.() ?? 'single'
  const disabled = () => config.disabled?.() ?? false
  const isVert = () => (config.orientation?.() ?? 'horizontal') === 'vertical'
  const rtl = () => config.dir?.() === 'rtl'

  const selected = $derived(toGroupArray(config.value()))
  const enabledIdx = $derived(items().map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0))

  const isSelected = (v: string | number) => selected.includes(v)
  const selectedIdx = $derived(items().findIndex((it) => isSelected(it.value)))

  // Focus cursor. In single (radio) mode moving the cursor also selects, so the
  // roving-tabindex target follows the selection; multiple/none keep their own
  // cursor in `active`.
  let active = $state(0)
  $effect(() => {
    const it = items()[active]
    if (!it || it.disabled) active = enabledIdx[0] ?? 0
  })
  const cursor = $derived(
    mode() === 'single' ? (selectedIdx >= 0 ? selectedIdx : enabledIdx[0] ?? 0) : active,
  )

  function pick(i: number) {
    const it = items()[i]
    if (!it || it.disabled || disabled()) return
    active = i
    if (mode() === 'none') { config.onChange?.(it.value); return }
    if (mode() === 'multiple') {
      const set = new Set(selected)
      set.has(it.value) ? set.delete(it.value) : set.add(it.value)
      config.onChange?.([...set])
    } else {
      config.onChange?.(it.value)
    }
  }

  function goto(i: number) {
    // Radio semantics select on move; toggle/action only move focus.
    if (mode() === 'single') pick(i)
    else active = i
  }
  function move(delta: number) {
    if (!enabledIdx.length) return
    const pos = enabledIdx.indexOf(cursor)
    const next = enabledIdx[(pos + delta + enabledIdx.length) % enabledIdx.length]
    if (next != null) goto(next)
  }

  function onKeydown(e: KeyboardEvent) {
    if (disabled()) return
    const horiz = !isVert()
    const rtlH = horiz && rtl()
    const fwd = horiz ? (rtlH ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown'
    const back = horiz ? (rtlH ? 'ArrowRight' : 'ArrowLeft') : 'ArrowUp'
    if (e.key === fwd) { e.preventDefault(); move(1) }
    else if (e.key === back) { e.preventDefault(); move(-1) }
    else if (e.key === 'Home') { e.preventDefault(); goto(enabledIdx[0] ?? 0) }
    else if (e.key === 'End') { e.preventDefault(); goto(enabledIdx.at(-1) ?? 0) }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pick(cursor) }
  }

  const ariaState = (): EditorAriaState => ({
    id: config.id?.(),
    invalid: config.invalid?.(),
    required: config.required?.(),
    error: config.error?.(),
    hint: config.hint?.(),
    ariaLabel: config.ariaLabel?.(),
  })

  const groupRole = () => (mode() === 'single' ? 'radiogroup' : 'group')

  return {
    /** Roving-focus target index (follows the selection in single mode). */
    get activeIndex() { return cursor },
    /** Selected values as an array (single mode -> 0 or 1 entry). */
    get selectedValues() { return selected },
    isSelected,
    isActive: (i: number) => i === cursor,
    pick,
    move,
    onKeydown,
    /** Spread onto the group container element. */
    rootProps: () => ({
      role: groupRole(),
      id: config.id?.(),
      'aria-orientation': isVert() ? ('vertical' as const) : ('horizontal' as const),
      ...editorAria(ariaState()),
      onkeydown: onKeydown,
    }),
    /** Spread onto the button element at `index`. */
    buttonProps: (index: number) => {
      const it = items()[index]
      const on = it ? isSelected(it.value) : false
      const single = mode() === 'single'
      return {
        type: 'button' as const,
        role: single ? ('radio' as const) : undefined,
        'data-idx': index,
        'aria-checked': single ? on : undefined,
        'aria-pressed': mode() === 'multiple' ? on : undefined,
        'data-selected': on ? '' : undefined,
        disabled: disabled() || it?.disabled || undefined,
        // Roving tabindex: only the cursor (selection in single mode) is tabbable.
        tabindex: mode() === 'none' ? 0 : index === cursor ? 0 : -1,
        onclick: () => pick(index),
      }
    },
  }
}

export type ButtonGroup = ReturnType<typeof createButtonGroup>
