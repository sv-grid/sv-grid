/**
 * createAccordion - the HEADLESS core behind <SvAccordion>: a WAI-ARIA accordion
 * (collapsible sections) with single- or multiple-expand, roving header focus
 * (Up/Down/Home/End) and full ARIA, exposed as **prop-getters** you spread onto
 * YOUR OWN markup. No styles, no DOM. Parity: Smart `smart-accordion`.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createAccordion } from '@svgrid/grid'
 *   let expanded = $state<string[]>(['a'])
 *   const acc = createAccordion({ items: () => items, expanded: () => expanded, onChange: (ids) => (expanded = ids) })
 * </script>
 * {#each items as it, i (it.id)}
 *   <h3><button {...acc.headerProps(i)}>{it.label}</button></h3>
 *   {#if acc.isExpanded(it.id)}<div {...acc.panelProps(i)}>...</div>{/if}
 * {/each}
 * ```
 *
 * The styled <SvAccordion> is one renderer over this core. DOM focus movement is
 * a render concern: the component watches `focusTick`/`focusIndex` and calls
 * `.focus()` itself.
 */
export type AccordionItem = { id: string; label: string; disabled?: boolean }
/** `single` keeps at most one panel open; `multiple` allows any number. */
export type AccordionExpandMode = 'single' | 'multiple'

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type AccordionConfig = {
  items: () => ReadonlyArray<AccordionItem>
  /** Expanded item ids (controlled). */
  expanded: () => string[]
  onChange?: (expandedIds: string[]) => void
  expandMode?: () => AccordionExpandMode
  disabled?: () => boolean
  dir?: () => 'ltr' | 'rtl' | 'auto' | undefined
}

let uid = 0

export function createAccordion(config: AccordionConfig) {
  const id = `sv-acc-${uid++}`
  const items = () => config.items()
  const expandMode = () => config.expandMode?.() ?? 'single'
  const disabled = () => config.disabled?.() ?? false

  const expandedSet = $derived(new Set(config.expanded()))
  const enabledIdx = $derived(items().map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0))

  let focusIndex = $state(0)
  let focusTick = $state(0)
  const requestFocus = (i: number) => { focusIndex = i; focusTick++ }

  const headerId = (i: number) => `${id}-h-${i}`
  const panelId = (i: number) => `${id}-p-${i}`
  const isExpanded = (itemId: string) => expandedSet.has(itemId)

  function toggle(i: number) {
    const it = items()[i]
    if (!it || it.disabled || disabled()) return
    const open = expandedSet.has(it.id)
    if (expandMode() === 'single') {
      config.onChange?.(open ? [] : [it.id])
    } else {
      const next = new Set(expandedSet)
      open ? next.delete(it.id) : next.add(it.id)
      config.onChange?.([...next])
    }
  }

  function move(delta: number) {
    if (!enabledIdx.length) return
    const pos = enabledIdx.indexOf(focusIndex)
    const base = pos < 0 ? 0 : pos
    const next = enabledIdx[(base + delta + enabledIdx.length) % enabledIdx.length]
    if (next != null) requestFocus(next)
  }

  function onHeaderKeydown(e: KeyboardEvent, i: number) {
    if (disabled()) return
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break
      case 'ArrowUp': e.preventDefault(); move(-1); break
      case 'Home': e.preventDefault(); requestFocus(enabledIdx[0] ?? 0); break
      case 'End': e.preventDefault(); requestFocus(enabledIdx.at(-1) ?? 0); break
      case 'Enter':
      case ' ': e.preventDefault(); toggle(i); break
    }
  }

  return {
    /** Header index that should hold DOM focus after the latest keyboard move. */
    get focusIndex() { return focusIndex },
    /** Monotonic counter; changes only on keyboard navigation. */
    get focusTick() { return focusTick },
    /** Currently-expanded item ids. */
    get expandedIds() { return [...expandedSet] },
    isExpanded,
    toggle,
    /** Spread onto the accordion root container. */
    rootProps: () => ({
      'data-orientation': 'vertical' as const,
    }),
    /** Spread onto the header <button> at `index`. */
    headerProps: (index: number) => {
      const it = items()[index]
      return {
        type: 'button' as const,
        id: headerId(index),
        'data-idx': index,
        'aria-expanded': it ? isExpanded(it.id) : false,
        'aria-controls': panelId(index),
        disabled: disabled() || it?.disabled || undefined,
        onclick: () => toggle(index),
        onkeydown: (e: KeyboardEvent) => onHeaderKeydown(e, index),
      }
    },
    /** Spread onto the panel/region element at `index`. */
    panelProps: (index: number) => ({
      role: 'region' as const,
      id: panelId(index),
      'aria-labelledby': headerId(index),
    }),
  }
}

export type Accordion = ReturnType<typeof createAccordion>
