import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { asc, count, desc, ilike, inArray, or } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '#lib/server/auth.ts';
import { audit } from '#lib/server/audit.ts';
import { requireAdmin } from '#lib/server/guards.ts';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/schema.ts';

const PAGE_SIZE = 25;
const ROLES = ['user', 'admin'] as const;

// Columns the grid may sort by. Anything else in the URL falls back to
// createdAt, so a hand-edited query string cannot reach an arbitrary column.
const SORTABLE = {
	name: user.name,
	email: user.email,
	role: user.role,
	banned: user.banned,
	createdAt: user.createdAt
} as const;
type SortKey = keyof typeof SORTABLE;

export const load: PageServerLoad = async ({ url }) => {
	const sortParam = url.searchParams.get('sort') ?? 'createdAt';
	const sort: SortKey = sortParam in SORTABLE ? (sortParam as SortKey) : 'createdAt';
	const dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
	const page = Math.max(0, Number(url.searchParams.get('page')) || 0);
	const q = url.searchParams.get('q')?.trim() ?? '';

	const where = q ? or(ilike(user.name, `%${q}%`), ilike(user.email, `%${q}%`)) : undefined;
	const order = dir === 'asc' ? asc(SORTABLE[sort]) : desc(SORTABLE[sort]);

	const [rows, [{ total }]] = await Promise.all([
		db
			.select({ id: user.id, name: user.name, email: user.email, role: user.role, banned: user.banned, createdAt: user.createdAt })
			.from(user)
			.where(where)
			.orderBy(order, asc(user.id))
			.limit(PAGE_SIZE)
			.offset(page * PAGE_SIZE),
		db.select({ total: count() }).from(user).where(where)
	]);

	return { rows, total, page, pageSize: PAGE_SIZE, sort, dir, q };
};

/** Better Auth's admin endpoints check the caller is an admin; these add the house rules. */
export const actions: Actions = {
	setRole: async ({ request, locals }) => {
		const me = requireAdmin(locals);
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		const role = String(form.get('role') ?? '');
		if (!ROLES.includes(role as (typeof ROLES)[number])) return fail(400, { message: `Role is one of: ${ROLES.join(', ')}` });
		// Removing your own admin role could leave nobody able to undo it.
		if (userId === me.id) return fail(400, { message: "You can't change your own role" });
		try {
			await auth.api.setRole({ headers: request.headers, body: { userId, role: role as (typeof ROLES)[number] } });
		} catch (error) {
			if (error instanceof APIError) return fail(400, { message: error.message });
			throw error;
		}
		await audit(me, 'admin.set_role', `user:${userId}`, { role });
		return { ok: true };
	},

	ban: async ({ request, locals }) => banOrUnban(request, requireAdmin(locals), true),
	unban: async ({ request, locals }) => banOrUnban(request, requireAdmin(locals), false)
};

async function banOrUnban(request: Request, me: { id: string; email: string }, ban: boolean) {
	const ids = (await request.formData()).getAll('id').map(String);
	if (ids.includes(me.id)) return fail(400, { message: "You can't ban yourself" });
	if (!ids.length) return fail(400, { message: 'Select the users first' });
	for (const userId of ids) {
		// Banning also ends every session the user has.
		if (ban) await auth.api.banUser({ headers: request.headers, body: { userId, banReason: 'Banned by an admin' } });
		else await auth.api.unbanUser({ headers: request.headers, body: { userId } });
	}
	const emails = await db.select({ email: user.email }).from(user).where(inArray(user.id, ids));
	await audit(me, ban ? 'admin.ban' : 'admin.unban', undefined, { users: emails.map((e) => e.email) });
	return { changed: ids.length };
}
