import { count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { subscription, user } from '#lib/server/db/schema.ts';
import { PAID_STATUSES } from '#lib/plans.ts';
import type { PageServerLoad } from './$types';

/** The status chips above the grid, in order. `all` shows every row. */
const FILTERS = ['all', 'active', 'trialing', 'past_due', 'canceled'] as const;
type Filter = (typeof FILTERS)[number];

/** Rows sent to the browser. Past this, add server paging like the Users screen. */
const MAX_ROWS = 2000;

export const load: PageServerLoad = async ({ url }) => {
	const asked = url.searchParams.get('status') as Filter;
	const filter: Filter = FILTERS.includes(asked) ? asked : 'all';
	const where = filter === 'all' ? undefined : eq(subscription.status, filter);

	const [rows, byStatus, mrr] = await Promise.all([
		db
			.select({
				id: subscription.id,
				email: user.email,
				name: user.name,
				plan: subscription.plan,
				status: subscription.status,
				amount: subscription.amount,
				currency: subscription.currency,
				interval: subscription.interval,
				currentPeriodEnd: subscription.currentPeriodEnd,
				cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
				createdAt: subscription.createdAt
			})
			.from(subscription)
			.innerJoin(user, eq(user.id, subscription.userId))
			.where(where)
			.orderBy(desc(subscription.createdAt))
			.limit(MAX_ROWS),
		db.select({ status: subscription.status, n: count() }).from(subscription).groupBy(subscription.status),
		// Monthly recurring revenue from paid-up subscriptions; yearly prices
		// count a twelfth. One total per currency.
		db
			.select({
				currency: subscription.currency,
				cents: sql<number>`sum(case when ${subscription.interval} = 'year' then ${subscription.amount} / 12.0 else ${subscription.amount} end)`.mapWith(Number)
			})
			.from(subscription)
			.where(inArray(subscription.status, [...PAID_STATUSES]))
			.groupBy(subscription.currency)
	]);

	const counts = Object.fromEntries(byStatus.map((r) => [r.status, r.n]));
	return {
		filter,
		filters: FILTERS.map((f) => ({ id: f, n: f === 'all' ? byStatus.reduce((t, r) => t + r.n, 0) : (counts[f] ?? 0) })),
		mrr: mrr.filter((m) => m.currency),
		rows,
		capped: rows.length === MAX_ROWS
	};
};
