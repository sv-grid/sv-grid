import { fail } from '@sveltejs/kit';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { project } from '#lib/server/db/schema.ts';
import { audit } from '#lib/server/audit.ts';
import { requireUser } from '#lib/server/guards.ts';
import { planOf, projectLimitReached } from '#lib/server/billing.ts';
import { PLANS } from '#lib/plans.ts';
import { EDITABLE_FIELDS, parseProjectField, type EditableField } from '#lib/projects.ts';
import type { Actions, PageServerLoad } from './$types';

const columns = {
	id: project.id,
	name: project.name,
	client: project.client,
	status: project.status,
	budget: project.budget,
	dueDate: project.dueDate,
	updatedAt: project.updatedAt
};

// A person's projects are a few hundred rows at most, so they all come down
// and the grid sorts and filters in the browser. Screens with unbounded rows
// (admin users, audit log) query on the server instead.
export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();
	const [rows, { plan }] = await Promise.all([
		db.select(columns).from(project).where(eq(project.ownerId, user.id)).orderBy(desc(project.createdAt)),
		planOf(user.id)
	]);
	return { rows, plan: PLANS[plan].name, limit: PLANS[plan].projectLimit };
};

// Every query below filters on ownerId as well as id: a forged id for someone
// else's project matches no row.
export const actions: Actions = {
	create: async ({ locals }) => {
		const me = requireUser(locals);
		const limited = await projectLimitReached(me.id);
		if (limited) return fail(402, { message: limited, upgrade: true });
		const [row] = await db.insert(project).values({ ownerId: me.id, name: 'Untitled project' }).returning(columns);
		await audit(me, 'project.create', `project:${row.id}`);
		return { created: row.id };
	},

	update: async ({ request, locals }) => {
		const me = requireUser(locals);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const field = String(form.get('field') ?? '') as EditableField;
		if (!EDITABLE_FIELDS.includes(field)) return fail(400, { message: `${field} can't be edited` });

		const parsed = parseProjectField(field, form.get('value'));
		if (!parsed.ok) return fail(400, { message: parsed.error });

		const [row] = await db
			.update(project)
			.set({ [field]: parsed.value })
			.where(and(eq(project.id, id), eq(project.ownerId, me.id)))
			.returning(columns);
		if (!row) return fail(404, { message: 'That project no longer exists' });
		await audit(me, 'project.update', `project:${id}`, { field, value: parsed.value });
		return { row };
	},

	delete: async ({ request, locals }) => {
		const me = requireUser(locals);
		const ids = (await request.formData()).getAll('id').map(String);
		if (!ids.length) return fail(400, { message: 'Select the projects to delete' });
		const gone = await db
			.delete(project)
			.where(and(inArray(project.id, ids), eq(project.ownerId, me.id)))
			.returning({ id: project.id });
		await audit(me, 'project.delete', undefined, { ids: gone.map((g) => g.id) });
		return { deleted: gone.length };
	}
};
