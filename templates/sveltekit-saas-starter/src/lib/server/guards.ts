import { error } from '@sveltejs/kit';

type Locals = App.Locals;

/**
 * Layout `load` functions guard pages, but SvelteKit runs form actions and
 * +server.ts handlers without them. Every action and endpoint calls one of
 * these first.
 */
export function requireUser(locals: Locals) {
	if (!locals.user) error(401, 'Sign in first');
	return locals.user;
}

export function requireAdmin(locals: Locals) {
	const user = requireUser(locals);
	if (user.role !== 'admin') error(403, 'Admins only');
	return user;
}
