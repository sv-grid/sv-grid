/**
 * createCountryInput - the HEADLESS core behind <SvCountryInput>: a searchable
 * country picker (search by name, dial code, or ISO code; roving active index +
 * keyboard) that emits the ISO 3166-1 alpha-2 code. Exposed as **prop-getters**
 * you spread onto YOUR OWN markup. No styles/DOM/portal - those stay in the
 * styled component.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createCountryInput, flagEmoji } from '@svgrid/grid'
 *   let value = $state<string | null>(null)
 *   const ci = createCountryInput({ value: () => value, onChange: (c) => (value = c) })
 * </script>
 * <button {...ci.triggerProps()}>{ci.selected?.name ?? 'Select'}</button>
 * {#if ci.open}
 *   <input {...ci.searchProps()} />
 *   <ul {...ci.listboxProps()}>
 *     {#each ci.filtered as c, i (c.code)}<li {...ci.optionProps(i)}>{c.name}</li>{/each}
 *   </ul>
 * {/if}
 * ```
 */
import { COUNTRIES, COUNTRY_BY_CODE, type Country } from './countries'

/** Reactive inputs are passed as getters so the core tracks live prop changes. */
export type CountryInputConfig = {
  value: () => string | null
  onChange?: (code: string) => void
  disabled?: () => boolean
  ariaLabel?: () => string | undefined
  /** DOM focus hook provided by the renderer; the core never touches the DOM. */
  focusTrigger?: () => void
}

export function createCountryInput(config: CountryInputConfig) {
  const disabled = () => config.disabled?.() ?? false

  let open = $state(false)
  let query = $state('')
  let active = $state(0)

  const selected = $derived(config.value() ? COUNTRY_BY_CODE.get(config.value()!) ?? null : null)
  const filtered = $derived<Country[]>(
    query.trim() === ''
      ? COUNTRIES
      : COUNTRIES.filter(
          (c) =>
            c.name.toLowerCase().includes(query.toLowerCase()) ||
            c.dial.includes(query) ||
            c.code.toLowerCase() === query.toLowerCase(),
        ),
  )

  function openPanel() { if (disabled() || open) return; open = true; query = ''; active = 0 }
  function close() { open = false; config.focusTrigger?.() }
  function toggle() { if (open) { open = false } else { openPanel() } }
  function pick(code: string) { config.onChange?.(code); open = false; config.focusTrigger?.() }
  function setQuery(v: string) { query = v; active = 0 }
  function onSearchInput(e: Event) { setQuery((e.currentTarget as HTMLInputElement).value) }
  function onKeydown(e: KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, filtered.length - 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0) }
    else if (e.key === 'Enter') { e.preventDefault(); const c = filtered[active]; if (c) pick(c.code) }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
  }

  return {
    /** Panel open state. */
    get open() { return open },
    /** Highlighted country index into `filtered`. */
    get activeIndex() { return active },
    /** Current search query. */
    get query() { return query },
    /** Countries after the current search filter. */
    get filtered() { return filtered },
    /** The selected country, if any. */
    get selected() { return selected },
    /** Controlled value (ISO alpha-2 code). */
    get value() { return config.value() },
    isActive: (i: number) => i === active,
    isSelected: (code: string) => code === config.value(),
    setActive: (i: number) => { active = i },
    setQuery,
    openPanel,
    close,
    toggle,
    pick,
    onKeydown,
    /** Spread onto the trigger <button>. */
    triggerProps: () => ({
      type: 'button' as const,
      'aria-haspopup': 'listbox' as const,
      'aria-expanded': open,
      'aria-label': config.ariaLabel?.(),
      disabled: disabled(),
      onclick: toggle,
    }),
    /** Spread onto the search <input> inside the panel. */
    searchProps: () => ({
      type: 'text' as const,
      value: query,
      'aria-label': 'Search countries',
      oninput: onSearchInput,
      onkeydown: onKeydown,
    }),
    /** Spread onto the listbox container. */
    listboxProps: () => ({
      role: 'listbox' as const,
    }),
    /** Spread onto the country option at `index` (index into `filtered`). */
    optionProps: (index: number) => {
      const c = filtered[index]
      return {
        role: 'option' as const,
        tabindex: -1,
        'aria-selected': c ? c.code === config.value() : false,
        'data-idx': index,
        onclick: () => { if (c) pick(c.code) },
        onpointermove: () => { active = index },
      }
    },
  }
}

export type CountryInput = ReturnType<typeof createCountryInput>
