import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

// Better Auth checks the emailed token and sends people here with
// ?token=... (or ?error=INVALID_TOKEN once it has expired).
export const load: PageServerLoad = ({ url }) => ({
	token: url.searchParams.get('token'),
	invalid: url.searchParams.has('error')
});

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const token = String(form.get('token') ?? '');
		const password = String(form.get('password') ?? '');
		if (password.length < 8) return fail(400, { message: 'Use at least 8 characters.' });
		try {
			await auth.api.resetPassword({ body: { token, newPassword: password } });
		} catch (error) {
			if (error instanceof APIError) return fail(400, { message: 'This link has expired. Ask for a new one.' });
			throw error;
		}
		redirect(303, '/login?reset=1');
	}
};
