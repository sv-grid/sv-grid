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
