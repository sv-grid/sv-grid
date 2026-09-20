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
  /**
   * SELECT list for a GROUPED request: the group column plus one aliased
   * aggregate per requested column, e.g.
   * `"region", SUM("amount") AS "amount"`.
   *
   * Empty string for a flat/leaf query - select your own columns then.
   * The aggregate is aliased back to the SOURCE column name because that is
   * where the grid reads it from on the group row.
   */
  select: string
  /** GROUP BY body without the keyword, e.g. `"region"`. Empty when flat. */
  groupBy: string
  /** GROUP BY body with the leading `GROUP BY ` keyword, or `''`. */
  groupByText: string
  /**
   * COUNT expression for the total, which differs between the two modes:
   * grouped requests need the number of DISTINCT groups, not of rows, or the
   * grid's scrollbar and paging will be sized from the wrong number.
   */
  countText: string
  /**
   * The grand-total statement's pieces, present only when the request asked
   * for one (`plan.grandTotal`): a SELECT list of every aggregate over the
   * whole filtered set (aliased like `select`), and a WHERE + params of the
   * filters WITHOUT the group path. Run it as its own query:
   *
   *     SELECT ${sql.grandTotalSelect} FROM sales ${sql.grandTotalWhereText}
   *
   * All three are empty when no total was asked for.
   */
  grandTotalSelect: string
  grandTotalWhereText: string
  grandTotalParams: unknown[]
  /**
   * Server-side pivot needs two statements, because SQL cannot make
   * columns out of values it has not seen yet. First fetch the distinct
   * key paths: `SELECT ${sql.pivotKeysSelect} FROM t ${sql.whereText}`
   * (one row per path, columns named after the pivot columns). Then build
   * the grouped SELECT with `pivotSelect(keyRows)`: one conditional
   * aggregate per (key path x aggregation), aliased `<key>_<col>` - the
   * fields the grid expects in `pivotResultFields` (returned alongside).
   * Key values are inlined as quoted literals; they came from the database
   * itself. Both are empty when not pivoting.
   */
  pivotKeysSelect: string
  pivotSelect: (keyRows: ReadonlyArray<Record<string, unknown>>) => {
    select: string
    fields: string[]
    /** The same aggregates for the grand-total statement, no group column. */
    grandTotalSelect: string
  }
}

