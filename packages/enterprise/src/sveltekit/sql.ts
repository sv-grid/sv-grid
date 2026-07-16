/**
 * `planToSql` - turn a `QueryPlan` into a portable, parameterized SQL fragment.
 * This is the backend seam for every SQL database: Drizzle, postgres.js,
 * better-sqlite3, mysql2. It emits only a WHERE body, an ORDER BY body, and a
 * params array - never a full statement - so you keep control of the SELECT,
 * the table, joins, and execution.
 *
 * All values are parameterized (never interpolated) and every identifier comes
 * from the plan, which `planQuery` already whitelisted against the schema - so
 * there is no SQL-injection surface here.
 *
 * Drizzle usage (Postgres):
 *
 *     import { sql } from 'drizzle-orm'
 *     const { whereText, orderByText, params, limit, offset } =
 *       planToSql(plan, { placeholders: '$', ilike: true })
 *     const rows = await db.execute(
 *       sql.raw(`select * from customers ${whereText} ${orderByText} limit ${limit} offset ${offset}`, params)
 *     )
 *
 * (Or map `plan.where` to Drizzle operators directly - the plan is the seam
 * either way.)
 */
import type { PlanPredicate, QueryPlan } from './query-plan'

export type SqlDialect = {
  /** Identifier quote char. Default `"` (ANSI / Postgres / SQLite). MySQL: `` ` ``. */
  quote?: string
  /** Placeholder style: `'?'` (SQLite / MySQL), `'$'` for `$1, $2` (Postgres), or `'@'` for `@p1, @p2` (SQL Server). Default `'?'`. */
  placeholders?: '?' | '$' | '@'
  /** Use `ILIKE` for case-insensitive matching (Postgres) instead of `LOWER(col) LIKE LOWER(?)`. */
  ilike?: boolean
  /** Map a schema `field` to its real DB column. Default: identity. Lets renamed columns (Drizzle `created_at` vs key `createdAt`) plan correctly. */
  column?: (field: string) => string
}

export type SqlPlan = {
  /** WHERE body without the keyword, e.g. `"age" > ? AND "name" ILIKE ?`. Empty string when no predicates. */
  where: string
  /** WHERE body with the leading `WHERE ` keyword, or `''`. */
  whereText: string
  /** ORDER BY body without the keyword, e.g. `"name" ASC, "age" DESC`. */
  orderBy: string
  /** ORDER BY body with the leading `ORDER BY ` keyword, or `''`. */
  orderByText: string
  params: unknown[]
  limit: number
  offset: number
}

export function planToSql(plan: QueryPlan, dialect: SqlDialect = {}): SqlPlan {
  const q = dialect.quote ?? '"'
  const useIlike = dialect.ilike ?? false
  const params: unknown[] = []

  const ph = () => {
    if (dialect.placeholders === '$') return `$${params.length}`
    if (dialect.placeholders === '@') return `@p${params.length}`
    return '?'
  }
  const bind = (v: unknown): string => {
    params.push(v)
    return ph()
  }
  const columnFor = dialect.column ?? ((f: string) => f)
  const id = (field: string) => {
    const c = columnFor(field)
    return `${q}${c.replace(new RegExp(q, 'g'), q + q)}${q}`
  }

  const like = (field: string, pattern: string): string => {
    const p = bind(pattern)
    return useIlike ? `${id(field)} ILIKE ${p}` : `LOWER(${id(field)}) LIKE LOWER(${p})`
  }

  const clauses: string[] = []

  for (const pred of plan.where) {
    clauses.push(predicateSql(pred, { id, bind, like }))
  }

  if (plan.search && plan.search.fields.length > 0) {
    const term = `%${plan.search.term}%`
    const ors = plan.search.fields.map((f) => like(f, term))
    clauses.push(`(${ors.join(' OR ')})`)
  }

  const where = clauses.join(' AND ')
  const orderBy = plan.orderBy.map((o) => `${id(o.field)} ${o.desc ? 'DESC' : 'ASC'}`).join(', ')

  return {
    where,
    whereText: where ? `WHERE ${where}` : '',
    orderBy,
    orderByText: orderBy ? `ORDER BY ${orderBy}` : '',
    params,
    limit: plan.limit,
    offset: plan.offset,
  }
}

function predicateSql(
  pred: PlanPredicate,
  ctx: { id: (f: string) => string; bind: (v: unknown) => string; like: (f: string, p: string) => string },
): string {
  const { id, bind, like } = ctx
  const col = id(pred.field)
  switch (pred.op) {
    case 'eq':
      return `${col} = ${bind(pred.value)}`
    case 'contains':
      return like(pred.field, `%${pred.value}%`)
    case 'startsWith':
      return like(pred.field, `${pred.value}%`)
    case 'gt':
      return `${col} > ${bind(pred.value)}`
    case 'lt':
      return `${col} < ${bind(pred.value)}`
    case 'between':
      return `${col} BETWEEN ${bind(pred.value)} AND ${bind(pred.valueTo)}`
    case 'isBlank':
      return `(${col} IS NULL OR ${col} = '')`
    case 'in': {
      const vals = pred.values ?? []
      if (vals.length === 0) return '1 = 0' // empty IN () matches nothing
      return `${col} IN (${vals.map((v) => bind(v)).join(', ')})`
    }
    default:
      return '1 = 1'
  }
}
