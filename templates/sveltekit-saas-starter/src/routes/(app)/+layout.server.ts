import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Every page in (app) runs this first: no session, no page. Form actions and
// +server.ts routes skip layout loads, so each one calls requireUser itself.
export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	const { id, name, email, image, role } = locals.user;
	return { user: { id, name, email, image: image ?? null, role: role ?? 'user' } };
};
