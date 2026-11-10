import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '#lib/server/auth.ts';
import { audit } from '#lib/server/audit.ts';
import { requireUser } from '#lib/server/guards.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	profile: async ({ request, locals }) => {
		requireUser(locals);
		const name = String((await request.formData()).get('name') ?? '').trim();
		if (!name) return fail(400, { profile: true, message: 'Enter a name.' });
		await auth.api.updateUser({ headers: request.headers, body: { name } });
		return { profile: true, saved: true };
	},

	password: async ({ request, locals }) => {
		const me = requireUser(locals);
		const form = await request.formData();
		const currentPassword = String(form.get('current') ?? '');
		const newPassword = String(form.get('next') ?? '');
		if (newPassword.length < 8) return fail(400, { password: true, message: 'Use at least 8 characters.' });
		try {
			// Signs out every other device, so a leaked password stops working there.
			await auth.api.changePassword({ headers: request.headers, body: { currentPassword, newPassword, revokeOtherSessions: true } });
		} catch (error) {
			if (error instanceof APIError) return fail(400, { password: true, message: 'The current password is wrong.' });
			throw error;
		}
		await audit(me, 'auth.password_change');
		return { password: true, saved: true };
	}
};
