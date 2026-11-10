import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth, githubEnabled } from '#lib/server/auth.ts';
import { safeNext } from '#lib/config.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({
	githubEnabled,
	reset: url.searchParams.has('reset')
});

export const actions: Actions = {
	email: async ({ request, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		if (!email || !password) return fail(400, { email, message: 'Enter your email and password.' });

		try {
			await auth.api.signInEmail({ body: { email, password } });
		} catch (error) {
			if (error instanceof APIError) return fail(400, { email, message: error.message || 'Sign-in failed.' });
			throw error;
		}
		redirect(303, safeNext(url.searchParams.get('next')));
	},

	github: async ({ url }) => {
		const result = await auth.api.signInSocial({
			body: { provider: 'github', callbackURL: safeNext(url.searchParams.get('next')) }
		});
		if (!result.url) return fail(500, { email: '', message: 'GitHub sign-in is not available.' });
		redirect(303, result.url);
	}
};
