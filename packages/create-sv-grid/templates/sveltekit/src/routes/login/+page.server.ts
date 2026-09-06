import { fail, redirect } from '@sveltejs/kit'
import { dev } from '$app/environment'
import type { Actions, PageServerLoad } from './$types'
import {
  SESSION_COOKIE,
  createSession,
  sessionCookieOptions,
  verifyCredentials,
} from '$lib/server/auth'

export const load: PageServerLoad = ({ locals, url }) => {
  // Already signed in? Nothing to do here.
  if (locals.user) redirect(303, safeRedirect(url.searchParams.get('redirectTo')))
  return { redirectTo: safeRedirect(url.searchParams.get('redirectTo')) }
}

/**
 * Only ever redirect to a path on this site. Echoing an arbitrary `redirectTo`
 * back into a Location header is an open redirect: an attacker mails a link to
 * your real login page that lands the user on theirs afterwards.
 */
function safeRedirect(target: string | null): string {
  if (!target) return '/people'
  // Must start with a single slash - "//evil.test" and "https://evil.test" are
  // both absolute, and the browser would happily follow them off-site.
  if (!target.startsWith('/') || target.startsWith('//')) return '/people'
  return target
}

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const data = await request.formData()
    const email = String(data.get('email') ?? '')
    const password = String(data.get('password') ?? '')
    const redirectTo = safeRedirect(String(data.get('redirectTo') ?? '') || url.searchParams.get('redirectTo'))

    if (!email || !password) {
      return fail(400, { email, error: 'Enter your email and password.' })
    }

    const user = await verifyCredentials(email, password)
    if (!user) {
      // One message for both "no such user" and "wrong password": a specific
      // one tells an attacker which emails are registered.
      return fail(401, { email, error: 'Those credentials did not match.' })
    }

    cookies.set(SESSION_COOKIE, createSession(user.id), sessionCookieOptions(!dev))
    redirect(303, redirectTo)
  },
}
