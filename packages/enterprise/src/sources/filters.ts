/**
 * Shared filter normalization for data-source adapters. The grid emits a
 * `ServerFilterModel` (per-column `{ operator, value, valueTo, selectedValues }`
 * plus a global search string); every backend then has to translate that into
 * its own query language. This turns the grid's model into one small, uniform
 * list of predicates so each adapter (Supabase, REST, ...) maps a handful of
 * clear cases instead of re-parsing the raw model.
 */
import type { ServerFilterModel } from '@svgrid/grid'

/** A backend-neutral predicate over a single column. */
export type NormalizedPredicate =
  | { column: string; op: 'in'; values: string[] }
  | { column: string; op: 'isNull' }
  | { column: string; op: 'contains' | 'startsWith' | 'eq' | 'gt' | 'lt'; value: string }
  | { column: string; op: 'between'; value: string; valueTo: string }

export type NormalizedFilter = {
  /** Column predicates, empty ones dropped. */
  predicates: NormalizedPredicate[]
  /** Free-text global search term (trimmed), if any. */
  search?: string
}

/** Map the grid's per-column filter model into neutral predicates. */
export function normalizeFilters(model: ServerFilterModel | undefined): NormalizedFilter {
  const predicates: NormalizedPredicate[] = []
  for (const [column, f] of Object.entries(model?.columns ?? {})) {
    // Set / checklist filter takes precedence when present.
    if (f.selectedValues?.length) {
      predicates.push({ column, op: 'in', values: f.selectedValues })
      continue
    }
    const value = (f.value ?? '').trim()
    switch (f.operator) {
      case 'isBlank':
        predicates.push({ column, op: 'isNull' })
        break
      case 'between': {
        const valueTo = (f.valueTo ?? '').trim()
        if (value || valueTo) predicates.push({ column, op: 'between', value, valueTo: valueTo || value })
        break
      }
      case 'startsWith':
        if (value) predicates.push({ column, op: 'startsWith', value })
        break
      case 'equals':
        if (value) predicates.push({ column, op: 'eq', value })
        break
      case 'greaterThan':
        if (value) predicates.push({ column, op: 'gt', value })
        break
      case 'lessThan':
        if (value) predicates.push({ column, op: 'lt', value })
        break
      case 'contains':
      default:
        if (value) predicates.push({ column, op: 'contains', value })
        break
    }
  }
  const search = model?.global?.trim()
  return { predicates, search: search ? search : undefined }
}
