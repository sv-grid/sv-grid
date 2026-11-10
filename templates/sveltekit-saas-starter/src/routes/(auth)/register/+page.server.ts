import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/server/auth.ts';
import { safeNext } from '#lib/config.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, url }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		if (!name || !email) return fail(400, { name, email, message: 'Enter your name and email.' });
		if (password.length < 8) return fail(400, { name, email, message: 'Use at least 8 characters for the password.' });

		try {
			// Signs the new account in too: Better Auth sets the session cookie.
			await auth.api.signUpEmail({ body: { name, email, password } });
		} catch (error) {
			if (error instanceof APIError) return fail(400, { name, email, message: error.message || 'Could not create the account.' });
			throw error;
		}
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
