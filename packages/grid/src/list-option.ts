/** Shared option shape for the SvGrid UI-kit selection controls. */
export type ListOption = {
  value: string | number
  label: string
  disabled?: boolean
  /** Optional group heading this option belongs under. */
  group?: string
  /** Optional color swatch (any CSS color) shown before the label. */
  color?: string
}

/**
 * Coerce a raw options array into well-formed ListOptions. A primitive item
 * (`1`, `'a'`) becomes `{ value, label: String(value) }`; an object missing a
 * `label` or `value` gets the other filled in. This makes a caller who passes
 * e.g. `[1, 2, 3]` or `['a', 'b']` render sensibly instead of crashing a keyed
 * `#each` on `undefined`/duplicate `value`s.
 */
export function normalizeOptions(raw: ReadonlyArray<ListOption | string | number> | null | undefined): ListOption[] {
  if (!raw) return []
  return raw.map((o) => {
    if (o != null && typeof o === 'object') {
      const opt = o as Partial<ListOption>
      const value = opt.value ?? opt.label ?? ''
      return { ...(opt as ListOption), value, label: opt.label ?? String(value) }
    }
    return { value: o, label: String(o) }
  })
}

/** Case-insensitive substring filter over option labels. */
export function filterOptions(options: ReadonlyArray<ListOption>, query: string): ListOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...options]
  return options.filter((o) => o.label.toLowerCase().includes(q))
}

/** An option carrying its position in the flat source array (for prop-getters). */
export type IndexedOption = ListOption & { index: number }
/** A section of options that share a `group` heading (null = ungrouped). */
export type OptionGroup = { group: string | null; options: IndexedOption[] }

/**
 * Bucket options by their `group` heading, preserving each option's flat index
 * so grouped rendering still drives `optionProps(index)` etc. Groups appear in
 * first-seen order. When no option sets `group`, the result is a single
 * `group: null` section (render it flat).
 */
export function groupOptions(options: ReadonlyArray<ListOption>): OptionGroup[] {
  const groups: OptionGroup[] = []
  const byName = new Map<string | null, OptionGroup>()
  options.forEach((o, index) => {
    const key = o.group ?? null
    let g = byName.get(key)
    if (!g) { g = { group: key, options: [] }; byName.set(key, g); groups.push(g) }
    g.options.push({ ...o, index })
  })
  return groups
}

/** Whether any option declares a `group` (so headings are worth rendering). */
export function hasGroups(options: ReadonlyArray<ListOption>): boolean {
  return options.some((o) => o.group != null)
}

/** Fixed px, or a per-option function - lets a virtualized list mix row heights. */
export type RowHeight = number | ((opt: IndexedOption, index: number) => number)

/** One row of the flattened virtualization model: a group heading or an option. */
export type VirtualListRow =
  | { type: 'group'; label: string; size: number }
  | { type: 'option'; opt: IndexedOption; size: number }

export type FlatVirtualModel = {
  /** Group headings + options in render order, each with its px height. */
  entries: VirtualListRow[]
  /** Whether any group heading rows are present. */
  hasGroups: boolean
  /** Height (px) of the entry at flat index `i` - feeds the virtualizer's `estimateSize`. */
  sizeAt: (i: number) => number
  /** Maps an OPTION index (position in the source options array, as used by
   *  `optionProps(index)`) to its flat entry index - so the active option can
   *  be scrolled into view even with group rows interleaved. */
  optionFlatIndex: number[]
}

/**
 * Flatten a (possibly grouped) option list into a single virtualization model:
 * group headings become rows interleaved with their options, and each row
 * carries its pixel height. This is what lets the selection controls window a
 * GROUPED list (previously they fell back to rendering every node) and support
 * variable row heights, while reusing the shared `createSvelteVirtualizer`.
 *
 * Pure - no DOM. Builds on `groupOptions`, which already tags each option with
 * its flat `index` (the value `optionProps(index)` expects).
 */
export function flattenForVirtual(
  options: ReadonlyArray<ListOption>,
  opts: { rowHeight: RowHeight; groupHeaderHeight?: number },
): FlatVirtualModel {
  const headerH = Math.max(1, opts.groupHeaderHeight ?? 28)
  const rh = opts.rowHeight
  const sizeOf = (o: IndexedOption) => Math.max(1, typeof rh === 'function' ? rh(o, o.index) : rh)

  const entries: VirtualListRow[] = []
  const optionFlatIndex = new Array<number>(options.length)
  let anyGroups = false

  for (const g of groupOptions(options)) {
    if (g.group != null) {
      anyGroups = true
      entries.push({ type: 'group', label: g.group, size: headerH })
    }
    for (const opt of g.options) {
      optionFlatIndex[opt.index] = entries.length
      entries.push({ type: 'option', opt, size: sizeOf(opt) })
    }
  }

  return {
    entries,
    hasGroups: anyGroups,
    sizeAt: (i) => entries[i]?.size ?? 0,
    optionFlatIndex,
  }
}

/**
 * Next enabled option index whose label starts with `buffer` (type-ahead),
 * searching forward from just after `from` and wrapping. Returns -1 for no
 * match / empty buffer. Case-insensitive.
 */
export function nextTypeaheadIndex(
  options: ReadonlyArray<ListOption>,
  buffer: string,
  from: number,
): number {
  const b = buffer.trim().toLowerCase()
  if (!b || !options.length) return -1
  const n = options.length
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n
    const o = options[i]
    if (o && !o.disabled && o.label.toLowerCase().startsWith(b)) return i
  }
  return -1
}

/**
 * A tiny type-ahead buffer: accumulates printable characters within `timeout`
 * ms of each other, then resets. Frameworkfree; the caller supplies scheduling.
 */
export function createTypeaheadBuffer(timeout = 600) {
  let buffer = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    get value() { return buffer },
    /** Append a character and (re)arm the reset timer. Returns the new buffer. */
    push(char: string): string {
      buffer += char
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { buffer = '' }, timeout)
      return buffer
    },
    clear() { buffer = ''; if (timer) clearTimeout(timer) },
  }
}

/** Whether a keydown is a bare printable character (a type-ahead candidate). */
export function isTypeaheadKey(e: KeyboardEvent): boolean {
  return e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' '
}