export function planToSql(plan: QueryPlan, dialect: SqlDialect = {}): SqlPlan {
  const q = dialect.quote ?? '"'
  const useIlike = dialect.ilike ?? false
  const params: unknown[] = []

  const columnFor = dialect.column ?? ((f: string) => f)
  const id = (field: string) => {
    const c = columnFor(field)
    return `${q}${c.replace(new RegExp(q, 'g'), q + q)}${q}`
  }
  // The planner whitelists function names; this is the second lock on the
  // same door, since an aggregate name is pasted into the statement raw.
  const aggName = (fn: string) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(fn)) throw new Error(`planToSql: "${fn}" is not an aggregate function name`)
    return fn.toUpperCase()
  }

  /**
   * Render predicates + search into one WHERE body, binding into `into`.
   * Placeholder numbering follows that array, so a second call with a fresh
   * array (the grand total) starts from $1 again.
   */
  const buildWhere = (preds: PlanPredicate[], into: unknown[]): string => {
    const ph = () => {
      if (dialect.placeholders === '$') return `$${into.length}`
      if (dialect.placeholders === '@') return `@p${into.length}`
      return '?'
    }
    const bind = (v: unknown): string => {
      into.push(v)
      return ph()
    }
    const like = (field: string, pattern: string): string => {
      const p = bind(pattern)
      return useIlike ? `${id(field)} ILIKE ${p}` : `LOWER(${id(field)}) LIKE LOWER(${p})`
    }
    const clauses: string[] = []
    for (const pred of preds) clauses.push(predicateSql(pred, { id, bind, like }))
    if (plan.search && plan.search.fields.length > 0) {
      const term = `%${plan.search.term}%`
      const ors = plan.search.fields.map((f) => like(f, term))
      clauses.push(`(${ors.join(' OR ')})`)
    }
    return clauses.join(' AND ')
  }

  const where = buildWhere(plan.where, params)
  // A grouped level can only order by what it produces - the key and the
  // aggregates (under pivot only the key, the aggregates being split per
  // pivot key); a leaf column there is a SQL error. With nothing left the
  // key orders the groups, so paging over them is deterministic. Same rule
  // as the in-memory reference.
  let order = plan.orderBy
  if (plan.groupBy) {
    const produced = new Set<string>([
      plan.groupBy,
      ...(plan.pivotBy?.length ? [] : (plan.aggregations ?? []).map((a) => a.field)),
    ])
    order = order.filter((o) => produced.has(o.field))
    if (order.length === 0) order = [{ field: plan.groupBy, desc: false }]
  }
  const orderBy = order.map((o) => `${id(o.field)} ${o.desc ? 'DESC' : 'ASC'}`).join(', ')

  // ---- Grouping ----------------------------------------------------------
  // `plan.groupBy` is a single column: the grid asks one level at a time and
  // sends the chosen path as ordinary predicates, so there is never a
  // multi-column GROUP BY to emit here.
  const groupBy = plan.groupBy ? id(plan.groupBy) : ''
  let select = ''
  if (plan.groupBy) {
    const parts = [id(plan.groupBy)]
    for (const agg of plan.aggregations ?? []) {
      // COUNT(*) rather than COUNT(col) so the tally counts rows in the group
      // rather than non-null values of one column.
      const expr = agg.fn === 'count' ? 'COUNT(*)' : `${aggName(agg.fn)}(${id(agg.field)})`
      // Aliased back to the source column name: that is the key the grid reads
      // the aggregate from on the group row.
      parts.push(`${expr} AS ${id(agg.field)}`)
    }
    // What opening the group would show, for the badge beside its key: the
    // distinct keys of the next level, or the rows when this is the innermost
    // group level. Always emitted; a caller that does not want the extra
    // aggregate can drop the alias from the list.
    parts.push(
      plan.childGroupBy
        ? `COUNT(DISTINCT ${id(plan.childGroupBy)}) AS ${id('childCount')}`
        : `COUNT(*) AS ${id('childCount')}`,
    )
    select = parts.join(', ')
  }

  // The grand total aggregates over everything the FILTERS admit, so the
  // group path (the trailing `pathPredicates` entries of `where`, per
  // planQuery) is left out.
  let grandTotalSelect = ''
  let grandTotalWhereText = ''
  const grandTotalParams: unknown[] = []
  if (plan.grandTotal) {
    grandTotalSelect = (plan.aggregations ?? [])
      .map((agg) => {
        const expr = agg.fn === 'count' ? 'COUNT(*)' : `${aggName(agg.fn)}(${id(agg.field)})`
        return `${expr} AS ${id(agg.field)}`
      })
      .join(', ')
    const filtersOnly = plan.where.slice(0, plan.where.length - (plan.pathPredicates ?? 0))
    const body = buildWhere(filtersOnly, grandTotalParams)
    grandTotalWhereText = body ? `WHERE ${body}` : ''
  }

  // ---- Pivot ------------------------------------------------------------
  let pivotKeysSelect = ''
  let pivotSelect: SqlPlan['pivotSelect'] = () => ({ select: '', fields: [], grandTotalSelect: '' })
  if (plan.groupBy && plan.pivotBy?.length) {
    const pivotCols = plan.pivotBy
    const keyList = pivotCols
      .map((c) => (columnFor(c) === c ? id(c) : `${id(c)} AS ${q}${c}${q}`))
      .join(', ')
    pivotKeysSelect = `DISTINCT ${keyList}`
    pivotSelect = (keyRows) => {
      // Key paths in plain string order, so the field list (and the
      // columns the grid builds from it) is the same whatever order the
      // distinct-keys query returned - and the same as the reference.
      const pathOf = (row: Record<string, unknown>) => pivotCols.map((c) => String(row[c] ?? '')).join('_')
      keyRows = [...keyRows].sort((a, b) => {
        const x = pathOf(a)
        const y = pathOf(b)
        return x < y ? -1 : x > y ? 1 : 0
      })
      const groupCol = id(plan.groupBy!)
      const parts = [groupCol]
      const totals: string[] = []
      const fields: string[] = []
      for (const keyRow of keyRows) {
        const path = pivotCols.map((c) => String(keyRow[c] ?? ''))
        // The key path as an inline condition. Values are quoted as string
        // literals with doubled quotes; a caller with typed columns can
        // rewrite through `pivotSelect` itself.
        const cond = pivotCols
          .map((c, i) => `${id(c)} = '${path[i]!.replace(/'/g, "''")}'`)
          .join(' AND ')
        for (const agg of plan.aggregations ?? []) {
          const field = `${path.join('_')}_${agg.field}`
          const inner = agg.fn === 'count' ? '1' : id(agg.field)
          const fn = agg.fn === 'count' ? 'COUNT' : aggName(agg.fn)
          const expr = `${fn}(CASE WHEN ${cond} THEN ${inner} END) AS ${id(field)}`
          parts.push(expr)
          totals.push(expr)
          fields.push(field)
        }
      }
      // The plain aggregates too: the row total beside the per-key cells,
      // which is what a Total column group reads.
      for (const agg of plan.aggregations ?? []) {
        const expr = agg.fn === 'count' ? 'COUNT(*)' : `${aggName(agg.fn)}(${id(agg.field)})`
        parts.push(`${expr} AS ${id(agg.field)}`)
        totals.push(`${expr} AS ${id(agg.field)}`)
      }
      parts.push(`COUNT(*) AS ${id('childCount')}`)
      return { select: parts.join(', '), fields, grandTotalSelect: totals.join(', ') }
    }
  }

  // A grouped total is the number of distinct keys, not of underlying rows.
  const countText = plan.groupBy
    ? `COUNT(DISTINCT ${id(plan.groupBy)})`
    : 'COUNT(*)'

  return {
    where,
    whereText: where ? `WHERE ${where}` : '',
    orderBy,
    orderByText: orderBy ? `ORDER BY ${orderBy}` : '',
    params,
    limit: plan.limit,
    offset: plan.offset,
    select,
    groupBy,
    groupByText: groupBy ? `GROUP BY ${groupBy}` : '',
    countText,
    grandTotalSelect,
    grandTotalWhereText,
    grandTotalParams,
    pivotKeysSelect,
    pivotSelect,
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
