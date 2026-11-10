import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Postgres connection string. Leave empty to use the embedded PGlite database in .data/pglite.',
		schema: (v) => v || undefined
	},
	ORIGIN: {
		description: 'The app origin (base URL), e.g. `http://localhost:5173`.'
	},
	BETTER_AUTH_SECRET: {
		description: 'Secret used to sign tokens. For production use 32 characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).'
	},
	GITHUB_CLIENT_ID: {
		description: 'GitHub OAuth client ID. Optional; without it the GitHub button is hidden. See [Better Auth GitHub provider](https://www.better-auth.com/docs/authentication/github).',
		schema: (v) => v || undefined
	},
	RESEND_API_KEY: {
		description: 'Resend API key for outgoing email (password reset). Optional; without it emails are printed to the server console.',
		schema: (v) => v || undefined
	},
	EMAIL_FROM: {
		description: 'Sender address for outgoing email, e.g. `Acme <hello@acme.dev>`. Must be a domain verified in Resend.',
		schema: (v) => v || undefined
	},
	GITHUB_CLIENT_SECRET: {
		description: 'GitHub OAuth client secret. See [Better Auth GitHub provider](https://www.better-auth.com/docs/authentication/github).',
		schema: (v) => v || undefined
	},
	STRIPE_SECRET_KEY: {
		description: 'Stripe secret key (`sk_test_...` while testing). Optional; without it the billing page says billing is not set up.',
		schema: (v) => v || undefined
	},
	STRIPE_PRICE_PRO: {
		description: 'The Stripe price id (`price_...`) of the Pro plan, a recurring price.',
		schema: (v) => v || undefined
	},
	STRIPE_WEBHOOK_SECRET: {
		description: 'Signing secret of the webhook endpoint (`whsec_...`). `stripe listen` prints one for local testing.',
		schema: (v) => v || undefined
	}
});
