/**
 * The query-plan seam. `planQuery` turns the grid's `ServerRequest` (sort +
 * filter + paging) into a neutral, backend-agnostic `QueryPlan`. Every backend
 * adapter - the in-memory reference source, `planToSql` for any SQL database,
 * a Drizzle/Supabase mapping - consumes this one plan, so the request-shaping
 * logic (operator mapping, type coercion, field whitelisting) lives and is
 * tested in exactly one place.
 *
 * Security note: only fields declared on the `EntitySchema` reach the plan.
 * Unknown column names in the request are dropped, so a client cannot smuggle
 * arbitrary identifiers through to SQL.
 */
import type { RowData, ServerRequest } from '@svgrid/grid'
import type { EntityFieldType, EntitySchema } from '../schema'

/** Normalized predicate operators (a stable superset of the grid's filter operators). */
export type PlanOp = 'eq' | 'contains' | 'startsWith' | 'gt' | 'lt' | 'between' | 'isBlank' | 'in'

export type PlanPredicate = {
  field: string
  op: PlanOp
  /** Single operand (eq / contains / startsWith / gt / lt, and the low bound of between). */
  value?: unknown
  /** Upper bound for `between`. */
  valueTo?: unknown
  /** Operands for `in` (set / facet filter). */
  values?: unknown[]
}

export type QueryPlan = {
  /** AND-combined column predicates. */
  where: PlanPredicate[]
  /** Global free-text search: OR `contains` across these textual fields. Null when no search term. */
  search: { term: string; fields: string[] } | null
  orderBy: Array<{ field: string; desc: boolean }>
  limit: number
  offset: number
}

/** Grid filter operator -> normalized plan operator. Unmapped operators are ignored. */
const OP_MAP: Record<string, PlanOp> = {
  equals: 'eq',
  contains: 'contains',
  startsWith: 'startsWith',
  greaterThan: 'gt',
  lessThan: 'lt',
  between: 'between',
  isBlank: 'isBlank',
}

/** Field types that global text search scans. */
const TEXTUAL: ReadonlySet<EntityFieldType> = new Set<EntityFieldType>(['text', 'enum'])

/** Coerce a raw string request value to the field's runtime type for correct comparisons. */
export function coerce(type: EntityFieldType, raw: unknown): unknown {
  if (raw == null) return raw
  switch (type) {
    case 'number': {
      const n = Number(raw)
      return Number.isFinite(n) ? n : undefined
    }
    case 'boolean':
      return raw === true || raw === 'true'
    default:
      // text / date / dateString / datetime / enum / relation / json: compared as strings
      return typeof raw === 'string' ? raw : String(raw)
  }
}

export function planQuery<TData extends RowData>(
  schema: EntitySchema<TData>,
  request: ServerRequest,
): QueryPlan {
  const fields = new Map(schema.fields.map((f) => [f.field, f]))
  const where: PlanPredicate[] = []
  const fm = request.filterModel ?? {}

  for (const [field, spec] of Object.entries(fm.columns ?? {})) {
    const def = fields.get(field)
    if (!def) continue // whitelist: ignore columns not on the schema

    // A facet / set selection wins over the operator filter.
    if (spec.selectedValues && spec.selectedValues.length > 0) {
      where.push({ field, op: 'in', values: spec.selectedValues.map((v) => coerce(def.type, v)) })
      continue
    }

    const op = OP_MAP[spec.operator]
    if (!op) continue

    if (op === 'isBlank') {
      where.push({ field, op })
      continue
    }
    if (op === 'between') {
      where.push({
        field,
        op,
        value: coerce(def.type, spec.value),
        valueTo: coerce(def.type, spec.valueTo),
      })
      continue
    }
    if (spec.value === '' || spec.value == null) continue
    where.push({ field, op, value: coerce(def.type, spec.value) })
  }

  const term = (fm.global ?? '').trim()
  const search =
    term.length > 0
      ? {
          term,
          // Textual, non-key fields: searching a primary key by substring is noise.
          fields: schema.fields
            .filter((f) => TEXTUAL.has(f.type) && !f.primaryKey && f.field !== schema.idField)
            .map((f) => f.field),
        }
      : null

  const orderBy = (request.sortModel ?? [])
    .filter((s) => fields.has(s.id))
    .map((s) => ({ field: s.id, desc: !!s.desc }))

  return { where, search, orderBy, limit: request.pageSize, offset: request.startRow }
}
