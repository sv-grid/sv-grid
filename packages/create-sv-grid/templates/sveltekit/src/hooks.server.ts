/**
 * Server hooks: resolve the session once per request, then gate routes.
 *
 * Doing it here rather than in each `+page.server.ts` is what makes the gate
 * hard to forget - a new protected route is one entry in PROTECTED, not a
 * check you have to remember to copy into every load function.
 */
import { redirect, type Handle } from '@sveltejs/kit'
import { SESSION_COOKIE, userForSession } from '$lib/server/auth'
import type { Role } from '$lib/server/auth'

/**
 * Route prefixes that need a session, and the role they need.
 *
 * `null` means any signed-in user. Longest prefix wins, so a specific child
 * route can require more than its parent.
 */
const PROTECTED: { prefix: string; role: Role | null }[] = [
  { prefix: '/people', role: null },
  { prefix: '/admin', role: 'admin' },
]

function requirementFor(pathname: string): Role | null | undefined {
  const match = PROTECTED.filter((r) => pathname === r.prefix || pathname.startsWith(r.prefix + '/')).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0]
  return match ? match.role : undefined
}

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = await userForSession(event.cookies.get(SESSION_COOKIE))

  const required = requirementFor(event.url.pathname)
  if (required !== undefined) {
    if (!event.locals.user) {
      // Carry where they were going, so login can send them back rather than
      // dumping everyone on the home page.
      const from = encodeURIComponent(event.url.pathname + event.url.search)
      redirect(303, `/login?redirectTo=${from}`)
    }
    if (required && event.locals.user.role !== required) {
      // Signed in but not allowed: 403, not a redirect to login. Bouncing an
      // authenticated user to a login form reads as a broken app.
      redirect(303, '/people?error=forbidden')
    }
  }

  return resolve(event)
}
