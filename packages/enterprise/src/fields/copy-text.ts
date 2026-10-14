import { toAttachments } from './attachments'
import { joinNames } from './name-list'
import { findFieldUser, getLinkedTable, linkedRows } from './sources.svelte'

// Types that store ids or objects: a copy writes what their cell shows.
const AS_SHOWN = new Set(['user', 'createdBy', 'lastModifiedBy', 'link', 'lookup', 'barcode'])

/**
 * A stored URL as an absolute one: a paste attaches only http(s) URLs, so a
 * relative one ('/api/files/123') is resolved against the page.
 */
function absoluteUrl(url: string): string {
  if (typeof location === 'undefined') return url
  try {
    return new URL(url, location.href).href
  } catch {
    return url
  }
}

/**
 * What a copy (Ctrl+C) writes for a field of a base: names for people and
 * links (their paste reads names back), the URLs of attachments (a paste of
 * URLs attaches them), a barcode's text. Every other value is copied as
 * stored, so numbers and dates paste back exactly. Names of linked records
 * and of several people are quoted when they hold a comma ("Acme, Inc."),
 * so the paste splits them back the same way.
 */
export function fieldCopyText(p: { value: unknown; column: unknown; row: unknown }): unknown {
  const def = (p.column as { columnDef?: Record<string, any> } | null)?.columnDef
  const type = def?.fieldType
  if (type === 'attachment') return toAttachments(p.value).map((a) => a.url).filter(Boolean).map(absoluteUrl).join(' ')
  if (type === 'link') {
    const table = getLinkedTable(def?.fieldProps?.table)
    if (table) return joinNames(linkedRows(table, p.value).map((r) => String(r[table.primaryField] ?? '')))
  }
  if (type === 'user' && def?.fieldProps?.multiple) {
    const ids = Array.isArray(p.value) ? p.value : p.value == null || p.value === '' ? [] : [p.value]
    return joinNames(ids.map((x) => findFieldUser(x)?.name ?? String(x)))
  }
  if (!AS_SHOWN.has(type) || typeof def?.formatter !== 'function') return p.value
  return def.formatter({ value: p.value, row: p.row, column: p.column })
}
