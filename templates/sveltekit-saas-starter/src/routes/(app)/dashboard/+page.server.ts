import { and, asc, count, eq, gte, lte, sql, sum } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { project } from '#lib/server/db/schema.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();
	const mine = eq(project.ownerId, user.id);
	const today = new Date().toISOString().slice(0, 10);
	const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
	const dueSoon = and(mine, gte(project.dueDate, today), lte(project.dueDate, in30), sql`${project.status} <> 'done'`);

	const [[totals], [active], [budget], soon] = await Promise.all([
		db.select({ n: count() }).from(project).where(mine),
		db.select({ n: count() }).from(project).where(and(mine, eq(project.status, 'active'))),
		db.select({ total: sum(project.budget) }).from(project).where(and(mine, sql`${project.status} <> 'done'`)),
		db
			.select({ id: project.id, name: project.name, client: project.client, status: project.status, dueDate: project.dueDate, budget: project.budget })
			.from(project)
			.where(dueSoon)
			.orderBy(asc(project.dueDate))
			.limit(50)
	]);

	return { totals: totals.n, active: active.n, openBudget: Number(budget.total ?? 0), soon };
};
