import type { BetterAuthOptions } from 'better-auth/minimal';
import { admin } from 'better-auth/plugins/admin';

// The parts of the Better Auth config that shape the database. Shared by the
// app (auth.ts) and by `npm run auth:schema`, which cannot load auth.ts because
// it imports SvelteKit modules. Add a plugin here and both pick it up.
export const authShape = {
	emailAndPassword: { enabled: true },
	// Adds `role`, `banned`, `banReason`, `banExpires` to users and the admin
	// API (list users, set role, ban).
	plugins: [admin()]
} satisfies Partial<BetterAuthOptions>;
