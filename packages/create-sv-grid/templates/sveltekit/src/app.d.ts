// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { User } from '$lib/server/auth'

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Set by hooks.server.ts on every request; null when signed out. */
			user: User | null
		}
		interface PageData {
			/** Returned by the root layout load, so every page can read it. */
			user?: User | null
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
