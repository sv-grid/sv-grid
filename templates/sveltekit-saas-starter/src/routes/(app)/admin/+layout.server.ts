import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Checked on the server for every /admin page (actions and endpoints call
// requireAdmin themselves; they skip this). Hiding the nav links is only
// cosmetic; this is what keeps the data out of non-admin hands.
export const load: LayoutServerLoad = async ({ parent }) => {
	const { user } = await parent();
	if (user.role !== 'admin') error(403, 'Admins only');
};
