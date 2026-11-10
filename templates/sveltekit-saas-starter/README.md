# SvelteKit SaaS starter

A SvelteKit 3 app with the parts every SaaS needs before its first feature:
sign-in, roles, Stripe billing, an admin area, and data screens built on
[SvGrid](https://svgrid.com). MIT licensed. Clone it, rename `project` to
whatever your product stores, and start on the part only you can build.

```bash
npm create @svgrid@latest my-app -- --template saas
cd my-app
npm install
npm run dev
```

No database to install and no keys to get first. The first `npm run dev`
writes a `.env` with a fresh secret, creates an embedded Postgres in
`.data/pglite`, and fills it with sample data. Sign in with:

| Email | Password | Role |
| --- | --- | --- |
| `admin@example.com` | `starter-admin-1` | admin, on the Pro plan |
| `user@example.com` | `starter-user-1` | user, on the Free plan |

## What is in it

| Area | Where | What it shows |
| --- | --- | --- |
| Landing, pricing | `src/routes/+page.svelte`, `src/routes/pricing` | Public pages; pricing reads the plans from `src/lib/plans.ts` |
| Sign in, sign up, reset password | `src/routes/(auth)` | Email + password, GitHub OAuth when its keys are set, `?next=` kept and checked |
| Dashboard | `src/routes/(app)/dashboard` | Stat cards and a read-only grid |
| Projects | `src/routes/(app)/projects` | The screen to copy for your own data: edit in the grid, one save per cell, the same validation in the browser and on the server, CSV export, the plan limit |
| Billing | `src/routes/(app)/billing` | Plan, usage, Stripe Checkout and the customer portal |
| Settings | `src/routes/(app)/settings` | Name, password change that signs out other devices |
| Admin: users | `src/routes/(app)/admin/users` | Server-side sort, search and paging kept in the URL; role edit in the grid; ban and unban |
| Admin: subscriptions | `src/routes/(app)/admin/subscriptions` | Monthly revenue, status filters, every subscription |
| Admin: audit log | `src/routes/(app)/admin/audit` | 100,000 seeded rows, infinite scroll, sort, filter and search in SQL |

The stack: SvelteKit 3, Svelte 5, [Better Auth](https://www.better-auth.com)
(with its admin plugin for roles and bans), [Drizzle](https://orm.drizzle.team)
on Postgres, [Stripe](https://docs.stripe.com/billing), Tailwind 4, and
`@svgrid/grid` for the grids and the UI components (buttons, inputs, cards,
alerts).

## Things to know before you change it

**Every form action and endpoint checks access itself.** A layout's `load`
runs for page requests only; SvelteKit does not run it for form actions or
`+server.ts` routes. So `(app)/+layout.server.ts` sends signed-out visitors
to the login page, and each action still starts with `requireUser(locals)`
or `requireAdmin(locals)` from `src/lib/server/guards.ts`. A new action
without one is open to anyone who can send a POST.

**Plan limits live in the action, not the page.** `projectLimitReached()` in
`src/lib/server/billing.ts` is called by the action that creates a project,
so a hand-made request meets the same limit as the button. Add your own
limits next to it.

**Queries filter on the owner.** Updates and deletes in the projects actions
match `ownerId` as well as `id`, so a forged id for someone else's row
changes nothing.

**Grids that can grow query on the server.** Projects loads all of one
person's rows and lets the grid sort and filter in the browser. Users, the
audit log and subscriptions can grow without limit, so they sort, filter and
page in SQL. `src/lib/server/grid-query.ts` turns the grid's sort and filter
model into Drizzle conditions over a whitelist of columns.

## The database

Without `DATABASE_URL` the app runs [PGlite](https://pglite.dev), Postgres
compiled to WebAssembly, stored in `.data/pglite`. It is real Postgres, so the
same migrations and queries run on both. Delete `.data` to start over.

For a server Postgres, set `DATABASE_URL` in `.env`, then:

```bash
npm run db:migrate   # apply the migrations in ./drizzle
npm run db:seed      # optional: the same sample data
```

Change the schema in `src/lib/server/db/schema.ts`, then `npm run db:generate`
writes the next migration. The auth tables come from Better Auth:
`npm run auth:schema` regenerates `src/lib/server/db/auth.schema.ts` after you
add a Better Auth plugin.

## Stripe billing

Billing is off until you add keys; the billing page says so, and the plan
limits apply either way.

1. In the Stripe dashboard (test mode), create a product with a recurring
   price. Copy the price id (`price_...`).
2. Save a customer portal configuration once: Settings, Billing, Customer
   portal. Stripe refuses to open the portal until you do.
3. Put the keys in `.env`:

   ```bash
   STRIPE_SECRET_KEY="sk_test_..."
   STRIPE_PRICE_PRO="price_..."
   ```

4. Forward webhooks to your machine with the [Stripe CLI](https://docs.stripe.com/stripe-cli)
   and copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET`:

   ```bash
   stripe listen --forward-to localhost:5173/api/stripe/webhook
   ```

5. Restart `npm run dev`, sign in as `user@example.com`, open Billing, and
   pay with the test card `4242 4242 4242 4242`.

How it fits together: Checkout creates the subscription; Stripe calls
`/api/stripe/webhook`; the webhook checks the signature, reads the
subscription back from Stripe and stores it in the `subscription` table.
Reading it back means an event that arrives late or twice still stores the
current state. The billing page also reads the Checkout session when the
customer returns, so the new plan shows even before the webhook lands.

`past_due` keeps paid features on while Stripe retries the card; change
`PAID_STATUSES` in `src/lib/plans.ts` if you want it otherwise.

In production, add the endpoint `https://your-domain/api/stripe/webhook` in
the Stripe dashboard with the events `checkout.session.completed` and
`customer.subscription.created`, `.updated` and `.deleted`, and use its
signing secret.

## Email

Password reset emails print to the server console until you set
`RESEND_API_KEY` and `EMAIL_FROM` ([Resend](https://resend.com)). Swap
`src/lib/server/email.ts` for any other provider; it is one function.

## Deploying

`npm run build` makes a Node server in `build/`; run it with `node build`.

- Set `ORIGIN`, `BETTER_AUTH_SECRET`, `DATABASE_URL` and the Stripe keys in
  the host's environment, run `npm run db:migrate` against the production
  database, and start the server.
- adapter-node 6 (SvelteKit 3) takes the site's origin from the
  `paths.origin` option at build time. Without it, it assumes `https` and
  reads the host from the `Host` header, which is right behind a TLS proxy.
  Behind a proxy that rewrites the host, set `HOST_HEADER` (and
  `PROTOCOL_HEADER` if the proxy talks plain http to the app).
- Better Auth rate-limits sign-in per client IP. Behind a proxy, tell it
  which header carries the IP (`advanced.ipAddress.ipAddressHeaders` in
  `src/lib/server/auth.ts`); otherwise all visitors share one bucket.
- PGlite is for development. Use a server Postgres in production.

## Page weight

Measured with `node scripts/route-size.mjs` after `npm run build`
(`@svgrid/grid` 3.0.33): the gzipped JS and CSS each route loads, and the
difference from the landing page.

| Route | gzip | vs `/` |
| --- | --- | --- |
| `/` | 30.0 KB | |
| `/pricing` | 30.6 KB | +1.6 KB |
| `/login` | 57.6 KB | +28.5 KB |
| `/billing` | 39.1 KB | +10.0 KB |
| `/settings` | 60.7 KB | +31.7 KB |
| `/dashboard` | 135.0 KB | +106.0 KB |
| `/projects` | 158.0 KB | +128.9 KB |
| `/admin/users` | 156.3 KB | +127.3 KB |
| `/admin/audit` | 138.4 KB | +109.3 KB |
| `/admin/subscriptions` | 136.8 KB | +107.8 KB |

Pages without a grid load only the UI components they use. The grid's
export, chart, menu and editor code stay in separate chunks that load when
used.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server; creates `.env` on first run |
| `npm run build` / `npm run preview` | Production build and a local preview of it |
| `npm run check` | `svelte-check` |
| `npm run test:e2e` | Playwright smoke test against a production build |
| `npm run db:generate` / `db:migrate` / `db:push` / `db:studio` | Drizzle Kit |
| `npm run db:seed` | Sample data into the database in `DATABASE_URL` |
| `npm run auth:schema` | Regenerate the Better Auth tables |
| `node scripts/route-size.mjs` | Page weight per route, after a build |

## More SvGrid

The grid docs, written for people and for coding assistants:
[svgrid.com/docs](https://svgrid.com/docs/) and
[svgrid.com/llms.txt](https://svgrid.com/llms.txt). Excel and PDF export,
pivot tables and the Studio designer, which writes grid screens like the ones
here from a visual editor, are in the paid
[SvGrid Enterprise](https://svgrid.com/docs/enterprise/studio/) package. This
starter uses none of it.

## License

MIT. See [LICENSE](LICENSE).
