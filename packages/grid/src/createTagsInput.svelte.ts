/**
 * createTagsInput - the HEADLESS core behind <SvTagsInput>: an editable
 * token/chips field (type + Enter/comma to add, Backspace to remove the last,
 * per-chip remove). Owns the draft text + add/remove behavior + keyboard,
 * exposed as **prop-getters** you spread onto YOUR OWN markup. No styles/DOM.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createTagsInput } from '@svgrid/grid'
 *   let tags = $state<string[]>([])
 *   const ti = createTagsInput({ value: () => tags, onChange: (t) => (tags = t) })
 * </script>
 * <div {...ti.rootProps()}>
 *   {#each ti.tags as tag, i (tag + i)}
 *     <span {...ti.tagProps(i)}>{tag}<button {...ti.removeProps(i)}>x</button></span>
 *   {/each}
 *   <input {...ti.inputProps()} />
 * </div>
 * ```
 */

import { editorAria, type EditorAriaState } from './editor-contract'

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type TagsInputConfig = {
  value: () => string[]
  onChange?: (tags: string[]) => void
  disabled?: () => boolean
  /** Reject duplicate tags. Default true. */
  unique?: () => boolean
  max?: () => number
  ariaLabel?: () => string | undefined
  /** Accessible label for the draft input (localizable). */
  addLabel?: () => string | undefined
  /** Accessible label prefix for a chip's remove button (localizable). */
  removeLabel?: () => string | undefined
  // Editor contract (ARIA + validation) - folded into rootProps().
  id?: () => string | undefined
  invalid?: () => boolean
  required?: () => boolean
  error?: () => string | undefined
  hint?: () => string | undefined
}

export function createTagsInput(config: TagsInputConfig) {
  const disabled = () => config.disabled?.() ?? false
  const unique = () => config.unique?.() ?? true
  const max = () => config.max?.() ?? Infinity
  const tags = () => config.value()

  const ariaState = (): EditorAriaState => ({
    id: config.id?.(),
    invalid: config.invalid?.(),
    required: config.required?.(),
    error: config.error?.(),
    hint: config.hint?.(),
    ariaLabel: config.ariaLabel?.(),
  })

  let draft = $state('')

  function add(raw: string) {
    const tag = raw.trim()
    if (!tag || disabled()) return
    if (tags().length >= max()) return
    if (unique() && tags().includes(tag)) { draft = ''; return }
    config.onChange?.([...tags(), tag])
    draft = ''
  }
  function removeAt(i: number) {
    if (disabled()) return
    config.onChange?.(tags().filter((_, idx) => idx !== i))
  }
  function setDraft(v: string) { draft = v }
  function onInput(e: Event) { draft = (e.currentTarget as HTMLInputElement).value }
  function onKeydown(e: KeyboardEvent) {
    if (disabled()) return
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft) }
    else if (e.key === 'Backspace' && draft === '' && tags().length) { removeAt(tags().length - 1) }
  }
  function onBlur() { add(draft) }

  return {
    /** Current tags (controlled value). */
    get tags() { return tags() },
    /** Current draft text in the input. */
    get draft() { return draft },
    add,
    removeAt,
    setDraft,
    /** Spread onto the container element. */
    rootProps: () => ({
      role: 'group' as const,
      ...editorAria(ariaState()),
    }),
    /** Spread onto the text <input>. */
    inputProps: () => ({
      type: 'text' as const,
      value: draft,
      disabled: disabled(),
      'aria-label': config.addLabel?.() ?? config.ariaLabel?.() ?? 'Add tag',
      oninput: onInput,
      onkeydown: onKeydown,
      onblur: onBlur,
    }),
    /** Spread onto the chip wrapper at `index`. */
    tagProps: (index: number) => ({
      'data-idx': index,
    }),
    /** Spread onto a chip's remove <button> at `index`. */
    removeProps: (index: number) => ({
      type: 'button' as const,
      'aria-label': `${config.removeLabel?.() ?? 'Remove'} ${tags()[index] ?? ''}`.trim(),
      onclick: () => removeAt(index),
    }),
  }
}

export type TagsInput = ReturnType<typeof createTagsInput>
