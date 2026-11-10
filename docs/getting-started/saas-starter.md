# SvelteKit SaaS starter

A SvelteKit 3 app with sign-in, roles, Stripe billing and an admin area, where
every data screen is an SvGrid grid. It is MIT licensed and uses only the free
`@svgrid/grid` package. Scaffold it, rename the sample `project` table to what
your product stores, and start on your own features.

```bash
npm create @svgrid@latest my-app -- --template saas
cd my-app
npm install
npm run dev
```

The first `npm run dev` writes a `.env` with a random auth secret, creates an
embedded Postgres ([PGlite](https://pglite.dev)) in `.data/pglite`, and seeds
it. Nothing to install, no keys to fetch. Sign in as `admin@example.com` /
`starter-admin-1` (admin, Pro plan) or `user@example.com` / `starter-user-1`
(user, Free plan).

It is also a GitHub template:
[sv-grid/sveltekit-saas-starter](https://github.com/sv-grid/sveltekit-saas-starter).
Press "Use this template" there to start a repository of your own with the
same files and a CI workflow that type-checks the app and runs its Playwright
tests on Node 22 and 24.

## The stack

| Part | Choice |
| --- | --- |
| Framework | SvelteKit 3, Svelte 5 runes, adapter-node |
| Auth | [Better Auth](https://www.better-auth.com): email and password, GitHub OAuth when its keys are set, the admin plugin for roles and bans |
| Database | Drizzle on Postgres; PGlite until you set `DATABASE_URL` |
| Billing | Stripe Checkout, the customer portal, a signed webhook |
| UI | `@svgrid/grid` for the grids and the form, card and alert components; Tailwind 4 for layout |
| Email | Resend, or the server console when no key is set |

## The screens

| Screen | Grid pattern it shows |
| --- | --- |
| Dashboard | A read-only grid with `responsive` and `hideBelow` for phones |
| Projects | Edit in the grid: one form action per cell, the same validation in the grid (`validate` + `rejectInvalid`) and on the server, rollback with `api.setCellValue` when the server refuses, CSV export |
| Admin: users | Server-side sort, search and paging kept in the URL (`externalSort`), a role column edited with a list editor, ban and unban for the selected rows |
| Admin: subscriptions | Status filters in the URL, revenue totals, Stripe rows |
| Admin: audit log | 100,000 seeded rows through `createServerDataSource` in infinite mode; sort, column filters and search run in SQL |

Projects is the screen to copy for your own data. A person's projects are a
few hundred rows at most, so they load whole and the grid sorts and filters in
the browser. The admin screens can grow without limit, so they send the
grid's sort and filter model to the server. `src/lib/server/grid-query.ts`
turns that model into Drizzle conditions over a whitelist of columns, with
bound parameters and escaped `LIKE` patterns.

## Access checks belong in every action

A SvelteKit layout `load` runs for page requests. It does not run for form
actions or `+server.ts` endpoints. The starter's `(app)` layout sends
signed-out visitors to the login page, and that alone would leave every
action open to a POST from anyone. So each action and endpoint starts with a
guard:

```ts
// src/lib/server/guards.ts
export function requireUser(locals: App.Locals) {
	if (!locals.user) error(401, 'Sign in first');
	return locals.user;
}

export function requireAdmin(locals: App.Locals) {
	const user = requireUser(locals);
	if (user.role !== 'admin') error(403, 'Admins only');
	return user;
}
```

The same rule covers the grid's server endpoints: the audit log's
`rows/+server.ts`, which `createServerDataSource` calls, starts with
`requireAdmin(locals)`.

## Billing

Billing stays off until `STRIPE_SECRET_KEY` and `STRIPE_PRICE_PRO` are set;
the billing page says what to add. The plan limit (15 projects on Free) is
enforced either way, in the action that creates a project.

The webhook at `/api/stripe/webhook` verifies the signature on the raw body,
then reads the subscription back from Stripe and stores that. An event that
arrives late or twice still stores the current state. When a customer returns
from Checkout the billing page reads the session too, so the new plan shows
without waiting for the webhook. The starter's README has the steps for local
testing with `stripe listen`.

## Page weight

Measured with the starter's `node scripts/route-size.mjs` after
`npm run build`, with `@svgrid/grid` 3.0.33: gzipped JS and CSS per route.

| Route | gzip | vs the landing page |
| --- | --- | --- |
| `/` | 30.0 KB | |
| `/billing` | 39.1 KB | +10.0 KB |
| `/login` | 57.6 KB | +28.5 KB |
| `/dashboard` | 135.0 KB | +106.0 KB |
| `/projects` | 158.0 KB | +128.9 KB |
| `/admin/users` | 156.3 KB | +127.3 KB |
| `/admin/audit` | 138.4 KB | +109.3 KB |

Pages without a grid load only the components they use. The grid's export,
chart, menu and editor code load when used.

## Deploying

`npm run build` makes a Node server (`node build`). Set `ORIGIN`,
`BETTER_AUTH_SECRET`, `DATABASE_URL` and the Stripe keys on the host, and run
`npm run db:migrate` against the production database. adapter-node 6 takes
the origin from `paths.origin` at build time; without it, it assumes `https`
and reads the `Host` header, which is right behind a TLS proxy. PGlite is for
development; use a server Postgres in production.

## See also

- [Starters and scaffolding](./starters.md): every `npm create @svgrid` template.
- [SvGrid with SvelteKit](./sveltekit.md): the load, URL sort and form-action
  patterns the starter is built from.
- [Server infinite scroll](../help/server/server-infinite-scroll.md) for the
  pattern behind the audit log.
