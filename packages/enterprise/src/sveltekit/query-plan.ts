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
import type { GridPredicateExpr, GridScalarExpr, RowData, ServerRequest } from '@svgrid/grid'
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

/** An aggregate to compute per group. */
export type PlanAggregate = { field: string; fn: 'sum' | 'avg' | 'min' | 'max' | 'count' }

export type QueryPlan = {
  /** AND-combined column predicates. */
  where: PlanPredicate[]
  /** Global free-text search: OR `contains` across these textual fields. Null when no search term. */
  search: { term: string; fields: string[] } | null
  orderBy: Array<{ field: string; desc: boolean }>
  limit: number
  offset: number
  /**
   * The column to GROUP BY for this request, or null for a flat / leaf query.
   *
   * Server-side grouping is one level at a time: the grid asks for the distinct
   * keys at the current level, and expanding a group is another request with
   * that key appended to `groupKeys`. The path already chosen arrives as
   * ordinary equality predicates in `where`, so a backend only ever has to
   * handle "filter, then group by one column".
   *
   * Optional so a hand-built plan (and every plan written before server-side
   * grouping existed) stays valid; `planQuery` always sets it.
   */
  groupBy?: string | null
  /** Aggregates to compute alongside `groupBy`. Empty/absent for a leaf query. */
  aggregations?: PlanAggregate[]
  /**
   * The advanced-filter expression, present ONLY when every column it
   * references is on the schema.
   *
   * Rejected whole rather than in part. Dropping one clause of an AND makes the
   * result broader, which for a filter means showing rows the user excluded -
   * so a half-understood expression is worse than an ignored one. When this is
   * absent but the request carried an expression, the backend must not
   * acknowledge it (see `ServerResult.appliedExpression`).
   */
  expression?: GridPredicateExpr
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

  // ---- Server-side grouping ---------------------------------------------
  // Same whitelist rule as the filters above: only schema fields reach the
  // plan, so a client cannot group by or aggregate an arbitrary identifier.
  const groupCols = (request.groupBy ?? []).filter((f) => fields.has(f))
  const groupKeys = request.groupKeys ?? []

  // The already-chosen path becomes plain equality predicates, so the backend
  // only ever sees "filter, then group by one column".
  for (let i = 0; i < groupKeys.length && i < groupCols.length; i += 1) {
    const field = groupCols[i]!
    const def = fields.get(field)!
    where.push({ field, op: 'eq', value: coerce(def.type, groupKeys[i]) })
  }

  // Above the innermost level the grid wants GROUP rows; at or below it, leaves.
  const groupBy = groupKeys.length < groupCols.length ? (groupCols[groupKeys.length] ?? null) : null

  const aggregations: PlanAggregate[] = groupBy
    ? (request.aggregations ?? [])
        .filter((a) => fields.has(a.col))
        .map((a) => ({ field: a.col, fn: a.fn }))
    : []

  // ---- Advanced filter ---------------------------------------------------
  // Same whitelist, stricter consequence: if ANY referenced column is off the
  // schema the whole expression is dropped. Keeping the understood parts would
  // silently widen the result set.
  const expression = admitExpression(request.filterModel?.expression, fields)

  return {
    where,
    search,
    orderBy,
    limit: request.pageSize,
    offset: request.startRow,
    groupBy,
    aggregations,
    ...(expression ? { expression } : {}),
  }
}

/** Every column id an expression reads, so it can be whitelisted as a unit. */
function expressionColumns(expr: GridPredicateExpr, out: Set<string> = new Set()): Set<string> {
  const scalar = (s: GridScalarExpr): void => {
    switch (s.kind) {
      case 'col':
        out.add(s.id)
        break
      case 'agg':
        out.add(s.column)
        break
      case 'neg':
        scalar(s.expr)
        break
      case 'bin':
        scalar(s.left)
        scalar(s.right)
        break
      case 'func':
        s.args.forEach(scalar)
        break
      default:
        break
    }
  }
  switch (expr.kind) {
    case 'and':
    case 'or':
      expr.parts.forEach((p) => expressionColumns(p, out))
      break
    case 'not':
      expressionColumns(expr.expr, out)
      break
    case 'cmp':
      out.add(expr.column)
      break
    case 'scalarCmp':
      scalar(expr.left)
      scalar(expr.right)
      break
    default:
      break
  }
  return out
}

/** Return the expression only when every column it touches is on the schema. */
function admitExpression(
  expr: GridPredicateExpr | undefined,
  fields: Map<string, { field: string; type: EntityFieldType }>,
): GridPredicateExpr | undefined {
  if (!expr) return undefined
  for (const col of expressionColumns(expr)) {
    if (!fields.has(col)) return undefined
  }
  return expr
}
