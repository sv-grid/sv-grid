import { redirect } from '@sveltejs/kit';
import { auth } from '#lib/server/auth.ts';
import { audit } from '#lib/server/audit.ts';
import type { Actions, PageServerLoad } from './$types';

// Sign-out is a POST (the form in the app header), so a link or an image tag
// on another site can't sign people out.
export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (locals.user) await audit(locals.user, 'auth.sign_out');
		await auth.api.signOut({ headers: request.headers });
		redirect(303, '/');
	}
};
