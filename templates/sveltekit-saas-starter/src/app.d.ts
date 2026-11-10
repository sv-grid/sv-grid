import type { User, Session } from 'better-auth';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// `role` and `banned` come from the Better Auth admin plugin.
		interface Locals { user?: User & { role?: string | null; banned?: boolean | null }; session?: Session }

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
