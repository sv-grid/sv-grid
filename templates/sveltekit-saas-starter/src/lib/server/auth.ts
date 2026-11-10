import {
	ORIGIN,
	BETTER_AUTH_SECRET,
	GITHUB_CLIENT_ID,
	GITHUB_CLIENT_SECRET
} from '$app/env/private';

import { eq } from 'drizzle-orm';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { building } from '$app/env';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/schema.ts';
import { authShape } from '#lib/server/auth-options.ts';
import { sendEmail } from '#lib/server/email.ts';
import { audit } from '#lib/server/audit.ts';

/** GitHub sign-in shows only when both keys are set. */
export const githubEnabled = Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);

export const auth = betterAuth({
	...authShape,
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	// `vite build` loads this module with no database (see db/index.ts); the
	// schema check would log an error there. It still runs when the app starts.
	advanced: { database: { validateSchema: !building } },
	emailAndPassword: {
		...authShape.emailAndPassword,
		// Better Auth builds the link; it lands on /reset-password?token=...
		sendResetPassword: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: 'Reset your password',
				text: `Someone asked to reset the password for ${user.email}.\n\nOpen this link within an hour to choose a new one:\n${url}\n\nIf it wasn't you, ignore this email.`
			});
		}
	},
	socialProviders: githubEnabled
		? { github: { clientId: GITHUB_CLIENT_ID!, clientSecret: GITHUB_CLIENT_SECRET! } }
		: {},
	databaseHooks: {
		user: {
			create: {
				// The first account on an empty database becomes the admin, so a
				// new install with your own Postgres can reach /admin.
				before: async (data) => {
					const [first] = await db.select({ id: user.id }).from(user).limit(1);
					return { data: { ...data, role: first ? 'user' : 'admin' } };
				}
			}
		},
		session: {
			create: {
				after: async (session) => {
					const [who] = await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.id, session.userId));
					await audit(who, 'auth.sign_in', undefined, { ip: session.ipAddress ?? null });
				}
			}
		}
	},
	plugins: [
		...authShape.plugins,
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
