import { and, asc, desc, gt, ilike, isNotNull, isNull, lt, ne, not, or, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import type { ServerRequest } from '@svgrid/grid/server';

/**
 * Turn the sort and filters a grid sends (`ServerRequest`) into Drizzle
 * clauses. Only the columns you list can be sorted or filtered, and every
 * value goes in as a bound parameter, so a crafted request reaches nothing
 * else. Unknown operators are ignored rather than guessed at.
 *
 *   const q = gridQuery(request, { action: { column: auditLog.action, kind: 'text' }, ... })
 *   db.select().from(auditLog).where(q.where).orderBy(...q.orderBy)
 */
export type FieldSpec = { column: AnyColumn; kind: 'text' | 'number' | 'date' };

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

function textCondition(column: AnyColumn, op: string, value: string): SQL | undefined {
	switch (op) {
		case 'contains': return ilike(column, `%${escapeLike(value)}%`);
		case 'notContains': return not(ilike(column, `%${escapeLike(value)}%`));
		case 'startsWith': return ilike(column, `${escapeLike(value)}%`);
		case 'endsWith': return ilike(column, `%${escapeLike(value)}`);
		case 'equals': return sql`lower(${column}) = lower(${value})`;
		case 'notEquals': return sql`lower(${column}) <> lower(${value})`;
	}
}

function rangeCondition(column: AnyColumn, kind: 'number' | 'date', op: string, value: string, valueTo?: string): SQL | undefined {
	const parse = (v: string) => (kind === 'number' ? Number(v) : new Date(v));
	const bad = (v: unknown) => (v instanceof Date ? Number.isNaN(v.getTime()) : Number.isNaN(v as number));
	const a = parse(value);
	if (bad(a)) return undefined;
	if (kind === 'date' && (op === 'equals' || op === 'notEquals')) {
		// A date filter on a timestamp means the whole day.
		const day = sql`date_trunc('day', ${column}) = date_trunc('day', ${a as Date}::timestamp)`;
		return op === 'equals' ? day : not(day);
	}
	switch (op) {
		case 'equals': return sql`${column} = ${a}`;
		case 'notEquals': return ne(column, a);
		case 'greaterThan': return gt(column, a);
		case 'lessThan': return lt(column, a);
		case 'between': {
			const b = valueTo ? parse(valueTo) : undefined;
			return b === undefined || bad(b) ? undefined : and(sql`${column} >= ${a}`, sql`${column} <= ${b}`);
		}
	}
}

export function gridQuery(request: Pick<ServerRequest, 'sortModel' | 'filterModel'>, fields: Record<string, FieldSpec>, fallbackOrder: SQL[]) {
	const conditions: SQL[] = [];
	const filters = request.filterModel ?? {};

	for (const [id, f] of Object.entries(filters.columns ?? {})) {
		const spec = fields[id];
		if (!spec || !f) continue;
		if (f.operator === 'isBlank') { conditions.push(or(isNull(spec.column), sql`${spec.column}::text = ''`)!); continue; }
		if (f.operator === 'isNotBlank') { conditions.push(and(isNotNull(spec.column), sql`${spec.column}::text <> ''`)!); continue; }
		if (f.selectedValues?.length) conditions.push(sql`${spec.column}::text in ${f.selectedValues}`);
		if (f.value === undefined || f.value === '') continue;
		const c = spec.kind === 'text' ? textCondition(spec.column, f.operator, String(f.value)) : rangeCondition(spec.column, spec.kind, f.operator, String(f.value), f.valueTo);
		if (c) conditions.push(c);
	}

	const global = filters.global?.trim();
	if (global) {
		const text = Object.values(fields).filter((s) => s.kind === 'text');
		const any = or(...text.map((s) => ilike(s.column, `%${escapeLike(global)}%`)));
		if (any) conditions.push(any);
	}

	const orderBy: SQL[] = [];
	for (const s of request.sortModel ?? []) {
		const spec = fields[s.id];
		if (spec) orderBy.push(s.desc ? desc(spec.column) : asc(spec.column));
	}

	return { where: conditions.length ? and(...conditions) : undefined, orderBy: orderBy.length ? orderBy : fallbackOrder };
}
