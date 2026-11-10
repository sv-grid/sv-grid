import { planOf } from '#lib/server/billing.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	signedIn: Boolean(locals.user),
	plan: locals.user ? (await planOf(locals.user.id)).plan : null
});
