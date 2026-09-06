import type { LayoutServerLoad } from './$types'

/**
 * Publish the signed-in user to every page.
 *
 * `locals.user` is server-only; returning it from a layout load is what makes
 * it available to components as `data.user`. Only the public shape crosses
 * that boundary - `$lib/server/auth` never puts the password hash on it.
 */
export const load: LayoutServerLoad = ({ locals }) => ({ user: locals.user })
