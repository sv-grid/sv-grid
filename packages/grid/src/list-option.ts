/** Shared option shape for the SvGrid UI-kit selection controls. */
export type ListOption = {
  value: string | number
  label: string
  disabled?: boolean
  /** Optional group heading this option belongs under. */
  group?: string
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
