import { redirect } from '@sveltejs/kit';
import { safeNext } from '#lib/config.ts';
import type { LayoutServerLoad } from './$types';

// Signed-in people have no business on the sign-in pages.
export const load: LayoutServerLoad = ({ locals, url }) => {
	if (locals.user && url.pathname !== '/reset-password') redirect(303, safeNext(url.searchParams.get('next')));
};
