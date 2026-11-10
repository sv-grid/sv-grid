# AGENTS.md

Notes for AI coding assistants working in this project.

## Stack

SvelteKit 3 and Svelte 5 (runes only: `$state`, `$derived`, `$props`, snippets;
no `export let`, no stores for component state). Better Auth, Drizzle on
Postgres (PGlite locally when `DATABASE_URL` is empty), Stripe, Tailwind 4.
Imports from `src/lib` use the `#lib/...` alias with the `.ts` extension.

## Rules that are easy to break

- Every form action and `+server.ts` handler must call `requireUser(locals)`
  or `requireAdmin(locals)` from `src/lib/server/guards.ts` first. Layout
  `load` guards do not run for actions or endpoints.
- Queries that change a user's rows filter on the owner (`ownerId`) as well as
  the id.
- Plan limits are checked in the action that creates the row
  (`projectLimitReached` in `src/lib/server/billing.ts`), not only in the UI.
- Validation rules live in one place and run on both sides (see
  `src/lib/projects.ts`: the grid's `validate` and the server's parse use the
  same function).
- `redirect()` to another site needs `{ external: true }` in SvelteKit 3.
- Only `src/lib/server/billing.ts` talks to Stripe. The `subscription` table is
  written by `syncSubscription()`, which re-reads Stripe; do not write it from
  event payloads.
- New tables: edit `src/lib/server/db/schema.ts`, then `npm run db:generate`.
  Never edit a migration that has shipped.
- Screens whose rows can grow without limit sort, filter and page on the
  server (`src/lib/server/grid-query.ts`); small per-user lists load whole and
  let the grid do it.
- Run `npm run check` after changes.
