import { redirect } from '@sveltejs/kit'
import { dev } from '$app/environment'
import type { RequestHandler } from './$types'
import { SESSION_COOKIE, destroySession, sessionCookieOptions } from '$lib/server/auth'

/**
 * Sign out.
 *
 * An endpoint rather than a form action, because signing out has no page to
 * render - a `+page.server.ts` with no `+page.svelte` beside it is not a route
 * SvelteKit will post a form to, and returns 415.
 *
 * POST only, deliberately. A GET logout link fires from any prefetcher or
 * `<img src="/logout">` on a page you do not control. SvelteKit's origin check
 * covers this POST, and the session cookie is SameSite=Lax, so a cross-site
 * form cannot drive it either.
 */
export const POST: RequestHandler = async ({ cookies }) => {
  // Drop the session server-side as well as clearing the cookie, so a copy of
  // the id taken earlier stops working immediately.
  destroySession(cookies.get(SESSION_COOKIE))
  cookies.delete(SESSION_COOKIE, sessionCookieOptions(!dev))
  redirect(303, '/login')
}
