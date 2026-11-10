import { json } from '@sveltejs/kit';
import { count, desc } from 'drizzle-orm';
import type { ServerRequest } from '@svgrid/grid/server';
import { db } from '#lib/server/db/index.ts';
import { auditLog } from '#lib/server/db/schema.ts';
import { gridQuery } from '#lib/server/grid-query.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import type { RequestHandler } from './$types';

const FIELDS = {
	at: { column: auditLog.at, kind: 'date' },
	actorEmail: { column: auditLog.actorEmail, kind: 'text' },
	action: { column: auditLog.action, kind: 'text' },
	target: { column: auditLog.target, kind: 'text' }
} as const;

const MAX_BLOCK = 500;

// One block of the audit log for the grid's infinite scroll. A +server.ts
// route does not run the admin layout's guard, so it checks the role itself.
export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals);

	const body = (await request.json()) as Pick<ServerRequest, 'startRow' | 'endRow' | 'sortModel' | 'filterModel'>;
	const start = Math.max(0, Math.floor(Number(body.startRow) || 0));
	const size = Math.min(MAX_BLOCK, Math.max(1, Math.floor(Number(body.endRow) - start) || 100));
	const q = gridQuery(body, FIELDS, [desc(auditLog.at), desc(auditLog.id)]);

	const [rows, [{ total }]] = await Promise.all([
		db
			.select({ id: auditLog.id, at: auditLog.at, actorEmail: auditLog.actorEmail, action: auditLog.action, target: auditLog.target })
			.from(auditLog)
			.where(q.where)
			.orderBy(...q.orderBy, desc(auditLog.id))
			.limit(size)
			.offset(start),
		db.select({ total: count() }).from(auditLog).where(q.where)
	]);

	return json({ rows, total });
};
