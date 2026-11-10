import { fail } from '@sveltejs/kit';
import { auth } from '#lib/server/auth.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const email = String((await request.formData()).get('email') ?? '').trim();
		if (!email) return fail(400, { email, message: 'Enter your email.' });
		try {
			await auth.api.requestPasswordReset({ body: { email, redirectTo: '/reset-password' } });
		} catch (error) {
			console.error('password reset request failed', error);
		}
		// Same answer whether or not the account exists, so the form can't be
		// used to find out who has an account.
		return { sent: true, email };
	}
};
