/** The URL a button field opens: `{Field name}` tokens filled from the row, http(s) only. */
export function buttonUrl(template: string, row: Record<string, unknown> | null | undefined, names?: Record<string, string>): string | null {
  if (!template.trim() || !row) return null
  const filled = template.replace(/\{([^}]+)\}/g, (_m, name: string) => {
    const key = names?.[name.trim().toLowerCase()] ?? name.trim()
    const v = row[key]
    return encodeURIComponent(v == null ? '' : Array.isArray(v) ? v.join(',') : String(v))
  })
  try {
    const url = new URL(filled)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
