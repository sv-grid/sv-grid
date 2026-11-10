import { count, sql } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { account, project, projectStatus, subscription, user } from './schema.ts';
import type { Database } from './types.ts';

// Sample data so every screen has something to show on first run. No
// SvelteKit imports: the app calls this on a fresh local database, and
// `npm run db:seed` calls it against your own Postgres.

export const DEMO_ACCOUNTS = [
	{ email: 'admin@example.com', password: 'starter-admin-1', name: 'Avery Admin', role: 'admin' },
	{ email: 'user@example.com', password: 'starter-user-1', name: 'Uma User', role: 'user' }
] as const;

const FIRST = ['Ada', 'Bram', 'Chen', 'Dana', 'Emil', 'Farah', 'Goran', 'Hana', 'Ivo', 'Jules', 'Kemal', 'Lena', 'Mateo', 'Nora', 'Omar', 'Petra', 'Quinn', 'Rosa', 'Sven', 'Tess', 'Uri', 'Vera', 'Wim', 'Yara', 'Zoltan'];
const LAST = ['Okafor', 'Lindqvist', 'Moreau', 'Haddad', 'Novak', 'Tanaka', 'Rossi', 'Petrov', 'Silva', 'Kowalski', 'Byrne', 'Nakamura', 'Fischer', 'Duarte', 'Ivanova'];
const CLIENTS = ['Northwind', 'Blue Harbor', 'Kestrel Labs', 'Fenwick & Co', 'Orbital Foods', 'Tallgrass', 'Meridian Health', 'Copperline', 'Atlas Freight', 'Willow Studio'];
const WORK = ['Checkout redesign', 'Data warehouse move', 'Mobile app v2', 'Pricing page test', 'SSO rollout', 'Billing migration', 'Search relevance', 'Onboarding emails', 'Support portal', 'Usage dashboard', 'API rate limits', 'Audit export'];

/** Small seeded PRNG so every fresh install gets the same data. */
function prng(seed: number) {
	return () => {
		seed = (seed * 1664525 + 1013904223) >>> 0;
		return seed / 2 ** 32;
	};
}

export async function seed(db: Database, { auditRows = 100_000 } = {}): Promise<boolean> {
	const [{ users }] = await db.select({ users: count() }).from(user);
	if (users > 0) return false;

	const rand = prng(42);
	const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
	const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);
	const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

	// Accounts that can sign in: one hashed password each.
	const people: (typeof user.$inferInsert)[] = [];
	for (const [i, demo] of DEMO_ACCOUNTS.entries()) {
		people.push({ id: crypto.randomUUID(), name: demo.name, email: demo.email, emailVerified: true, role: demo.role, createdAt: daysAgo(400 - i) });
	}
	// Sample users with no password; they fill the admin screens.
	for (let i = 0; i < 58; i++) {
		const first = pick(FIRST);
		const last = pick(LAST);
		people.push({
			id: crypto.randomUUID(),
			name: `${first} ${last}`,
			email: `${first}.${last}.${i}@example.com`.toLowerCase(),
			emailVerified: rand() > 0.2,
			role: 'user',
			banned: rand() < 0.08,
			createdAt: daysAgo(Math.floor(rand() * 390))
		});
	}
	await db.insert(user).values(people);
	await db.insert(account).values(
		await Promise.all(
			DEMO_ACCOUNTS.map(async (demo, i) => ({
				id: crypto.randomUUID(),
				accountId: people[i].id!,
				providerId: 'credential',
				userId: people[i].id!,
				password: await hashPassword(demo.password)
			}))
		)
	);

	const projects: (typeof project.$inferInsert)[] = [];
	for (const [i, owner] of people.entries()) {
		const n = i === 0 ? 30 : i === 1 ? 12 : Math.floor(rand() * 8);
		for (let p = 0; p < n; p++) {
			projects.push({
				ownerId: owner.id!,
				name: pick(WORK),
				client: pick(CLIENTS),
				status: pick(projectStatus),
				budget: Math.round((2 + rand() * 248) * 1000),
				dueDate: day(Math.floor(rand() * 360) - 180),
				...(() => {
					const created = Math.floor(rand() * 300);
					return { createdAt: daysAgo(created), updatedAt: daysAgo(Math.floor(rand() * created)) };
				})()
			});
		}
	}
	await db.insert(project).values(projects);

	// Sample subscriptions for the admin screens. The ids start with sub_sample_
	// and exist only here, not in Stripe; real ones arrive through the webhook.
	// The demo admin is on Pro, the demo user on Free (12 of 15 projects).
	const subs: (typeof subscription.$inferInsert)[] = [];
	const STATUS = ['active', 'active', 'active', 'active', 'active', 'active', 'active', 'trialing', 'past_due', 'canceled', 'canceled'];
	for (const [i, owner] of people.entries()) {
		if (i === 1 || (i > 1 && rand() > 0.35)) continue;
		const status = i === 0 ? 'active' : pick(STATUS);
		const yearly = i > 0 && rand() < 0.15;
		const started = Math.floor(rand() * 330) + 20;
		const periodEnd = status === 'canceled' ? daysAgo(Math.floor(rand() * 20)) : daysAgo(-(1 + Math.floor(rand() * (yearly ? 360 : 29))));
		subs.push({
			id: `sub_sample_${String(i).padStart(3, '0')}`,
			userId: owner.id!,
			customerId: `cus_sample_${String(i).padStart(3, '0')}`,
			status,
			plan: 'pro',
			priceId: null,
			amount: yearly ? 12_000 : 1_200,
			currency: 'usd',
			interval: yearly ? 'year' : 'month',
			currentPeriodEnd: periodEnd,
			cancelAtPeriodEnd: status === 'active' && rand() < 0.1,
			endedAt: status === 'canceled' ? periodEnd : null,
			createdAt: daysAgo(started)
		});
	}
	await db.insert(subscription).values(subs);

	// The audit log is generated in SQL: 100k rows in one statement instead of
	// 100k round trips. Actors cycle through the seeded users.
	if (auditRows > 0) {
		await db.execute(sql`select setseed(0.42)`);
		await db.execute(sql`
			with actors as (
				select id, email, row_number() over (order by created_at) - 1 as n, count(*) over () as total from "user"
			)
			, events as (
				select
					g,
					now() - (random() * interval '365 days') as at,
					(array['auth.sign_in','auth.sign_in','auth.sign_in','auth.sign_out','project.create','project.update','project.update','project.delete','auth.password_reset','admin.set_role','admin.ban'])[1 + floor(random() * 11)::int] as action
				from generate_series(1, ${auditRows}) g
			)
			insert into audit_log (at, actor_id, actor_email, action, target, detail)
			select
				e.at,
				a.id,
				a.email,
				e.action,
				-- What the action was done to: a project, another user, or nothing.
				case
					when e.action like 'project.%' then 'project:' || (1 + floor(random() * 400)::int)
					when e.action like 'admin.%' then 'user:' || (select b.email from actors b where b.n = (e.g * 7 + 3) % b.total)
				end,
				jsonb_build_object('ip', '10.0.' || floor(random() * 255)::int || '.' || floor(random() * 255)::int)
			from events e
			join actors a on a.n = e.g % a.total
		`);
	}
	return true;
}
